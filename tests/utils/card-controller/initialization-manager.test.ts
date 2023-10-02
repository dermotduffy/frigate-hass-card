import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { loadLanguages } from '../../../src/localize/localize';
import {
  InitializationAspect,
  InitializationManager,
} from '../../../src/utils/card-controller/initialization-manager';
import { sideLoadHomeAssistantElements } from '../../../src/utils/ha';
import { Initializer } from '../../../src/utils/initializer/initializer';
import { createCardAPI, createConfig, createHASS } from '../../test-utils';

vi.mock('../../../src/localize/localize.js');
vi.mock('../../../src/utils/ha/index.js');

// @vitest-environment jsdom
describe('InitializationManager', () => {
  beforeEach(async () => {
    vi.resetAllMocks();
  });

  it('should not be initialized', () => {
    const manager = new InitializationManager(createCardAPI());
    expect(manager.isInitializedMandatory()).toBeFalsy();
  });

  describe('should initialize mandatory', () => {
    it('without hass', async () => {
      const manager = new InitializationManager(createCardAPI());
      expect(await manager.initializeMandatory()).toBeFalsy();
    });

    it('without config', async () => {
      const api = createCardAPI();
      const manager = new InitializationManager(api);
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      expect(await manager.initializeMandatory()).toBeFalsy();
    });

    it('successfully', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().hasConfig).mockReturnValue(true);
      vi.mocked(api.getMessageManager().hasMessage).mockReturnValue(false);
      vi.mocked(api.getQueryStringManager().hasViewRelatedActions).mockReturnValue(false);
      const manager = new InitializationManager(api);

      expect(await manager.initializeMandatory()).toBeTruthy();

      expect(loadLanguages).toBeCalled();
      expect(sideLoadHomeAssistantElements).toBeCalled();
      expect(api.getCameraManager().initializeCamerasFromConfig).toBeCalled();
      expect(api.getViewManager().setViewDefault).toBeCalled();
      expect(api.getCardElementManager().update).toBeCalled();
    });

    it('successfully with querystring view', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().hasConfig).mockReturnValue(true);
      vi.mocked(api.getMessageManager().hasMessage).mockReturnValue(false);
      vi.mocked(api.getQueryStringManager().hasViewRelatedActions).mockReturnValue(true);
      const manager = new InitializationManager(api);

      expect(await manager.initializeMandatory()).toBeTruthy();

      expect(api.getQueryStringManager().executeViewRelated).toBeCalled();
    });

    it('with message set during initialization', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().hasConfig).mockReturnValue(true);
      vi.mocked(api.getMessageManager().hasMessage).mockReturnValue(true);
      vi.mocked(api.getQueryStringManager().hasViewRelatedActions).mockReturnValue(false);
      const manager = new InitializationManager(api);

      expect(await manager.initializeMandatory()).toBeTruthy();

      expect(api.getViewManager().setViewByParameters).not.toBeCalled();
      expect(api.getViewManager().setViewDefault).not.toBeCalled();
    });

    it('with languages and side load elements in progress', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);
      initializer.initializeMultipleIfNecessary.mockResolvedValue(false);

      expect(await manager.initializeMandatory()).toBeFalsy();
    });

    it('with cameras in progress', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().hasConfig).mockReturnValue(true);

      const initializer = mock<Initializer>();
      const manager = new InitializationManager(api, initializer);
      initializer.initializeMultipleIfNecessary.mockResolvedValue(true);
      initializer.initializeIfNecessary.mockResolvedValue(false);

      expect(await manager.initializeMandatory()).toBeFalsy();
    });
  });

  describe('should initialize background', () => {
    it('without hass and config', async () => {
      const manager = new InitializationManager(createCardAPI());
      expect(await manager.initializeBackgroundIfNecessary()).toBeFalsy();
    });

    it('successfully with minimal initializers', async () => {
      const api = createCardAPI();
      const manager = new InitializationManager(api);
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          menu: {
            buttons: {
              media_player: {
                enabled: false,
              },
            },
          },
          live: {
            microphone: {
              always_connected: false,
            },
          },
        }),
      );

      expect(await manager.initializeBackgroundIfNecessary()).toBeTruthy();
      expect(api.getMediaPlayerManager().initialize).not.toBeCalled();
      expect(api.getMicrophoneManager().connect).not.toBeCalled();
      expect(api.getCardElementManager().update).not.toBeCalled();
    });

    it('successfully with all inititalizers', async () => {
      const api = createCardAPI();
      const manager = new InitializationManager(api);
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          menu: {
            buttons: {
              media_player: {
                enabled: true,
              },
            },
          },
          live: {
            microphone: {
              always_connected: true,
            },
          },
        }),
      );

      expect(await manager.initializeBackgroundIfNecessary()).toBeTruthy();
      expect(api.getMediaPlayerManager().initialize).toBeCalled();
      expect(api.getMicrophoneManager().connect).toBeCalled();
      expect(api.getCardElementManager().update).toBeCalled();
    });

    it('with media player and microphone connect in progress', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          menu: {
            buttons: {
              media_player: {
                enabled: true,
              },
            },
          },
          live: {
            microphone: {
              always_connected: true,
            },
          },
        }),
      );
      const initializer = mock<Initializer>();

      const manager = new InitializationManager(api, initializer);
      initializer.initializeMultipleIfNecessary.mockResolvedValue(false);

      expect(await manager.initializeBackgroundIfNecessary()).toBeFalsy();
    });
  });

  it('should uninitialize', () => {
    const initializer = mock<Initializer>();
    const manager = new InitializationManager(createCardAPI(), initializer);

    manager.uninitialize(InitializationAspect.CAMERAS);

    expect(initializer.uninitialize).toBeCalledWith(InitializationAspect.CAMERAS);
  });
});
