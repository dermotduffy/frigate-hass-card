import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HASSManager } from '../../../src/card-controller/hass/hass-manager';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import {
  createCameraConfig,
  createCameraManager,
  createCardAPI,
  createConfig,
  createHASS,
  createStateEntity,
  createStore,
  createUser,
  createView,
} from '../../test-utils';

describe('HASSManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should have null hass on construction', () => {
    const manager = new HASSManager(createCardAPI());
    expect(manager.getHASS()).toBeNull();
    expect(manager.hasHASS()).toBeFalsy();
  });

  it('should get state watcher', () => {
    const manager = new HASSManager(createCardAPI());
    expect(manager.getStateWatcher()).toEqual(expect.any(StateWatcher));
  });

  it('should get hass after set', () => {
    const manager = new HASSManager(createCardAPI());
    const hass = createHASS();
    manager.setHASS(hass);

    expect(manager.getHASS()).toBe(hass);
    expect(manager.hasHASS()).toBeTruthy();
  });

  it('should set light or dark mode upon setting hass', () => {
    const api = createCardAPI();
    const manager = new HASSManager(api);

    manager.setHASS(createHASS());

    expect(api.getStyleManager().setLightOrDarkMode).toBeCalled();
  });

  describe('should set condition manager state', () => {
    it('positively', () => {
      const api = createCardAPI();
      const manager = new HASSManager(api);
      vi.mocked(api.getConditionsManager().hasHAStateConditions).mockReturnValue(true);

      const states = { 'switch.foo': createStateEntity() };
      const user = createUser({ id: 'user_1' });
      const hass = createHASS(states, user);

      manager.setHASS(hass);

      expect(api.getConditionsManager().setState).toBeCalledWith(
        expect.objectContaining({
          state: states,
          user: user,
        }),
      );
    });

    it('negatively', () => {
      const api = createCardAPI();
      const manager = new HASSManager(api);
      vi.mocked(api.getConditionsManager().hasHAStateConditions).mockReturnValue(false);

      manager.setHASS(createHASS());

      expect(api.getConditionsManager().setState).not.toBeCalled();
    });
  });

  describe('should handle connection state change when', () => {
    it('initially disconnected', () => {
      const api = createCardAPI();
      const manager = new HASSManager(api);

      const disconnectedHASS = createHASS();
      disconnectedHASS.connected = false;

      manager.setHASS(disconnectedHASS);

      expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalledWith(
        expect.objectContaining({
          message: 'Reconnecting',
          icon: 'mdi:lan-disconnect',
          type: 'connection',
          dotdotdot: true,
        }),
      );
    });

    it('disconnected', () => {
      const api = createCardAPI();
      const manager = new HASSManager(api);

      manager.setHASS(createHASS());

      const disconnectedHASS = createHASS();
      disconnectedHASS.connected = false;
      manager.setHASS(disconnectedHASS);

      expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalledWith(
        expect.objectContaining({
          message: 'Reconnecting',
          icon: 'mdi:lan-disconnect',
          type: 'connection',
          dotdotdot: true,
        }),
      );
    });

    it('reconnected', () => {
      const api = createCardAPI();
      const manager = new HASSManager(api);

      const disconnectedHASS = createHASS();
      disconnectedHASS.connected = false;
      manager.setHASS(disconnectedHASS);

      const reconnectedHASS = createHASS();
      manager.setHASS(reconnectedHASS);

      expect(api.getMessageManager().resetType).toBeCalled();
    });

    it('hass is null', () => {
      const api = createCardAPI();
      const manager = new HASSManager(api);
      const connectedHASS = createHASS();
      connectedHASS.connected = true;

      manager.setHASS(connectedHASS);
      manager.setHASS(null);

      expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalledWith(
        expect.objectContaining({
          message: 'Reconnecting',
          icon: 'mdi:lan-disconnect',
          type: 'connection',
          dotdotdot: true,
        }),
      );

      manager.setHASS(connectedHASS);
      expect(api.getMessageManager().resetType).toBeCalled();
    });
  });

  describe('should not set default view when', () => {
    it('selected camera is unknown', () => {
      const api = createCardAPI();
      vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera.foo',
            config: createCameraConfig({
              triggers: {
                entities: ['binary_sensor.motion'],
              },
            }),
          },
        ]),
      );
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({
          camera: 'camera.UNKNOWN',
        }),
      );

      const manager = new HASSManager(api);
      const hass = createHASS({
        'binary_sensor.motion': createStateEntity(),
      });

      manager.setHASS(hass);

      expect(api.getViewManager().setViewDefault).not.toBeCalled();
    });

    it('when there is card interaction', () => {
      const api = createCardAPI();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            default_reset: {
              entities: ['sensor.force_default_view'],
            },
          },
        }),
      );
      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(true);

      const manager = new HASSManager(api);
      const hass = createHASS({
        'sensor.force_default_view': createStateEntity(),
      });

      manager.setHASS(hass);

      expect(api.getViewManager().setViewDefault).not.toBeCalled();
    });
  });
});
