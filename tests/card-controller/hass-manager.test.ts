import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HASSManager } from '../../src/card-controller/hass-manager';
import { CardHASSAPI } from '../../src/card-controller/types';
import {
  createCameraConfig,
  createCameraManager,
  createCardAPI,
  createConfig,
  createHASS,
  createStateEntity,
  createView,
} from '../test-utils';

vi.mock('../../src/camera-manager/manager.js');

const createAPIWithoutMediaPlayers = (): CardHASSAPI => {
  const api = createCardAPI();
  vi.mocked(api.getMediaPlayerManager().getMediaPlayers).mockReturnValue([]);
  return api;
};

describe('HASSManager', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should have null hass on construction', () => {
    const manager = new HASSManager(createCardAPI());
    expect(manager.getHASS()).toBeNull();
  });

  it('should set light or dark mode upon setting hass', () => {
    const api = createAPIWithoutMediaPlayers();
    const manager = new HASSManager(api);

    manager.setHASS(createHASS());

    expect(api.getStyleManager().setLightOrDarkMode).toBeCalled();
  });

  describe('should set condition manager state', () => {
    it('positively', () => {
      const api = createAPIWithoutMediaPlayers();
      const manager = new HASSManager(api);
      vi.mocked(api.getConditionsManager().hasHAStateConditions).mockReturnValue(true);

      const states = { 'switch.foo': createStateEntity() };
      const hass = createHASS(states);

      manager.setHASS(hass);

      expect(api.getConditionsManager().setState).toBeCalledWith(
        expect.objectContaining({
          state: states,
        }),
      );
    });

    it('negatively', () => {
      const api = createAPIWithoutMediaPlayers();
      const manager = new HASSManager(api);
      vi.mocked(api.getConditionsManager().hasHAStateConditions).mockReturnValue(false);

      manager.setHASS(createHASS());

      expect(api.getConditionsManager().setState).not.toBeCalled();
    });
  });

  it('should update triggered cameras', () => {
    const api = createAPIWithoutMediaPlayers();
    const manager = new HASSManager(api);

    const originalHASS = createHASS();
    manager.setHASS(originalHASS);
    expect(api.getTriggersManager().updateTriggeredCameras).toBeCalledWith(null);

    manager.setHASS(createHASS());
    expect(api.getTriggersManager().updateTriggeredCameras).toBeCalledWith(originalHASS);
  });

  describe('should handle connection state change when', () => {
    it('initially disconnected', () => {
      const api = createAPIWithoutMediaPlayers();
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
      const api = createAPIWithoutMediaPlayers();
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
      const api = createAPIWithoutMediaPlayers();
      const manager = new HASSManager(api);

      const disconnectedHASS = createHASS();
      disconnectedHASS.connected = false;
      manager.setHASS(disconnectedHASS);

      const reconnectedHASS = createHASS();
      manager.setHASS(reconnectedHASS);

      expect(api.getViewManager().setViewDefault).toBeCalled();
    });
  });

  describe('should set default view when', () => {
    it('selected camera trigger entity changes', () => {
      const cameraManager = createCameraManager({
        configs: new Map([
          [
            'camera.foo',
            createCameraConfig({
              triggers: {
                entities: ['binary_sensor.motion'],
              },
            }),
          ],
        ]),
      });
      const api = createAPIWithoutMediaPlayers();
      vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({
          camera: 'camera.foo',
        }),
      );

      const manager = new HASSManager(api);
      const hass = createHASS({
        'binary_sensor.motion': createStateEntity(),
      });

      manager.setHASS(hass);

      expect(api.getViewManager().setViewDefault).toBeCalled();
    });

    it('selected camera is unknown', () => {
      const cameraManager = createCameraManager({
        configs: new Map([
          [
            'camera.foo',
            createCameraConfig({
              triggers: {
                entities: ['binary_sensor.motion'],
              },
            }),
          ],
        ]),
      });
      const api = createAPIWithoutMediaPlayers();
      vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);
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

    it('view.update_entities changes', () => {
      const api = createAPIWithoutMediaPlayers();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            update_entities: ['sensor.force_default_view'],
          },
        }),
      );

      const manager = new HASSManager(api);
      const hass = createHASS({
        'sensor.force_default_view': createStateEntity(),
      });

      manager.setHASS(hass);

      expect(api.getViewManager().setViewDefault).toBeCalled();
    });
  });

  describe('should update card when', () => {
    it('render entity changes', () => {
      const api = createAPIWithoutMediaPlayers();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            render_entities: ['sensor.force_update'],
          },
        }),
      );

      const manager = new HASSManager(api);
      const hass = createHASS({
        'sensor.force_update': createStateEntity(),
      });

      manager.setHASS(hass);

      expect(api.getCardElementManager().update).toBeCalled();
    });

    it('media player entity changes', () => {
      const api = createCardAPI();
      vi.mocked(api.getMediaPlayerManager().getMediaPlayers).mockReturnValue([
        'media_player.foo',
      ]);

      const manager = new HASSManager(api);
      const hass = createHASS({
        'media_player.foo': createStateEntity(),
      });

      manager.setHASS(hass);

      expect(api.getCardElementManager().update).toBeCalled();
    });
  });

  it('set view default is not called when there is card interaction', () => {
    const api = createAPIWithoutMediaPlayers();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          update_entities: ['sensor.force_default_view'],
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
