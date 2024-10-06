import type { CameraManager } from '../camera-manager/manager';
import type { Automation } from '../config/types';
import type { EntityRegistryManager } from '../utils/ha/registry/entity';
import type { ResolvedMediaCache } from '../utils/ha/resolved-media';
import type { ActionsManager } from './actions/actions-manager';
import type { AutomationsManager } from './automations-manager';
import type { CameraURLManager } from './camera-url-manager';
import type { CardElementManager } from './card-element-manager';
import type { ConditionsManager } from './conditions-manager';
import type { ConfigManager } from './config/config-manager';
import type { DefaultManager } from './default-manager';
import type { DownloadManager } from './download-manager';
import type { ExpandManager } from './expand-manager';
import type { FullscreenManager } from './fullscreen-manager';
import type { HASSManager } from './hass/hass-manager';
import type { InitializationManager } from './initialization-manager';
import type { InteractionManager } from './interaction-manager';
import type { KeyboardStateManager } from './keyboard-state-manager';
import type { MediaLoadedInfoManager } from './media-info-manager';
import type { MediaPlayerManager } from './media-player-manager';
import type { MessageManager } from './message-manager';
import type { MicrophoneManager } from './microphone-manager';
import type { QueryStringManager } from './query-string-manager';
import type { StatusBarItemManager } from './status-bar-item-manager';
import type { StyleManager } from './style-manager';
import type { TriggersManager } from './triggers-manager';
import type { ViewManager } from './view/view-manager';

// *************************************************************************
//                             Manager APIs
// This defines a series of limited APIs that various managers use to control
// the card. Explicitly specifying them helps make coupling intentional and
// reduce cyclic dependencies.
// *************************************************************************

export interface CardActionsAPI {
  getActionsManager(): ActionsManager;
  getCameraManager(): CameraManager;
  getCameraURLManager(): CameraURLManager;
  getCardElementManager(): CardElementManager;
  getConditionsManager(): ConditionsManager;
  getConfigManager(): ConfigManager;
  getDownloadManager(): DownloadManager;
  getExpandManager(): ExpandManager;
  getFullscreenManager(): FullscreenManager;
  getHASSManager(): HASSManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getMediaPlayerManager(): MediaPlayerManager;
  getMessageManager(): MessageManager;
  getMicrophoneManager(): MicrophoneManager;
  getStatusBarItemManager(): StatusBarItemManager;
  getTriggersManager(): TriggersManager;
  getViewManager(): ViewManager;
}
export type CardActionsManagerAPI = CardActionsAPI;

export interface CardAutomationsAPI {
  getActionsManager(): ActionsManager;
  getCardElementManager(): CardElementManager;
  getConditionsManager(): ConditionsManager;
  getHASSManager(): HASSManager;
  getInitializationManager(): InitializationManager;
  getMessageManager(): MessageManager;
}

export interface CardCameraAPI {
  getActionsManager(): ActionsManager;
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
  getConfigManager(): ConfigManager;
  getDefaultManager(): DefaultManager;
  getInitializationManager(): InitializationManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getMediaPlayerManager(): MediaPlayerManager;
  getMessageManager(): MessageManager;
  getStatusBarItemManager(): StatusBarItemManager;
  getStyleManager(): StyleManager;
  getViewManager(): ViewManager;
}

export interface CardConfigLoaderAPI {
  getConfigManager(): ConfigManager;
  getAutomationsManager(): AutomationsManager;
}

export interface CardDefaultManagerAPI {
  getAutomationsManager(): AutomationsManager;
  getConfigManager(): ConfigManager;
  getHASSManager(): HASSManager;
  getInteractionManager(): InteractionManager;
  getTriggersManager(): TriggersManager;
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
  getConfigManager(): ConfigManager;
  getDefaultManager(): DefaultManager;
  getExpandManager(): ExpandManager;
  getFullscreenManager(): FullscreenManager;
  getInitializationManager(): InitializationManager;
  getInteractionManager(): InteractionManager;
  getHASSManager(): HASSManager;
  getKeyboardStateManager(): KeyboardStateManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getMediaPlayerManager(): MediaPlayerManager;
  getMicrophoneManager(): MicrophoneManager;
  getStyleManager(): StyleManager;
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
  getDefaultManager(): DefaultManager;
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
  getDefaultManager(): DefaultManager;
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

export interface CardKeyboardStateAPI {
  getCardElementManager(): CardElementManager;
  getConditionsManager(): ConditionsManager;
  getConfigManager(): ConfigManager;
}

export interface CardMediaLoadedAPI {
  getCardElementManager(): CardElementManager;
  getConditionsManager(): ConditionsManager;
  getConfigManager(): ConfigManager;
  getStyleManager(): StyleManager;
}

export interface CardMediaPlayerAPI {
  getCameraManager(): CameraManager;
  getConfigManager(): ConfigManager;
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

export interface CardStatusBarAPI {
  getCardElementManager(): CardElementManager;
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
  getCameraManager(): CameraManager;
  getCardElementManager(): CardElementManager;
  getConditionsManager(): ConditionsManager;
  getConfigManager(): ConfigManager;
  getHASSManager(): HASSManager;
  getMediaLoadedInfoManager(): MediaLoadedInfoManager;
  getMessageManager(): MessageManager;
  getQueryStringManager(): QueryStringManager;
  getStyleManager(): StyleManager;
  getTriggersManager(): TriggersManager;
}

// *************************************************************************
//                             Common Types
// *************************************************************************

export interface KeysState {
  [key: string]: {
    state: 'down' | 'up';
    ctrl: boolean;
    shift: boolean;
    alt: boolean;
    meta: boolean;
  };
}
interface TaggedAutomation extends Automation {
  tag?: unknown;
}
export type TaggedAutomations = TaggedAutomation[];
