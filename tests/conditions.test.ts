import { afterEach, describe, it, expect, vi } from 'vitest';
import {
  ConditionController,
  ConditionEvaluateRequestEvent,
  evaluateConditionViaEvent,
  getOverriddenConfig,
  getOverridesByKey,
} from '../src/conditions';
import { createCondition, createConfig, createStateEntity } from './test-utils';

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
    const controller = new ConditionController();
    expect(getOverriddenConfig(controller, config, overrides)).toBe(config);
  });

  it('should override config', () => {
    const controller = new ConditionController();
    controller.setState({ fullscreen: true });

    expect(getOverriddenConfig(controller, config, overrides)).toEqual({
      menu: {
        style: 'above',
      },
    });
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

describe('ConditionController', () => {
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

  it('should add listener', () => {
    const controller = new ConditionController();
    const handler = vi.fn();
    controller.addStateListener(handler);
    controller.setState({ fullscreen: true });
    expect(handler).toBeCalled();
  });

  it('should remove listener', () => {
    const controller = new ConditionController();
    const handler = vi.fn();
    controller.addStateListener(handler);
    controller.removeStateListener(handler);
    controller.setState({ fullscreen: true });
    expect(handler).not.toBeCalled();
  });

  it('should get wrapper', () => {
    const controller = new ConditionController();
    const wrapper_1 = controller.getEpoch();
    expect(wrapper_1).toEqual({ controller: controller });

    controller.setState({ fullscreen: true });

    const wrapper_2 = controller.getEpoch();
    expect(wrapper_2).toEqual({ controller: controller });

    // Since the state was set the wrappers should be different.
    expect(wrapper_1).not.toBe(wrapper_2);
  });

  it('should not return hasHAStateConditions without HA state conditions', () => {
    const controller = new ConditionController();
    expect(controller.hasHAStateConditions).toBeFalsy();
  });

  it('should return hasHAStateConditions with HA state conditions', () => {
    vi.spyOn(window, 'matchMedia').mockReturnValueOnce({
      matches: false,
      addEventListener: vi.fn(),
    } as unknown as MediaQueryList);
    const controller = new ConditionController(createConfig(config));
    expect(controller.hasHAStateConditions).toBeTruthy();
  });

  it('should evaluate conditions with a view', () => {
    const controller = new ConditionController();
    const condition = { view: ['foo'] };
    expect(controller.evaluateCondition(condition)).toBeFalsy();
    controller.setState({ view: 'foo' });
    expect(controller.evaluateCondition(condition)).toBeTruthy();
  });

  it('should evaluate conditions with fullscreen', () => {
    const controller = new ConditionController();
    const condition = { fullscreen: true };
    expect(controller.evaluateCondition(condition)).toBeFalsy();
    controller.setState({ fullscreen: true });
    expect(controller.evaluateCondition(condition)).toBeTruthy();
    controller.setState({ fullscreen: false });
    expect(controller.evaluateCondition(condition)).toBeFalsy();
  });

  it('should evaluate conditions with expand', () => {
    const controller = new ConditionController();
    const condition = { expand: true };
    expect(controller.evaluateCondition(condition)).toBeFalsy();
    controller.setState({ expand: true });
    expect(controller.evaluateCondition(condition)).toBeTruthy();
    controller.setState({ expand: false });
    expect(controller.evaluateCondition(condition)).toBeFalsy();
  });

  it('should evaluate conditions with camera', () => {
    const controller = new ConditionController();
    const condition = { camera: ['bar'] };
    expect(controller.evaluateCondition(condition)).toBeFalsy();
    controller.setState({ camera: 'bar' });
    expect(controller.evaluateCondition(condition)).toBeTruthy();
    controller.setState({ camera: 'will-not-match' });
    expect(controller.evaluateCondition(condition)).toBeFalsy();
  });

  it('should evaluate conditions with ha state positive check', () => {
    const controller = new ConditionController();
    const condition = {
      state: [
        {
          entity: 'binary_sensor.foo',
          state: 'on',
        },
      ],
    };
    expect(controller.evaluateCondition(condition)).toBeFalsy();
    controller.setState({ state: { 'binary_sensor.foo': createStateEntity() } });
    expect(controller.evaluateCondition(condition)).toBeTruthy();
    controller.setState({
      state: { 'binary_sensor.foo': createStateEntity({ state: 'off' }) },
    });
    expect(controller.evaluateCondition(condition)).toBeFalsy();
  });

  it('should evaluate conditions with ha state negative check', () => {
    const controller = new ConditionController();
    const condition = {
      state: [
        {
          entity: 'binary_sensor.foo',
          state_not: 'on',
        },
      ],
    };
    expect(controller.evaluateCondition(condition)).toBeFalsy();
    controller.setState({ state: { 'binary_sensor.foo': createStateEntity() } });
    expect(controller.evaluateCondition(condition)).toBeFalsy();
    controller.setState({
      state: { 'binary_sensor.foo': createStateEntity({ state: 'off' }) },
    });
    expect(controller.evaluateCondition(condition)).toBeTruthy();
  });

  it('should evaluate conditions with media_loaded', () => {
    const controller = new ConditionController();
    const condition = { media_loaded: true };
    expect(controller.evaluateCondition(condition)).toBeFalsy();
    controller.setState({ media_loaded: true });
    expect(controller.evaluateCondition(condition)).toBeTruthy();
    controller.setState({ media_loaded: false });
    expect(controller.evaluateCondition(condition)).toBeFalsy();
  });

  it('should evaluate conditions with media query', () => {
    vi.spyOn(window, 'matchMedia')
      .mockReturnValueOnce(<MediaQueryList>{ matches: true })
      .mockReturnValueOnce(<MediaQueryList>{ matches: false });

    const controller = new ConditionController();
    const condition = { media_query: 'whatever' };
    expect(controller.evaluateCondition(condition)).toBeTruthy();
    expect(controller.evaluateCondition(condition)).toBeFalsy();
  });

  it('should trigger on changes to media query conditions', () => {
    const addEventListener = vi.fn();
    const removeEventListener = vi.fn();
    vi.spyOn(window, 'matchMedia').mockReturnValueOnce({
      matches: true,
      addEventListener: addEventListener,
      removeEventListener: removeEventListener,
    } as unknown as MediaQueryList);

    const controller = new ConditionController(createConfig(config));
    expect(addEventListener).toHaveBeenCalledWith('change', expect.anything());

    const callback = vi.fn();
    controller.addStateListener(callback);

    // Call the media query callback and use it to pretend a match happened. The
    // callback is the 0th mock innvocation and the 1st argument.
    addEventListener.mock.calls[0][1]();

    // This should result in a callback to our state listener.
    expect(callback).toBeCalled();

    // Destroy the controller, which should remove the media query listener.
    controller.destroy();
    expect(removeEventListener).toBeCalled();
  });
});
