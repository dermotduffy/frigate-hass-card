import { LovelaceCardEditor } from '@dermotduffy/custom-card-helpers';
import { ReactiveController } from 'lit';
import { CameraManager } from '../camera-manager/manager';
import { FrigateCardConfig } from '../config/types';
import {
  createDeviceRegistryCache,
  DeviceRegistryManager,
} from '../utils/ha/registry/device';
import {
  createEntityRegistryCache,
  EntityRegistryManager,
} from '../utils/ha/registry/entity';
import { ResolvedMediaCache } from '../utils/ha/resolved-media';
import { ActionsManager } from './actions/actions-manager';
import { AutomationsManager } from './automations-manager';
import { CameraURLManager } from './camera-url-manager';
import {
  CardElementManager,
  CardHTMLElement,
  MenuToggleCallback,
  ScrollCallback,
} from './card-element-manager';
import { ConditionsManager, ConditionsManagerListener } from './conditions-manager';
import { ConfigManager } from './config/config-manager';
import { DefaultManager } from './default-manager';
import { DownloadManager } from './download-manager';
import { ExpandManager } from './expand-manager';
import { FullscreenManager } from './fullscreen-manager';
import { HASSManager } from './hass/hass-manager';
import { InitializationManager } from './initialization-manager';
import { InteractionManager } from './interaction-manager';
import { KeyboardStateManager } from './keyboard-state-manager';
import { MediaLoadedInfoManager } from './media-info-manager';
import { MediaPlayerManager } from './media-player-manager';
import { MessageManager } from './message-manager';
import { MicrophoneManager } from './microphone-manager';
import { QueryStringManager } from './query-string-manager';
import { StatusBarItemManager } from './status-bar-item-manager';
import { StyleManager } from './style-manager';
import { TriggersManager } from './triggers-manager';
import {
  CardActionsManagerAPI,
  CardAutomationsAPI,
  CardCameraAPI,
  CardCameraURLAPI,
  CardConditionAPI,
  CardConfigAPI,
  CardDefaultManagerAPI,
  CardDownloadAPI,
  CardElementAPI,
  CardExpandAPI,
  CardFullscreenAPI,
  CardHASSAPI,
  CardInitializerAPI,
  CardInteractionAPI,
  CardKeyboardStateAPI,
  CardMediaLoadedAPI,
  CardMediaPlayerAPI,
  CardMessageAPI,
  CardMicrophoneAPI,
  CardQueryStringAPI,
  CardStyleAPI,
  CardTriggersAPI,
  CardViewAPI,
} from './types';
import { ViewManager } from './view/view-manager';

