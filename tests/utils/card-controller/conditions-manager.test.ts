import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  ConditionsManager,
  ConditionEvaluateRequestEvent,
  evaluateConditionViaEvent,
  getOverriddenConfig,
  getOverridesByKey,
} from '../../../src/utils/card-controller/conditions-manager';
import { FrigateCardCondition } from '../../../src/types';
import {
  createCardAPI,
  createCondition,
  createConfig,
  createStateEntity,
} from '../../test-utils';

// @vitest-environment jsdom
describe('ConditionEvaluateRequestEvent', () => {
  it('should construct', () => {
    const condition = createCondition({ fullscreen: true });
    const event = new ConditionEvaluateRequestEvent(condition, {
      bubbles: true,
      composed: true,
    });

    expect(event.type).toBe('frigate-card:condition:evaluate');
    expect(event.condition).toBe(condition);
    expect(event.bubbles).toBeTruthy();
    expect(event.composed).toBeTruthy();
  });
});

describe('evaluateConditionViaEvent', () => {
  it('should evaluate true without condition', () => {
    const element = document.createElement('div');
    expect(evaluateConditionViaEvent(element)).toBeTruthy();
  });
  it('should dispatch event with condition and evaluate true', () => {
    const element = document.createElement('div');
    const condition = createCondition({ fullscreen: true });
    const handler = vi.fn().mockImplementation((ev: ConditionEvaluateRequestEvent) => {
      expect(ev.condition).toBe(condition);
      ev.evaluation = true;
    });
    element.addEventListener('frigate-card:condition:evaluate', handler);

    expect(evaluateConditionViaEvent(element, condition)).toBeTruthy();
    expect(handler).toBeCalled();
  });
  it('should dispatch event with condition and evaluate false', () => {
    const element = document.createElement('div');
    const condition = createCondition({ fullscreen: true });
    const handler = vi.fn().mockImplementation((ev: ConditionEvaluateRequestEvent) => {
      expect(ev.condition).toBe(condition);
      ev.evaluation = false;
    });
    element.addEventListener('frigate-card:condition:evaluate', handler);

    expect(evaluateConditionViaEvent(element, condition)).toBeFalsy();
    expect(handler).toBeCalled();
  });
  it('should dispatch event evaluate false if no evaluation', () => {
    const element = document.createElement('div');
    const condition = createCondition({ fullscreen: true });
    const handler = vi.fn();
    element.addEventListener('frigate-card:condition:evaluate', handler);

    expect(evaluateConditionViaEvent(element, condition)).toBeFalsy();
    expect(handler).toBeCalled();
  });
});

describe('getOverriddenConfig', () => {
  const config = {
    menu: {
      style: 'none',
    },
  };
  const overrides = [
    {
      overrides: {
        menu: {
          style: 'above',
        },
      },
      conditions: {
        fullscreen: true,
      },
    },
  ];

  it('should not override config', () => {
    const manager = new ConditionsManager(createCardAPI());
    expect(getOverriddenConfig(manager, config, overrides)).toBe(config);
  });

  it('should override config', () => {
    const manager = new ConditionsManager(createCardAPI());
    manager.setState({ fullscreen: true });

    expect(getOverriddenConfig(manager, config, overrides)).toEqual({
      menu: {
        style: 'above',
      },
    });
  });

  it('should do nothing without overrides', () => {
    const manager = new ConditionsManager(createCardAPI());
    manager.setState({ fullscreen: true });

    expect(getOverriddenConfig(manager, config)).toBe(config);
  });
});

describe('getOverridesByKey', () => {
  const condition = {
    fullscreen: true,
  };
  const override = {
    menu: {
      style: 'above',
    },
  };
  const overrides = [
    {
      overrides: override,
      conditions: condition,
    },
  ];

  it('should get overrides', () => {
    expect(getOverridesByKey('menu', overrides)).toEqual([
      { conditions: condition, overrides: { style: 'above' } },
    ]);
  });

  it('should get no overrides', () => {
    expect(getOverridesByKey('live', overrides)).toEqual([]);
  });

  it('should get no overrides when undefined', () => {
    expect(getOverridesByKey('live')).toEqual([]);
  });
});

