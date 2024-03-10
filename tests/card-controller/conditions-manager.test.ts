import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FrigateCardCondition } from '../../src/config/types';
import {
  ConditionEvaluateRequestEvent,
  ConditionsManager,
  evaluateConditionViaEvent,
  getOverriddenConfig,
  getOverridesByKey,
} from '../../src/card-controller/conditions-manager';
import {
  createCardAPI,
  createCondition,
  createConfig,
  createStateEntity,
  createUser,
} from '../test-utils';

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

  it('should get state', () => {
    const state = { fullscreen: true };

    const manager = new ConditionsManager(createCardAPI());
    manager.setState(state);
    expect(manager.getState()).toEqual(state);
  });

  describe('should handle hasHAStateConditions', () => {
    beforeEach(() => {
      vi.spyOn(window, 'matchMedia').mockReturnValueOnce({
        matches: false,
        addEventListener: vi.fn(),
      } as unknown as MediaQueryList);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    const createSuitableConfig = (conditions: FrigateCardCondition) => {
      return createConfig({
        overrides: [
          {
            overrides: {},
            conditions: conditions,
          },
        ],
      });
    };

    it('without HA state conditions', () => {
      const manager = new ConditionsManager(createCardAPI());
      expect(manager.hasHAStateConditions()).toBeFalsy();
    });

    it('with HA state conditions', () => {
      const api = createCardAPI();
      const numericConfig = createSuitableConfig({
        state: [
          {
            condition: 'state',
            entity: 'binary_sensor.foo',
            state: 'on',
          },
        ],
      });
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(numericConfig);
      const manager = new ConditionsManager(api);
      manager.setConditionsFromConfig();

      expect(manager.hasHAStateConditions()).toBeTruthy();
    });

    it('with HA numeric_state conditions', () => {
      const api = createCardAPI();
      const stateConfig = createSuitableConfig({
        numeric_state: [
          {
            entity: 'sensor.foo',
            condition: 'numeric_state' as const,
            above: 10,
          },
        ],
      });
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(stateConfig);
      const manager = new ConditionsManager(api);
      manager.setConditionsFromConfig();

      expect(manager.hasHAStateConditions()).toBeTruthy();
    });

    it('with HA user conditions', () => {
      const api = createCardAPI();
      const userConfig = createSuitableConfig({
        users: ['user_1'],
      });
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(userConfig);
      const manager = new ConditionsManager(api);
      manager.setConditionsFromConfig();

      expect(manager.hasHAStateConditions()).toBeTruthy();
    });
  });

  describe('should evaluate conditions', () => {
    it('with a view', () => {
      const manager = new ConditionsManager(createCardAPI());
      const condition = { view: ['foo'] };
      expect(manager.evaluateCondition(condition)).toBeFalsy();
      manager.setState({ view: 'foo' });
      expect(manager.evaluateCondition(condition)).toBeTruthy();
    });

    it('with fullscreen', () => {
      const manager = new ConditionsManager(createCardAPI());
      const condition = { fullscreen: true };
      expect(manager.evaluateCondition(condition)).toBeFalsy();
      manager.setState({ fullscreen: true });
      expect(manager.evaluateCondition(condition)).toBeTruthy();
      manager.setState({ fullscreen: false });
      expect(manager.evaluateCondition(condition)).toBeFalsy();
    });

    it('with expand', () => {
      const manager = new ConditionsManager(createCardAPI());
      const condition = { expand: true };
      expect(manager.evaluateCondition(condition)).toBeFalsy();
      manager.setState({ expand: true });
      expect(manager.evaluateCondition(condition)).toBeTruthy();
      manager.setState({ expand: false });
      expect(manager.evaluateCondition(condition)).toBeFalsy();
    });

    it('camera', () => {
      const manager = new ConditionsManager(createCardAPI());
      const condition = { camera: ['bar'] };
      expect(manager.evaluateCondition(condition)).toBeFalsy();
      manager.setState({ camera: 'bar' });
      expect(manager.evaluateCondition(condition)).toBeTruthy();
      manager.setState({ camera: 'will-not-match' });
      expect(manager.evaluateCondition(condition)).toBeFalsy();
    });

    describe('with stock HA conditions', () => {
      describe('state check', () => {
        describe('positive', () => {
          it('single', () => {
            const manager = new ConditionsManager(createCardAPI());
            const condition = {
              state: [
                {
                  condition: 'state' as const,
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

          it('multiple', () => {
            const manager = new ConditionsManager(createCardAPI());
            const condition = {
              state: [
                {
                  condition: 'state' as const,
                  entity: 'binary_sensor.foo',
                  state: ['active', 'on'],
                },
              ],
            };
            expect(manager.evaluateCondition(condition)).toBeFalsy();
            manager.setState({ state: { 'binary_sensor.foo': createStateEntity() } });
            expect(manager.evaluateCondition(condition)).toBeTruthy();
            manager.setState({
              state: { 'binary_sensor.foo': createStateEntity({ state: 'active' }) },
            });
            expect(manager.evaluateCondition(condition)).toBeTruthy();
            manager.setState({
              state: { 'binary_sensor.foo': createStateEntity({ state: 'off' }) },
            });
            expect(manager.evaluateCondition(condition)).toBeFalsy();
          });
        });

        describe('negative', () => {
          it('single', () => {
            const manager = new ConditionsManager(createCardAPI());
            const condition = {
              state: [
                {
                  condition: 'state' as const,
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
        });

        it('multiple', () => {
          const manager = new ConditionsManager(createCardAPI());
          const condition = {
            state: [
              {
                condition: 'state' as const,
                entity: 'binary_sensor.foo',
                state_not: ['active', 'on'],
              },
            ],
          };
          expect(manager.evaluateCondition(condition)).toBeFalsy();
          manager.setState({ state: { 'binary_sensor.foo': createStateEntity() } });
          expect(manager.evaluateCondition(condition)).toBeFalsy();
          manager.setState({
            state: { 'binary_sensor.foo': createStateEntity({ state: 'active' }) },
          });
          expect(manager.evaluateCondition(condition)).toBeFalsy();
          manager.setState({
            state: { 'binary_sensor.foo': createStateEntity({ state: 'off' }) },
          });
          expect(manager.evaluateCondition(condition)).toBeTruthy();
        });
      });

      describe('numeric state check', () => {
        it('above', () => {
          const manager = new ConditionsManager(createCardAPI());
          const condition = {
            numeric_state: [
              {
                condition: 'numeric_state' as const,
                entity: 'sensor.foo',
                above: 10,
              },
            ],
          };
          expect(manager.evaluateCondition(condition)).toBeFalsy();
          manager.setState({
            state: { 'sensor.foo': createStateEntity({ state: '11' }) },
          });
          expect(manager.evaluateCondition(condition)).toBeTruthy();
          manager.setState({
            state: { 'binary_sensor.foo': createStateEntity({ state: '9' }) },
          });
          expect(manager.evaluateCondition(condition)).toBeFalsy();
        });

        it('below', () => {
          const manager = new ConditionsManager(createCardAPI());
          const condition = {
            numeric_state: [
              {
                condition: 'numeric_state' as const,
                entity: 'sensor.foo',
                below: 10,
              },
            ],
          };
          expect(manager.evaluateCondition(condition)).toBeFalsy();
          manager.setState({
            state: { 'sensor.foo': createStateEntity({ state: '11' }) },
          });
          expect(manager.evaluateCondition(condition)).toBeFalsy();
          manager.setState({
            state: { 'sensor.foo': createStateEntity({ state: '9' }) },
          });
          expect(manager.evaluateCondition(condition)).toBeTruthy();
        });
      });
    });

    it('with users', () => {
      const manager = new ConditionsManager(createCardAPI());
      const condition = {
        users: ['user_1', 'user_2'],
      };
      expect(manager.evaluateCondition(condition)).toBeFalsy();
      manager.setState({
        user: createUser({ id: 'user_1' }),
      });
      expect(manager.evaluateCondition(condition)).toBeTruthy();
      manager.setState({
        user: createUser({ id: 'user_WRONG' }),
      });
      expect(manager.evaluateCondition(condition)).toBeFalsy();
    });

    it('with media_loaded', () => {
      const manager = new ConditionsManager(createCardAPI());
      const condition = { media_loaded: true };
      expect(manager.evaluateCondition(condition)).toBeFalsy();
      manager.setState({ media_loaded: true });
      expect(manager.evaluateCondition(condition)).toBeTruthy();
      manager.setState({ media_loaded: false });
      expect(manager.evaluateCondition(condition)).toBeFalsy();
    });

    describe('with media query', () => {
      const mediaQueryConfig = {
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
      };

      it('on evaluation', () => {
        vi.spyOn(window, 'matchMedia')
          .mockReturnValueOnce(<MediaQueryList>{ matches: true })
          .mockReturnValueOnce(<MediaQueryList>{ matches: false });

        const manager = new ConditionsManager(createCardAPI());
        const condition = { media_query: 'whatever' };
        expect(manager.evaluateCondition(condition)).toBeTruthy();
        expect(manager.evaluateCondition(condition)).toBeFalsy();
      });

      it('on trigger', () => {
        const addEventListener = vi.fn();
        const removeEventListener = vi.fn();
        vi.spyOn(window, 'matchMedia').mockReturnValueOnce({
          matches: true,
          addEventListener: addEventListener,
          removeEventListener: removeEventListener,
        } as unknown as MediaQueryList);
        const api = createCardAPI();
        vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
          createConfig(mediaQueryConfig),
        );
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
    });

    it('with display mode', () => {
      const manager = new ConditionsManager(createCardAPI());
      const condition: FrigateCardCondition = { display_mode: 'grid' };
      expect(manager.evaluateCondition(condition)).toBeFalsy();
      manager.setState({ displayMode: 'grid' });
      expect(manager.evaluateCondition(condition)).toBeTruthy();
      manager.setState({ displayMode: 'single' });
      expect(manager.evaluateCondition(condition)).toBeFalsy();
    });

    it('with triggers', () => {
      const manager = new ConditionsManager(createCardAPI());
      const condition: FrigateCardCondition = { triggered: ['camera_1', 'camera_2'] };
      expect(manager.evaluateCondition(condition)).toBeFalsy();
      manager.setState({ triggered: new Set(['camera_1']) });
      expect(manager.evaluateCondition(condition)).toBeTruthy();
      manager.setState({ triggered: new Set(['camera_2', 'camera_1', 'camera_3']) });
      expect(manager.evaluateCondition(condition)).toBeTruthy();
      manager.setState({ triggered: new Set(['camera_3']) });
      expect(manager.evaluateCondition(condition)).toBeFalsy();
    });

    it('with interaction', () => {
      const manager = new ConditionsManager(createCardAPI());
      const condition: FrigateCardCondition = { interaction: true };
      expect(manager.evaluateCondition(condition)).toBeFalsy();
      manager.setState({ interaction: true });
      expect(manager.evaluateCondition(condition)).toBeTruthy();
      manager.setState({ interaction: false });
      expect(manager.evaluateCondition(condition)).toBeFalsy();
    });

    describe('with microphone', () => {
      it('empty', () => {
        const manager = new ConditionsManager(createCardAPI());
        const condition: FrigateCardCondition = { microphone: {} };
        expect(manager.evaluateCondition(condition)).toBeTruthy();
        manager.setState({ microphone: { connected: true } });
        expect(manager.evaluateCondition(condition)).toBeTruthy();
        manager.setState({ microphone: { connected: false } });
        expect(manager.evaluateCondition(condition)).toBeTruthy();
        manager.setState({ microphone: { muted: true } });
        expect(manager.evaluateCondition(condition)).toBeTruthy();
        manager.setState({ microphone: { muted: false } });
        expect(manager.evaluateCondition(condition)).toBeTruthy();
      });

      it('connected is true', () => {
        const manager = new ConditionsManager(createCardAPI());
        const condition: FrigateCardCondition = { microphone: { connected: true } };
        expect(manager.evaluateCondition(condition)).toBeFalsy();
        manager.setState({ microphone: { connected: true } });
        expect(manager.evaluateCondition(condition)).toBeTruthy();
        manager.setState({ microphone: { connected: false } });
        expect(manager.evaluateCondition(condition)).toBeFalsy();
      });

      it('connected is false', () => {
        const manager = new ConditionsManager(createCardAPI());
        const condition: FrigateCardCondition = { microphone: { connected: false } };
        expect(manager.evaluateCondition(condition)).toBeFalsy();
        manager.setState({ microphone: { connected: true } });
        expect(manager.evaluateCondition(condition)).toBeFalsy();
        manager.setState({ microphone: { connected: false } });
        expect(manager.evaluateCondition(condition)).toBeTruthy();
      });

      it('muted is true', () => {
        const manager = new ConditionsManager(createCardAPI());
        const condition: FrigateCardCondition = { microphone: { muted: true } };
        expect(manager.evaluateCondition(condition)).toBeFalsy();
        manager.setState({ microphone: { muted: true } });
        expect(manager.evaluateCondition(condition)).toBeTruthy();
        manager.setState({ microphone: { muted: false } });
        expect(manager.evaluateCondition(condition)).toBeFalsy();
      });

      it('muted is false', () => {
        const manager = new ConditionsManager(createCardAPI());
        const condition: FrigateCardCondition = { microphone: { muted: false } };
        expect(manager.evaluateCondition(condition)).toBeFalsy();
        manager.setState({ microphone: { muted: true } });
        expect(manager.evaluateCondition(condition)).toBeFalsy();
        manager.setState({ microphone: { muted: false } });
        expect(manager.evaluateCondition(condition)).toBeTruthy();
      });

      it('connected and muted', () => {
        const manager = new ConditionsManager(createCardAPI());
        const condition: FrigateCardCondition = {
          microphone: { muted: false, connected: true },
        };
        expect(manager.evaluateCondition(condition)).toBeFalsy();
        manager.setState({ microphone: { muted: true } });
        expect(manager.evaluateCondition(condition)).toBeFalsy();
        manager.setState({ microphone: { muted: false } });
        expect(manager.evaluateCondition(condition)).toBeFalsy();
        manager.setState({ microphone: { connected: false, muted: false } });
        expect(manager.evaluateCondition(condition)).toBeFalsy();
        manager.setState({ microphone: { connected: true, muted: false } });
        expect(manager.evaluateCondition(condition)).toBeTruthy();
      });
    });
  });
});