export class CardController
  implements
    CardActionsManagerAPI,
    CardAutomationsAPI,
    CardCameraAPI,
    CardCameraURLAPI,
    CardConditionAPI,
    CardConfigAPI,
    CardDefaultManagerAPI,
    CardDownloadAPI,
    CardElementAPI,
    CardExpandAPI,
    CardFullscreenAPI,
    CardHASSAPI,
    CardInitializerAPI,
    CardInteractionAPI,
    CardKeyboardStateAPI,
    CardMediaLoadedAPI,
    CardMediaPlayerAPI,
    CardMessageAPI,
    CardMicrophoneAPI,
    CardQueryStringAPI,
    CardStyleAPI,
    CardTriggersAPI,
    CardViewAPI,
    ReactiveController
{
  // These properties may be used in the construction of 'managers' (and should
  // be created first).
  protected _deviceRegistryManager = new DeviceRegistryManager(
    createDeviceRegistryCache(),
  );
  protected _entityRegistryManager = new EntityRegistryManager(
    createEntityRegistryCache(),
  );
  protected _resolvedMediaCache = new ResolvedMediaCache();

  protected _actionsManager = new ActionsManager(this);
  protected _automationsManager = new AutomationsManager(this);
  protected _cameraManager = new CameraManager(this);
  protected _cameraURLManager = new CameraURLManager(this);
  protected _cardElementManager: CardElementManager;
  protected _conditionsManager: ConditionsManager;
  protected _configManager = new ConfigManager(this);
  protected _defaultManager = new DefaultManager(this);
  protected _downloadManager = new DownloadManager(this);
  protected _expandManager = new ExpandManager(this);
  protected _fullscreenManager = new FullscreenManager(this);
  protected _hassManager = new HASSManager(this);
  protected _initializationManager = new InitializationManager(this);
  protected _interactionManager = new InteractionManager(this);
  protected _keyboardStateManager = new KeyboardStateManager(this);
  protected _mediaLoadedInfoManager = new MediaLoadedInfoManager(this);
  protected _mediaPlayerManager = new MediaPlayerManager(this);
  protected _messageManager = new MessageManager(this);
  protected _microphoneManager = new MicrophoneManager(this);
  protected _queryStringManager = new QueryStringManager(this);
  protected _statusBarItemManager = new StatusBarItemManager(this);
  protected _styleManager = new StyleManager(this);
  protected _triggersManager = new TriggersManager(this);
  protected _viewManager = new ViewManager(this);

  constructor(
    host: CardHTMLElement,
    scrollCallback: ScrollCallback,
    menuToggleCallback: MenuToggleCallback,
    conditionListener: ConditionsManagerListener,
  ) {
    host.addController(this);

    this._conditionsManager = new ConditionsManager(this, conditionListener);
    this._cardElementManager = new CardElementManager(
      this,
      host,
      scrollCallback,
      menuToggleCallback,
    );
  }

  // *************************************************************************
  //                           Accessors
  // *************************************************************************

  public getActionsManager(): ActionsManager {
    return this._actionsManager;
  }

  public getAutomationsManager(): AutomationsManager {
    return this._automationsManager;
  }

  public getCameraManager(): CameraManager {
    return this._cameraManager;
  }

  public getCameraURLManager(): CameraURLManager {
    return this._cameraURLManager;
  }

  public getCardElementManager(): CardElementManager {
    return this._cardElementManager;
  }

  public getConditionsManager(): ConditionsManager {
    return this._conditionsManager;
  }

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('../editor.js');
    return document.createElement('frigate-card-editor');
  }

  public getConfigManager(): ConfigManager {
    return this._configManager;
  }

  public getDefaultManager(): DefaultManager {
    return this._defaultManager;
  }

  public getDeviceRegistryManager(): DeviceRegistryManager {
    return this._deviceRegistryManager;
  }

  public getDownloadManager(): DownloadManager {
    return this._downloadManager;
  }

  public getEntityRegistryManager(): EntityRegistryManager {
    return this._entityRegistryManager;
  }

  public getExpandManager(): ExpandManager {
    return this._expandManager;
  }

  public getFullscreenManager(): FullscreenManager {
    return this._fullscreenManager;
  }

  public getHASSManager(): HASSManager {
    return this._hassManager;
  }

  public getInitializationManager(): InitializationManager {
    return this._initializationManager;
  }

  public getInteractionManager(): InteractionManager {
    return this._interactionManager;
  }

  public getKeyboardStateManager(): KeyboardStateManager {
    return this._keyboardStateManager;
  }

  public getMediaLoadedInfoManager(): MediaLoadedInfoManager {
    return this._mediaLoadedInfoManager;
  }

  public getMediaPlayerManager(): MediaPlayerManager {
    return this._mediaPlayerManager;
  }

  public getMessageManager(): MessageManager {
    return this._messageManager;
  }

  public getMicrophoneManager(): MicrophoneManager {
    return this._microphoneManager;
  }

  public getQueryStringManager(): QueryStringManager {
    return this._queryStringManager;
  }

  public getResolvedMediaCache(): ResolvedMediaCache {
    return this._resolvedMediaCache;
  }

  public getStatusBarItemManager(): StatusBarItemManager {
    return this._statusBarItemManager;
  }

  public static getStubConfig(entities: string[]): FrigateCardConfig {
    const cameraEntity = entities.find((element) => element.startsWith('camera.'));
    return {
      cameras: [
        {
          camera_entity: cameraEntity ?? 'camera.demo',
        },
      ],
      // Need to use 'as unknown' to convince Typescript that this really isn't a
      // mistake, despite the miniscule size of the configuration vs the full type
      // description.
    } as unknown as FrigateCardConfig;
  }

  public getStyleManager(): StyleManager {
    return this._styleManager;
  }

  public getTriggersManager(): TriggersManager {
    return this._triggersManager;
  }

  public getViewManager(): ViewManager {
    return this._viewManager;
  }

  // *************************************************************************
  //                            Handlers
  // *************************************************************************

  public hostConnected(): void {
    this.getCardElementManager().elementConnected();
  }

  public hostDisconnected(): void {
    this.getCardElementManager().elementDisconnected();
  }
}
