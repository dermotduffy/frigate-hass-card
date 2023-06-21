import {
  ActionConfig,
  handleActionConfig,
  hasAction,
  HomeAssistant,
} from 'custom-card-helpers';
import {
  Actions,
  ActionType,
  FrigateCardAction,
  FrigateCardCustomAction,
  frigateCardCustomActionSchema,
  FrigateCardViewAction,
} from '../types.js';

/**
 * Convert a generic Action to a FrigateCardCustomAction if it parses correctly.
 * @param action The generic action configuration.
 * @returns A FrigateCardCustomAction or null if it cannot be converted.
 */
export function convertActionToFrigateCardCustomAction(
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

/**
 * Create a Frigate card custom action.
 * @param action The Frigate card action string (e.g. 'fullscreen')
 * @returns A FrigateCardCustomAction for that action string or null.
 */
export function createFrigateCardCustomAction(
  action: FrigateCardAction,
  args?: {
    cardID?: string;
    camera?: string;
    media_player?: string;
    media_player_action?: 'play' | 'stop';
  },
): FrigateCardCustomAction | null {
  if (action === 'camera_select' || action === 'live_substream_select') {
    if (!args?.camera) {
      return null;
    }
    return {
      action: 'fire-dom-event',
      frigate_card_action: action,
      camera: args.camera as string,
      ...(args.cardID && { card_id: args.cardID }),
    };
  }
  if (action === 'media_player') {
    if (!args?.media_player || !args.media_player_action) {
      return null;
    }
    return {
      action: 'fire-dom-event',
      frigate_card_action: action,
      media_player: args.media_player,
      media_player_action: args.media_player_action,
      ...(args.cardID && { card_id: args.cardID }),
    };
  }
  return {
    action: 'fire-dom-event',
    frigate_card_action: action,
    ...(args?.cardID && { card_id: args.cardID }),
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
  config?: Actions,
): ActionType | ActionType[] | undefined {
  if (!interaction || !config) {
    return undefined;
  }
  if (interaction == 'tap' && config.tap_action) {
    return config.tap_action;
  } else if (interaction == 'hold' && config.hold_action) {
    return config.hold_action;
  } else if (interaction == 'double_tap' && config.double_tap_action) {
    return config.double_tap_action;
  } else if (interaction == 'end_tap' && config.end_tap_action) {
    return config.end_tap_action;
  } else if (interaction == 'start_tap' && config.start_tap_action) {
    return config.start_tap_action;
  }
  return undefined;
}

/**
 * Frigate card custom version of handleAction
 * (https://github.com/custom-cards/custom-card-helpers/blob/master/src/handle-action.ts)
 * that handles the custom action events the card supports.
 * @param node The node that fired the event.
 * @param hass The Home Assistant object.
 * @param actionConfig A single action config, array of action configs or
 * undefined for the default action config for 'tap'.
 * @param action The action string (e.g. 'hold')
 * @returns Whether or not an action was executed.
 */
export const frigateCardHandleActionConfig = (
  node: HTMLElement,
  hass: HomeAssistant,
  config: {
    camera_image?: string;
    entity?: string;
  },
  action: string,
  actionConfig?: ActionType | ActionType[],
): boolean => {
  // Only allow a tap action to use a default non-config (the more-info config).
  if (actionConfig || action == 'tap') {
    frigateCardHandleAction(node, hass, config, actionConfig);
    return true;
  }
  return false;
};

export const frigateCardHandleAction = (
  node: HTMLElement,
  hass: HomeAssistant,
  config: {
    camera_image?: string;
    entity?: string;
  },
  actionConfig: ActionType | ActionType[] | undefined,
): void => {
  // ActionConfig vs ActionType:
  // * There is a slight typing (but not functional) difference between
  //   ActionType in this card and ActionConfig in `custom-card-helpers`. See
  //   `ExtendedConfirmationRestrictionConfig` in `types.ts` for the source and
  //   reason behind this difference.
  if (Array.isArray(actionConfig)) {
    actionConfig.forEach((action) =>
      handleActionConfig(node, hass, config, action as ActionConfig | undefined),
    );
  } else {
    handleActionConfig(node, hass, config, actionConfig as ActionConfig | undefined);
  }
};

/**
 * Determine if an action config has a real action. A modified version of
 * custom-card-helpers hasAction to also work with arrays of action configs.
 * @param config The action config in question.
 * @returns `true` if there's a real action defined, `false` otherwise.
 */
export const frigateCardHasAction = (config?: ActionType | ActionType[]): boolean => {
  // See note above on 'ActionConfig vs ActionType' for why this cast is
  // necessary and harmless.
  if (Array.isArray(config)) {
    return !!config.find((item) => hasAction(item as ActionConfig | undefined));
  }
  return hasAction(config as ActionConfig | undefined);
};

/**
 * Stop an event from activating card wide actions.
 */
export const stopEventFromActivatingCardWideActions = (ev: Event): void => {
  ev.stopPropagation();
};

export const isViewAction = (
  action: FrigateCardCustomAction,
): action is FrigateCardViewAction => {
  switch (action.frigate_card_action) {
    case 'clip':
    case 'clips':
    case 'image':
    case 'live':
    case 'recording':
    case 'recordings':
    case 'snapshot':
    case 'snapshots':
    case 'timeline':
      return true;
  }
  return false;
};
