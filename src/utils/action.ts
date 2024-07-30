import { ActionConfig, hasAction } from '@dermotduffy/custom-card-helpers';
import { ZoomSettingsBase } from '../components-lib/zoom/types.js';
import { PTZAction } from '../config/ptz.js';
import {
  ActionPhase,
  ActionType,
  Actions,
  FrigateCardCustomAction,
  FrigateCardGeneralAction,
  FrigateCardUserSpecifiedView,
  LogActionConfig,
  LogActionLevel,
  PTZActionConfig,
  PTZDigitialActionConfig,
  PTZMultiActionConfig,
  frigateCardCustomActionSchema,
} from '../config/types.js';
import { arrayify } from './basic.js';

/**
 * Convert a generic Action to a FrigateCardCustomAction if it parses correctly.
 * @param action The generic action configuration.
 * @returns A FrigateCardCustomAction or null if it cannot be converted.
 */
export function convertActionToCardCustomAction(
  action: unknown,
): FrigateCardCustomAction | null {
  if (!action) {
    return null;
  }
  // Parse a custom event as other things could generate ll-custom events that
  // are not related to Frigate Card.
  const parseResult = frigateCardCustomActionSchema.safeParse(action);
  return parseResult.success ? parseResult.data : null;
}

export function createGeneralAction(
  action: FrigateCardGeneralAction | FrigateCardUserSpecifiedView,
  options?: {
    cardID?: string;
  },
): FrigateCardCustomAction {
  return {
    action: 'fire-dom-event',
    frigate_card_action: action,
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createCameraAction(
  action: 'camera_select' | 'live_substream_select',
  camera: string,
  options?: {
    cardID?: string;
  },
): FrigateCardCustomAction {
  return {
    action: 'fire-dom-event',
    frigate_card_action: action,
    camera: camera,
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createMediaPlayerAction(
  mediaPlayer: string,
  mediaPlayerAction: 'play' | 'stop',
  options?: {
    cardID?: string;
  },
): FrigateCardCustomAction {
  return {
    action: 'fire-dom-event',
    frigate_card_action: 'media_player',
    media_player: mediaPlayer,
    media_player_action: mediaPlayerAction,
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createDisplayModeAction(
  displayMode: 'single' | 'grid',
  options?: {
    cardID?: string;
  },
): FrigateCardCustomAction {
  return {
    action: 'fire-dom-event',
    frigate_card_action: 'display_mode_select',
    display_mode: displayMode,
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createPTZControlsAction(
  enabled: boolean,
  options?: {
    cardID?: string;
  },
): FrigateCardCustomAction {
  return {
    action: 'fire-dom-event',
    frigate_card_action: 'ptz_controls',
    enabled: enabled,
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

export function createPTZAction(options?: {
  cardID?: string;
  ptzAction?: PTZAction;
  ptzPhase?: ActionPhase;
  ptzPreset?: string;
  cameraID?: string;
}): PTZActionConfig {
  return {
    action: 'fire-dom-event',
    frigate_card_action: 'ptz',
    ...(options?.cardID && { card_id: options.cardID }),
    ...(options?.ptzAction && { ptz_action: options.ptzAction }),
    ...(options?.ptzPhase && { ptz_phase: options.ptzPhase }),
    ...(options?.ptzPreset && { ptz_preset: options.ptzPreset }),
    ...(options?.cameraID && { camera: options.cameraID }),
  };
}

export function createPTZDigitalAction(options?: {
  cardID?: string;
  ptzPhase?: ActionPhase;
  ptzAction?: PTZAction;
  absolute?: ZoomSettingsBase;
  targetID?: string;
}): PTZDigitialActionConfig {
  return {
    action: 'fire-dom-event',
    frigate_card_action: 'ptz_digital',
    ...(options?.cardID && { card_id: options.cardID }),
    ...(options?.ptzAction && { ptz_action: options.ptzAction }),
    ...(options?.ptzPhase && { ptz_phase: options.ptzPhase }),
    ...(options?.absolute && { absolute: options.absolute }),
    ...(options?.targetID && { target_id: options.targetID }),
  };
}

export function createPTZMultiAction(options?: {
  cardID?: string;
  ptzAction?: PTZAction;
  ptzPhase?: ActionPhase;
  ptzPreset?: string;
  targetID?: string;
}): PTZMultiActionConfig {
  return {
    action: 'fire-dom-event',
    frigate_card_action: 'ptz_multi',
    ...(options?.cardID && { card_id: options.cardID }),
    ...(options?.ptzAction && { ptz_action: options.ptzAction }),
    ...(options?.ptzPhase && { ptz_phase: options.ptzPhase }),
    ...(options?.ptzPreset && { ptz_preset: options.ptzPreset }),
    ...(options?.targetID && { target_id: options.targetID }),
  };
}

export function createLogAction(
  message: string,
  options?: {
    cardID?: string;
    level?: LogActionLevel;
  },
): LogActionConfig {
  return {
    action: 'fire-dom-event',
    frigate_card_action: 'log',
    message: message,
    level: options?.level ?? 'info',
    ...(options?.cardID && { card_id: options.cardID }),
  };
}

/**
 * Get an action configuration given a config and an interaction (e.g. 'tap').
 * @param interaction The interaction: `tap`, `hold` or `double_tap`
 * @param config The configuration containing multiple actions.
 * @returns The relevant action configuration or null if none found.
 */
export function getActionConfigGivenAction(
  interaction?: string,
  config?: Actions | null,
): ActionType | ActionType[] | null {
  if (!interaction || !config) {
    return null;
  }
  if (interaction === 'tap' && config.tap_action) {
    return config.tap_action;
  } else if (interaction === 'hold' && config.hold_action) {
    return config.hold_action;
  } else if (interaction === 'double_tap' && config.double_tap_action) {
    return config.double_tap_action;
  } else if (interaction === 'end_tap' && config.end_tap_action) {
    return config.end_tap_action;
  } else if (interaction === 'start_tap' && config.start_tap_action) {
    return config.start_tap_action;
  }
  return null;
}

/**
 * Determine if an action config has a real action. A modified version of
 * custom-card-helpers hasAction to also work with arrays of action configs.
 * @param config The action config in question.
 * @returns `true` if there's a real action defined, `false` otherwise.
 */
export const frigateCardHasAction = (config?: ActionType | ActionType[]): boolean => {
  // See note above on 'ActionConfig vs ActionType' for why this cast is
  // necessary and harmless.
  return arrayify(config).some((item) => hasAction(item as ActionConfig | undefined));
};

/**
 * Stop an event from activating card wide actions.
 */
export const stopEventFromActivatingCardWideActions = (ev: Event): void => {
  ev.stopPropagation();
};
