import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraManager } from '../../../src/camera-manager/manager';
import { FrigateCardEditor } from '../../../src/editor';
import { ActionsManager } from '../../../src/utils/card-controller/actions-manager';
import { AutoUpdateManager } from '../../../src/utils/card-controller/auto-update-manager';
import { AutomationsManager } from '../../../src/utils/card-controller/automations-manager';
import { CameraURLManager } from '../../../src/utils/card-controller/camera-url-manager';
import {
  CardElementManager,
  CardHTMLElement,
} from '../../../src/utils/card-controller/card-element-manager';
import { ConditionsManager } from '../../../src/utils/card-controller/conditions-manager';
import { ConfigManager } from '../../../src/utils/card-controller/config-manager';
import { CardController } from '../../../src/utils/card-controller/controller';
import { DownloadManager } from '../../../src/utils/card-controller/download-manager';
import { ExpandManager } from '../../../src/utils/card-controller/expand-manager';
import { FullscreenManager } from '../../../src/utils/card-controller/fullscreen-manager';
import { HASSManager } from '../../../src/utils/card-controller/hass-manager';
import { InitializationManager } from '../../../src/utils/card-controller/initialization-manager';
import { InteractionManager } from '../../../src/utils/card-controller/interaction-manager';
import { MediaLoadedInfoManager } from '../../../src/utils/card-controller/media-info-manager';
import { MediaPlayerManager } from '../../../src/utils/card-controller/media-player-manager';
import { MessageManager } from '../../../src/utils/card-controller/message-manager';
import { MicrophoneManager } from '../../../src/utils/card-controller/microphone-manager';
import { QueryStringManager } from '../../../src/utils/card-controller/query-string-manager';
import { StyleManager } from '../../../src/utils/card-controller/style-manager';
import { TriggersManager } from '../../../src/utils/card-controller/triggers-manager';
import { ViewManager } from '../../../src/utils/card-controller/view-manager';
import { EntityRegistryManager } from '../../../src/utils/ha/entity-registry';
import { ResolvedMediaCache } from '../../../src/utils/ha/resolved-media';

vi.mock('../../../src/camera-manager/manager');
vi.mock('../../../src/utils/card-controller/actions-manager');
vi.mock('../../../src/utils/card-controller/auto-update-manager');
vi.mock('../../../src/utils/card-controller/automations-manager');
vi.mock('../../../src/utils/card-controller/camera-url-manager');
vi.mock('../../../src/utils/card-controller/card-element-manager');
vi.mock('../../../src/utils/card-controller/conditions-manager');
vi.mock('../../../src/utils/card-controller/config-manager');
vi.mock('../../../src/utils/card-controller/download-manager');
vi.mock('../../../src/utils/card-controller/expand-manager');
vi.mock('../../../src/utils/card-controller/fullscreen-manager');
vi.mock('../../../src/utils/card-controller/hass-manager');
vi.mock('../../../src/utils/card-controller/initialization-manager');
vi.mock('../../../src/utils/card-controller/interaction-manager');
vi.mock('../../../src/utils/card-controller/media-info-manager');
vi.mock('../../../src/utils/card-controller/media-player-manager');
vi.mock('../../../src/utils/card-controller/message-manager');
vi.mock('../../../src/utils/card-controller/microphone-manager');
vi.mock('../../../src/utils/card-controller/query-string-manager');
vi.mock('../../../src/utils/card-controller/style-manager');
vi.mock('../../../src/utils/card-controller/triggers-manager');
vi.mock('../../../src/utils/card-controller/view-manager');
vi.mock('../../../src/utils/ha/entity-registry');
vi.mock('../../../src/utils/ha/resolved-media');

const createCardElement = (): CardHTMLElement => {
  const element = document.createElement('div') as unknown as CardHTMLElement;
  element.addController = vi.fn();
  return element;
};

const createController = (): CardController => {
  return new CardController(createCardElement(), vi.fn(), vi.fn(), vi.fn());
};

