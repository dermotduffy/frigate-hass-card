import type { CameraManager } from '../camera-manager/manager';
import type { ConditionsManager } from './conditions-manager';
import type { EntityRegistryManager } from '../utils/ha/entity-registry';
import type { ResolvedMediaCache } from '../utils/ha/resolved-media';
import type { ActionsManager } from './actions-manager';
import type { AutoUpdateManager } from './auto-update-manager';
import type { AutomationsManager } from './automations-manager';
import type { CameraURLManager } from './camera-url-manager';
import type { CardElementManager } from './card-element-manager';
import type { ConfigManager } from './config-manager';
import type { DownloadManager } from './download-manager';
import type { ExpandManager } from './expand-manager';
import type { FullscreenManager } from './fullscreen-manager';
import type { HASSManager } from './hass-manager';
import type { InitializationManager } from './initialization-manager';
import type { InteractionManager } from './interaction-manager';
import type { MediaLoadedInfoManager } from './media-info-manager';
import type { MediaPlayerManager } from './media-player-manager';
import type { MessageManager } from './message-manager';
import type { MicrophoneManager } from './microphone-manager';
import type { StyleManager } from './style-manager';
import type { TriggersManager } from './triggers-manager';
import type { ViewManager } from './view-manager';
import type { QueryStringManager } from './query-string-manager';

/**
 * This defines a series of limited APIs that various manager helpers use to
 * control the card. Explicitly specifying them helps make coupling intentional
 * and avoids cyclic importing.
 */

export interface CardActionsManagerAPI {
  getCameraManager(): CameraManager;
  getCameraURLManager(): CameraURLManager;
  getCardElementManager(): CardElementManager;
  getConfigManager(): ConfigManager;
  getDownloadManager(): DownloadManager;
  getExpandManager(): ExpandManager;
  getFullscreenManager(): FullscreenManager;
  getHASSManager(): HASSManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getMediaPlayerManager(): MediaPlayerManager;
  getMessageManager(): MessageManager;
  getMicrophoneManager(): MicrophoneManager;
  getTriggersManager(): TriggersManager;
  getViewManager(): ViewManager;
}

export interface CardAutomationsAPI {
  getCardElementManager(): CardElementManager;
  getConditionsManager(): ConditionsManager;
  getConfigManager(): ConfigManager;
  getHASSManager(): HASSManager;
  getMessageManager(): MessageManager;
}

export interface CardAutoRefreshAPI {
  getConfigManager(): ConfigManager;
  getInteractionManager(): InteractionManager;
  getTriggersManager(): TriggersManager;
  getViewManager(): ViewManager;
}

export interface CardCameraAPI {
  getConfigManager(): ConfigManager;
  getEntityRegistryManager(): EntityRegistryManager;
  getHASSManager(): HASSManager;
  getMessageManager(): MessageManager;
  getResolvedMediaCache(): ResolvedMediaCache;
  getTriggersManager(): TriggersManager;
}

export interface CardCameraURLAPI {
  getCameraManager(): CameraManager;
  getViewManager(): ViewManager;
}

export interface CardConditionAPI {
  getAutomationsManager(): AutomationsManager;
  getConfigManager(): ConfigManager;
}

export interface CardConfigAPI {
  getAutomationsManager(): AutomationsManager;
  getCardElementManager(): CardElementManager;
  getConditionsManager(): ConditionsManager;
  getInitializationManager(): InitializationManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getMessageManager(): MessageManager;
  getStyleManager(): StyleManager;
  getViewManager(): ViewManager;
}

export interface CardDownloadAPI {
  getCameraManager(): CameraManager;
  getHASSManager(): HASSManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getMessageManager(): MessageManager;
  getViewManager(): ViewManager;
}

export interface CardElementAPI {
  getActionsManager(): ActionsManager;
  getCameraManager(): CameraManager;
  getExpandManager(): ExpandManager;
  getFullscreenManager(): FullscreenManager;
  getInitializationManager(): InitializationManager;
  getInteractionManager(): InteractionManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getMicrophoneManager(): MicrophoneManager;
  getQueryStringManager(): QueryStringManager;
}