describe('ConditionsManager', () => {
  const config = {
    type: 'custom:frigate-card',
    cameras: [],
    elements: [
      {
        type: 'custom:frigate-card-conditional',
        conditions: {
          fullscreen: true,
        },
        elements: [
          {
            type: 'custom:nested-unknown-object',
            unknown_key: {
              type: 'custom:frigate-card-conditional',
              conditions: {
                media_query: 'media query goes here',
              },
              elements: [],
            },
          },
        ],
      },
    ],
    overrides: [
      {
        overrides: {
          menu: {
            style: 'overlay',
          },
        },
        conditions: {
          fullscreen: true,
          state: [
            {
              entity: 'binary_sensor.foo',
              state: 'on',
            },
          ],
        },
      },
    ],
  };

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should get epoch', () => {
    const manager = new ConditionsManager(createCardAPI());
    const epoch_1 = manager.getEpoch();
    expect(epoch_1).toEqual({ manager: manager });

    manager.setState({ fullscreen: true });

    const epoch_2 = manager.getEpoch();
    expect(epoch_2).toEqual({ manager: manager });

    // Since the state was set the wrappers should be different.
    expect(epoch_1).not.toBe(epoch_2);
  });

  it('should not return hasHAStateConditions without HA state conditions', () => {
    const manager = new ConditionsManager(createCardAPI());
    expect(manager.hasHAStateConditions()).toBeFalsy();
  });

  it('should return hasHAStateConditions with HA state conditions', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValueOnce({
      matches: false,
      addEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig(config));
    const manager = new ConditionsManager(api);

    manager.setConditionsFromConfig();

    expect(manager.hasHAStateConditions()).toBeTruthy();
  });

  it('should evaluate conditions with a view', () => {
    const manager = new ConditionsManager(createCardAPI());
    const condition = { view: ['foo'] };
    expect(manager.evaluateCondition(condition)).toBeFalsy();
    manager.setState({ view: 'foo' });
    expect(manager.evaluateCondition(condition)).toBeTruthy();
  });

  it('should evaluate conditions with fullscreen', () => {
    const manager = new ConditionsManager(createCardAPI());
    const condition = { fullscreen: true };
    expect(manager.evaluateCondition(condition)).toBeFalsy();
    manager.setState({ fullscreen: true });
    expect(manager.evaluateCondition(condition)).toBeTruthy();
    manager.setState({ fullscreen: false });
    expect(manager.evaluateCondition(condition)).toBeFalsy();
  });

  it('should evaluate conditions with expand', () => {
    const manager = new ConditionsManager(createCardAPI());
    const condition = { expand: true };
    expect(manager.evaluateCondition(condition)).toBeFalsy();
    manager.setState({ expand: true });
    expect(manager.evaluateCondition(condition)).toBeTruthy();
    manager.setState({ expand: false });
    expect(manager.evaluateCondition(condition)).toBeFalsy();
  });

  it('should evaluate conditions with camera', () => {
    const manager = new ConditionsManager(createCardAPI());
    const condition = { camera: ['bar'] };
    expect(manager.evaluateCondition(condition)).toBeFalsy();
    manager.setState({ camera: 'bar' });
    expect(manager.evaluateCondition(condition)).toBeTruthy();
    manager.setState({ camera: 'will-not-match' });
    expect(manager.evaluateCondition(condition)).toBeFalsy();
  });

  it('should evaluate conditions with ha state positive check', () => {
    const manager = new ConditionsManager(createCardAPI());
    const condition = {
      state: [
        {
          entity: 'binary_sensor.foo',
          state: 'on',
        },
      ],
    };
    expect(manager.evaluateCondition(condition)).toBeFalsy();
    manager.setState({ state: { 'binary_sensor.foo': createStateEntity() } });
    expect(manager.evaluateCondition(condition)).toBeTruthy();
    manager.setState({
      state: { 'binary_sensor.foo': createStateEntity({ state: 'off' }) },
    });
    expect(manager.evaluateCondition(condition)).toBeFalsy();
  });

  it('should evaluate conditions with ha state negative check', () => {
    const manager = new ConditionsManager(createCardAPI());
    const condition = {
      state: [
        {
          entity: 'binary_sensor.foo',
          state_not: 'on',
        },
      ],
    };
    expect(manager.evaluateCondition(condition)).toBeFalsy();
    manager.setState({ state: { 'binary_sensor.foo': createStateEntity() } });
    expect(manager.evaluateCondition(condition)).toBeFalsy();
    manager.setState({
      state: { 'binary_sensor.foo': createStateEntity({ state: 'off' }) },
    });
    expect(manager.evaluateCondition(condition)).toBeTruthy();
  });

  it('should evaluate conditions with media_loaded', () => {
    const manager = new ConditionsManager(createCardAPI());
    const condition = { media_loaded: true };
    expect(manager.evaluateCondition(condition)).toBeFalsy();
    manager.setState({ media_loaded: true });
    expect(manager.evaluateCondition(condition)).toBeTruthy();
    manager.setState({ media_loaded: false });
    expect(manager.evaluateCondition(condition)).toBeFalsy();
  });

  it('should evaluate conditions with media query', () => {
    vi.spyOn(window, 'matchMedia')
      .mockReturnValueOnce(<MediaQueryList>{ matches: true })
      .mockReturnValueOnce(<MediaQueryList>{ matches: false });

    const manager = new ConditionsManager(createCardAPI());
    const condition = { media_query: 'whatever' };
    expect(manager.evaluateCondition(condition)).toBeTruthy();
    expect(manager.evaluateCondition(condition)).toBeFalsy();
  });

  it('should trigger on changes to media query conditions', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.spyOn(window, 'matchMedia').mockReturnValueOnce({
      matches: true,
      addEventListener: addEventListener,
      removeEventListener: removeEventListener,
    } as unknown as MediaQueryList);
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig(config));
    const callback = vi.fn();
    const manager = new ConditionsManager(api, callback);

    manager.setConditionsFromConfig();

    expect(addEventListener).toHaveBeenCalledWith('change', expect.anything());

    // Call the media query callback and use it to pretend a match happened. The
    // callback is the 0th mock innvocation and the 1st argument.
    addEventListener.mock.calls[0][1]();

    // This should result in a callback to our state listener.
    expect(callback).toBeCalled();

    // Remove the conditions, which should remove the media query listener.
    manager.removeConditions();
    expect(removeEventListener).toBeCalled();
  });

  it('should evaluate conditions with display mode', () => {
    const manager = new ConditionsManager(createCardAPI());
    const condition: FrigateCardCondition = { display_mode: 'grid' };
    expect(manager.evaluateCondition(condition)).toBeFalsy();
    manager.setState({ displayMode: 'grid' });
    expect(manager.evaluateCondition(condition)).toBeTruthy();
    manager.setState({ displayMode: 'single' });
    expect(manager.evaluateCondition(condition)).toBeFalsy();
  });
});
