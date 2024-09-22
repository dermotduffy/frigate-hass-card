import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ZodError } from 'zod';
import { getOverriddenConfig } from '../../../src/card-controller/conditions-manager';
import { ConfigManager } from '../../../src/card-controller/config/config-manager';
import { InitializationAspect } from '../../../src/card-controller/initialization-manager';
import { frigateCardConfigSchema } from '../../../src/config/types';
import { createCardAPI, createConfig, flushPromises } from '../../test-utils';

vi.mock('../../../src/card-controller/conditions-manager.js');

describe('ConfigManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('should handle error when', () => {
    it('no input', () => {
      const manager = new ConfigManager(createCardAPI());
      expect(() => manager.setConfig()).toThrowError(/Invalid configuration/);
    });

    it('invalid configuration', () => {
      const spy = vi.spyOn(frigateCardConfigSchema, 'safeParse').mockReturnValue({
        success: false,
        error: new ZodError([]),
      });

      const manager = new ConfigManager(createCardAPI());
      expect(() => manager.setConfig({})).toThrowError(
        'Invalid configuration: No location hint available (bad or missing type?)',
      );

      spy.mockRestore();
    });

    it('invalid configuration with hint', () => {
      const manager = new ConfigManager(createCardAPI());
      expect(() => manager.setConfig({})).toThrowError(
        'Invalid configuration: [\n "cameras",\n "type"\n]',
      );
    });

    it('upgradeable', () => {
      const manager = new ConfigManager(createCardAPI());
      expect(() =>
        manager.setConfig({
          cameras: [
            {
              frigate: {
                label: 'foo',
              },
            },
          ],
        }),
      ).toThrowError(
        'An automated card configuration upgrade is ' +
          'available, please visit the visual card editor. ' +
          'Invalid configuration: [\n "type"\n]',
      );
    });
  });

  it('should have initial state', () => {
    const manager = new ConfigManager(createCardAPI());

    expect(manager.getConfig()).toBeNull();
    expect(manager.getNonOverriddenConfig()).toBeNull();
    expect(manager.getRawConfig()).toBeNull();
  });

  it('should successfully parse basic config', () => {
    const api = createCardAPI();
    const manager = new ConfigManager(api);
    const config = {
      type: 'custom:frigate-card',
      cameras: [{ camera_entity: 'camera.office' }],
    };

    manager.setConfig(config);

    expect(manager.hasConfig()).toBeTruthy();
    expect(manager.getRawConfig()).toBe(config);

    // Verify at least the camera is set.
    expect(manager.getConfig()?.cameras[0].camera_entity).toBe('camera.office');

    // Verify at least one default was set.
    expect(manager.getConfig()?.menu.alignment).toBe('left');

    // Verify appropriate API calls are made.
    expect(api.getConditionsManager().setConditionsFromConfig).toBeCalled();
    expect(api.getConditionsManager().setState).toBeCalledWith({
      view: undefined,
      displayMode: undefined,
      camera: undefined,
    });
    expect(api.getMediaLoadedInfoManager().clear).toBeCalled();
    expect(api.getViewManager().reset).toBeCalled();
    expect(api.getMessageManager().reset).toBeCalled();
    expect(api.getAutomationsManager().addAutomations).toBeCalled();
    expect(api.getStyleManager().setPerformance).toBeCalled();
    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should apply profiles', () => {
    const manager = new ConfigManager(createCardAPI());
    const config = {
      type: 'custom:frigate-card',
      cameras: [{ camera_entity: 'camera.office' }],
      profiles: ['low-performance'],
    };

    manager.setConfig(config);

    // Verify at least one low performance default.
    expect(manager.getConfig()?.live.draggable).toBeFalsy();
  });

  it('should skip identical configs', () => {
    const api = createCardAPI();
    const manager = new ConfigManager(api);
    const config = {
      type: 'custom:frigate-card',
      cameras: [{ camera_entity: 'camera.office' }],
    };

    manager.setConfig(config);
    expect(api.getViewManager().reset).toBeCalled();

    vi.mocked(api.getViewManager().reset).mockClear();

    manager.setConfig(config);
    expect(api.getViewManager().reset).not.toBeCalled();
  });

  it('should get card wide config', () => {
    const api = createCardAPI();
    const manager = new ConfigManager(api);
    const config = {
      type: 'custom:frigate-card',
      cameras: [{ camera_entity: 'camera.office' }],
      debug: {
        logging: true,
      },
      performance: {
        style: {
          box_shadow: false,
        },
      },
    };

    manager.setConfig(config);

    expect(manager.getCardWideConfig()).toEqual({
      debug: {
        logging: true,
      },
      performance: {
        features: {
          animated_progress_indicator: true,
          media_chunk_size: 50,
        },
        style: {
          border_radius: true,
          box_shadow: false,
        },
      },
    });
  });

  it('should ignore overrides without a config', () => {
    const api = createCardAPI();
    const manager = new ConfigManager(api);

    manager.computeOverrideConfig();

    expect(manager.getConfig()).toBeNull();
    expect(api.getStyleManager().setMinMaxHeight).not.toBeCalled();
  });

  it('should ignore overrides with same config', () => {
    const api = createCardAPI();
    const manager = new ConfigManager(api);
    const config = {
      type: 'custom:frigate-card',
      cameras: [{ camera_entity: 'camera.office' }],
    };
    vi.mocked(getOverriddenConfig).mockReturnValue(config);

    manager.setConfig(config);
    expect(api.getStyleManager().setMinMaxHeight).toBeCalled();

    vi.mocked(api.getStyleManager().setMinMaxHeight).mockClear();
    manager.computeOverrideConfig();

    expect(api.getStyleManager().setMinMaxHeight).not.toBeCalled();
  });

  it('should override', () => {
    const api = createCardAPI();
    const manager = new ConfigManager(api);
    const config_1 = {
      type: 'custom:frigate-card',
      cameras: [{ camera_entity: 'camera.office' }],
    };
    manager.setConfig(config_1);
    vi.mocked(api.getStyleManager().setMinMaxHeight).mockClear();

    const config_2 = {
      type: 'custom:frigate-card',
      cameras: [{ camera_entity: 'camera.kitchen' }],
    };
    vi.mocked(getOverriddenConfig).mockReturnValue(config_2);
    manager.computeOverrideConfig();

    expect(api.getStyleManager().setMinMaxHeight).toBeCalled();
    expect(api.getCardElementManager().update).toBeCalled();
    expect(manager.getConfig()).not.toEqual(manager.getNonOverriddenConfig());
  });

  it('should set error on invalid override', () => {
    const api = createCardAPI();
    const manager = new ConfigManager(api);
    manager.setConfig({
      type: 'custom:frigate-card',
      cameras: [{ camera_entity: 'camera.office' }],
    });

    const error = new Error('Invalid override configuration');
    vi.mocked(getOverriddenConfig).mockImplementation(() => {
      throw error;
    });

    manager.computeOverrideConfig();

    expect(api.getMessageManager().setErrorIfHigherPriority).toBeCalledWith(error);
  });

  describe('should uninitialize on override', () => {
    it('cameras', () => {
      const api = createCardAPI();
      const manager = new ConfigManager(api);
      const config_1 = {
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
      };
      vi.mocked(getOverriddenConfig).mockReturnValue(createConfig(config_1));

      manager.setConfig(config_1);
      expect(api.getInitializationManager().uninitialize).toHaveBeenLastCalledWith(
        InitializationAspect.VIEW,
      );

      const config_2 = {
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.kitchen' }],
      };
      vi.mocked(getOverriddenConfig).mockReturnValue(createConfig(config_2));
      manager.computeOverrideConfig();

      expect(api.getInitializationManager().uninitialize).toHaveBeenLastCalledWith(
        InitializationAspect.CAMERAS,
      );
    });

    it('cameras_global', () => {
      const api = createCardAPI();
      const manager = new ConfigManager(api);
      const config_1 = {
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
      };
      vi.mocked(getOverriddenConfig).mockReturnValue(createConfig(config_1));

      manager.setConfig(config_1);
      expect(api.getInitializationManager().uninitialize).toHaveBeenLastCalledWith(
        InitializationAspect.VIEW,
      );

      const config_2 = {
        ...config_1,
        cameras_global: {
          live_provider: 'jsmpeg',
        },
      };
      vi.mocked(getOverriddenConfig).mockReturnValue(createConfig(config_2));
      manager.computeOverrideConfig();

      expect(api.getInitializationManager().uninitialize).toHaveBeenLastCalledWith(
        InitializationAspect.CAMERAS,
      );
    });

    it('live.microphone.always_connected', () => {
      const api = createCardAPI();
      const manager = new ConfigManager(api);
      const config_1 = {
        type: 'custom:frigate-card',
        cameras: [{ camera_entity: 'camera.office' }],
        live: {
          microphone: {
            always_connected: false,
          },
        },
      };
      vi.mocked(getOverriddenConfig).mockReturnValue(createConfig(config_1));

      manager.setConfig(config_1);
      expect(api.getInitializationManager().uninitialize).toHaveBeenLastCalledWith(
        InitializationAspect.VIEW,
      );

      const config_2 = {
        ...config_1,
        live: {
          microphone: {
            always_connected: true,
          },
        },
      };
      vi.mocked(getOverriddenConfig).mockReturnValue(createConfig(config_2));
      manager.computeOverrideConfig();

      expect(api.getInitializationManager().uninitialize).toHaveBeenLastCalledWith(
        InitializationAspect.MICROPHONE_CONNECT,
      );
    });
  });

  it('should initialize background items', async () => {
    const api = createCardAPI();
    const manager = new ConfigManager(api);
    const config = {
      type: 'custom:frigate-card',
      cameras: [{ camera_entity: 'camera.office' }],
    };
    vi.mocked(getOverriddenConfig).mockReturnValue(createConfig(config));

    manager.setConfig(config);

    await flushPromises();

    expect(api.getDefaultManager().initializeIfNecessary).toBeCalledWith(null);
    expect(api.getMediaPlayerManager().initializeIfNecessary).toBeCalledWith(null);
  });
});