// @vitest-environment jsdom
describe('CardController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should construct correctly', () => {
    const element = createCardElement();
    const scrollCallback = vi.fn();
    const menuToggleCallback = vi.fn();
    const conditionListener = vi.fn();

    const manager = new CardController(
      element,
      scrollCallback,
      menuToggleCallback,
      conditionListener,
    );

    expect(ConditionsManager).toBeCalledWith(manager, conditionListener);
    expect(CardElementManager).toBeCalledWith(
      manager,
      element,
      scrollCallback,
      menuToggleCallback,
    );
  });

  describe('accessors', () => {
    it('getActionsManager', () => {
      expect(createController().getActionsManager()).toBe(
        vi.mocked(ActionsManager).mock.instances[0],
      );
    });

    it('getAutomationsManager', () => {
      expect(createController().getAutomationsManager()).toBe(
        vi.mocked(AutomationsManager).mock.instances[0],
      );
    });

    it('getAutoUpdateManager', () => {
      expect(createController().getAutoUpdateManager()).toBe(
        vi.mocked(AutoUpdateManager).mock.instances[0],
      );
    });

    it('getCameraManager', () => {
      expect(createController().getCameraManager()).toBe(
        vi.mocked(CameraManager).mock.instances[0],
      );
    });

    it('getCameraURLManager', () => {
      expect(createController().getCameraURLManager()).toBe(
        vi.mocked(CameraURLManager).mock.instances[0],
      );
    });

    it('getCardElementManager', () => {
      expect(createController().getCardElementManager()).toBe(
        vi.mocked(CardElementManager).mock.instances[0],
      );
    });

    it('getConditionsManager', () => {
      expect(createController().getConditionsManager()).toBe(
        vi.mocked(ConditionsManager).mock.instances[0],
      );
    });

    it('getConfigElement', async () => {
      expect((await CardController.getConfigElement()) instanceof FrigateCardEditor);
    });

    it('getConfigManager', () => {
      expect(createController().getConfigManager()).toBe(
        vi.mocked(ConfigManager).mock.instances[0],
      );
    });

    it('getDownloadManager', () => {
      expect(createController().getDownloadManager()).toBe(
        vi.mocked(DownloadManager).mock.instances[0],
      );
    });

    it('getEntityRegistryManager', () => {
      expect(createController().getEntityRegistryManager()).toBe(
        vi.mocked(EntityRegistryManager).mock.instances[0],
      );
    });

    it('getExpandManager', () => {
      expect(createController().getExpandManager()).toBe(
        vi.mocked(ExpandManager).mock.instances[0],
      );
    });

    it('getFullscreenManager', () => {
      expect(createController().getFullscreenManager()).toBe(
        vi.mocked(FullscreenManager).mock.instances[0],
      );
    });

    it('getHASSManager', () => {
      expect(createController().getHASSManager()).toBe(
        vi.mocked(HASSManager).mock.instances[0],
      );
    });

    it('getInitializationManager', () => {
      expect(createController().getInitializationManager()).toBe(
        vi.mocked(InitializationManager).mock.instances[0],
      );
    });

    it('getInteractionManager', () => {
      expect(createController().getInteractionManager()).toBe(
        vi.mocked(InteractionManager).mock.instances[0],
      );
    });

    it('getMediaLoadedInfoManager', () => {
      expect(createController().getMediaLoadedInfoManager()).toBe(
        vi.mocked(MediaLoadedInfoManager).mock.instances[0],
      );
    });

    it('getMediaPlayerManager', () => {
      expect(createController().getMediaPlayerManager()).toBe(
        vi.mocked(MediaPlayerManager).mock.instances[0],
      );
    });

    it('getMessageManager', () => {
      expect(createController().getMessageManager()).toBe(
        vi.mocked(MessageManager).mock.instances[0],
      );
    });

    it('getMicrophoneManager', () => {
      expect(createController().getMicrophoneManager()).toBe(
        vi.mocked(MicrophoneManager).mock.instances[0],
      );
    });

    it('getResolvedMediaCache', () => {
      expect(createController().getResolvedMediaCache()).toBe(
        vi.mocked(ResolvedMediaCache).mock.instances[0],
      );
    });

    describe('getStubConfig', () => {
      it('with camera entities', () => {
        expect(
          CardController.getStubConfig(['camera.office', 'binary_sensor.motion']),
        ).toEqual({
          cameras: [{ camera_entity: 'camera.office' }],
        });
      });

      it('without camera entities', () => {
        expect(CardController.getStubConfig(['binary_sensor.motion'])).toEqual({
          cameras: [{ camera_entity: 'camera.demo' }],
        });
      });
    });

    it('getQueryStringManager', () => {
      expect(createController().getQueryStringManager()).toBe(
        vi.mocked(QueryStringManager).mock.instances[0],
      );
    });

    it('getStyleManager', () => {
      expect(createController().getStyleManager()).toBe(
        vi.mocked(StyleManager).mock.instances[0],
      );
    });

    it('getTriggersManager', () => {
      expect(createController().getTriggersManager()).toBe(
        vi.mocked(TriggersManager).mock.instances[0],
      );
    });

    it('getViewManager', () => {
      expect(createController().getViewManager()).toBe(
        vi.mocked(ViewManager).mock.instances[0],
      );
    });
  });

  describe('handlers', () => {
    it('hostConnected', () => {
      createController().hostConnected();
      expect(
        vi.mocked(CardElementManager).mock.instances[0].elementConnected,
      ).toBeCalled();
    });

    it('hostDisconnected', () => {
      createController().hostDisconnected();
      expect(
        vi.mocked(CardElementManager).mock.instances[0].elementDisconnected,
      ).toBeCalled();
    });
  });
});