export interface CardExpandAPI {
  getCardElementManager(): CardElementManager;
  getConditionsManager(): ConditionsManager;
  getFullscreenManager(): FullscreenManager;
}

export interface CardFullscreenAPI {
  getCardElementManager(): CardElementManager;
  getConditionsManager(): ConditionsManager;
  getExpandManager(): ExpandManager;
  getMediaPlayerManager(): MediaPlayerManager;
}

export interface CardHASSAPI {
  getCameraManager(): CameraManager;
  getCardElementManager(): CardElementManager;
  getConditionsManager(): ConditionsManager;
  getConfigManager(): ConfigManager;
  getInteractionManager(): InteractionManager;
  getMediaPlayerManager(): MediaPlayerManager;
  getMessageManager(): MessageManager;
  getStyleManager(): StyleManager;
  getTriggersManager(): TriggersManager;
  getViewManager(): ViewManager;
}

export interface CardInitializerAPI {
  getCameraManager(): CameraManager;
  getCardElementManager(): CardElementManager;
  getConfigManager(): ConfigManager;
  getEntityRegistryManager(): EntityRegistryManager;
  getHASSManager(): HASSManager;
  getMediaPlayerManager(): MediaPlayerManager;
  getMessageManager(): MessageManager;
  getMicrophoneManager(): MicrophoneManager;
  getQueryStringManager(): QueryStringManager;
  getResolvedMediaCache(): ResolvedMediaCache;
  getViewManager(): ViewManager;
}

export interface CardInteractionAPI {
  getConditionsManager(): ConditionsManager;
  getConfigManager(): ConfigManager;
  getStyleManager(): StyleManager;
  getTriggersManager(): TriggersManager;
  getViewManager(): ViewManager;
}

export interface CardMediaLoadedAPI {
  getCardElementManager(): CardElementManager;
  getConditionsManager(): ConditionsManager;
  getConfigManager(): ConfigManager;
  getStyleManager(): StyleManager;
}

export interface CardMediaPlayerAPI {
  getCameraManager(): CameraManager;
  getEntityRegistryManager(): EntityRegistryManager;
  getHASSManager(): HASSManager;
  getMessageManager(): MessageManager;
  getQueryStringManager(): QueryStringManager;
}

export interface CardMessageAPI {
  getCardElementManager(): CardElementManager;
  getConditionsManager(): ConditionsManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
}

export interface CardMicrophoneAPI {
  getCardElementManager(): CardElementManager;
  getConditionsManager(): ConditionsManager;
  getConfigManager(): ConfigManager;
}

export interface CardQueryStringAPI {
  getActionsManager(): ActionsManager;
  getCardElementManager(): CardElementManager;
  getViewManager(): ViewManager;
}

export interface CardStyleAPI {
  getCardElementManager(): CardElementManager;
  getConfigManager(): ConfigManager;
  getExpandManager(): ExpandManager;
  getFullscreenManager(): FullscreenManager;
  getHASSManager(): HASSManager;
  getInteractionManager(): InteractionManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getViewManager(): ViewManager;
}

export interface CardTriggersAPI {
  getCameraManager(): CameraManager;
  getConditionsManager(): ConditionsManager;
  getCardElementManager(): CardElementManager;
  getConfigManager(): ConfigManager;
  getInteractionManager(): InteractionManager;
  getViewManager(): ViewManager;
}

export interface CardViewAPI {
  getAutoUpdateManager(): AutoUpdateManager;
  getCameraManager(): CameraManager;
  getCardElementManager(): CardElementManager;
  getConditionsManager(): ConditionsManager;
  getConfigManager(): ConfigManager;
  getHASSManager(): HASSManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getMessageManager(): MessageManager;
  getStyleManager(): StyleManager;
  getTriggersManager(): TriggersManager;
}
