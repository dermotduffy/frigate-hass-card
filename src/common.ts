import { HassEntity, MessageBase } from 'home-assistant-js-websocket';
import {
  HomeAssistant,
  computeStateDomain,
  handleActionConfig,
  hasAction,
  stateIcon,
} from 'custom-card-helpers';
import { StyleInfo } from 'lit/directives/style-map';
import { ZodSchema, z } from 'zod';
import { isEqual } from 'lodash-es';

import { localize } from './localize/localize.js';
import {
  Actions,
  ActionsConfig,
  ActionType,
  CameraConfig,
  ExtendedHomeAssistant,
  FrigateCardAction,
  FrigateCardCustomAction,
  frigateCardCustomActionSchema,
  MediaShowInfo,
  Message,
  SignedPath,
  signedPathSchema,
  StateParameters,
} from './types.js';

const MEDIA_INFO_HEIGHT_CUTOFF = 50;
const MEDIA_INFO_WIDTH_CUTOFF = MEDIA_INFO_HEIGHT_CUTOFF;

/**
 * Get the keys that didn't parse from a ZodError.
 * @param error The zoderror to extract the keys from.
 * @returns An array of error keys.
 */
export function getParseErrorKeys<T>(error: z.ZodError<T>): string[] {
  const errors = error.format();
  return Object.keys(errors).filter((v) => !v.startsWith('_'));
}

/**
 * Make a HomeAssistant websocket request. May throw.
 * @param hass The HomeAssistant object to send the request with.
 * @param schema The expected Zod schema of the response.
 * @param request The request to make.
 * @returns The parsed valid response or null on malformed.
 */
export async function homeAssistantWSRequest<T>(
  hass: HomeAssistant & ExtendedHomeAssistant,
  schema: ZodSchema<T>,
  request: MessageBase,
): Promise<T> {
  const response = await hass.callWS<T>(request);

  if (!response) {
    const error_message = `${localize('error.empty_response')}: ${JSON.stringify(
      request,
    )}`;
    console.warn(error_message);
    throw new Error(error_message);
  }
  const parseResult = schema.safeParse(response);
  if (!parseResult.success) {
    const keys = getParseErrorKeys<T>(parseResult.error);
    const error_message =
      `${localize('error.invalid_response')}: ${JSON.stringify(request)}. ` +
      localize('error.invalid_keys') +
      `: '${keys}'`;
    console.warn(error_message);
    throw new Error(error_message);
  }
  return parseResult.data;
}

/**
 * Request that HA sign a path. May throw.
 * @param hass The HomeAssistant object used to request the signature.
 * @param path The path to sign.
 * @param expires An optional number of seconds to sign the path for.
 * @returns The signed URL, or null if the response was malformed.
 */
export async function homeAssistantSignPath(
  hass: HomeAssistant & ExtendedHomeAssistant,
  path: string,
  expires?: number,
): Promise<string | null> {
  const request = {
    type: 'auth/sign_path',
    path: path,
    expires: expires,
  };
  const response = await homeAssistantWSRequest<SignedPath>(
    hass,
    signedPathSchema,
    request,
  );
  if (!response) {
    return null;
  }
  return hass.hassUrl(response.path);
}

/**
 * Dispatch a Frigate Card event.
 * @param element The element to send the event.
 * @param name The name of the Frigate card event to send.
 * @param detail An optional detail object to attach.
 */
export function dispatchFrigateCardEvent<T>(
  element: HTMLElement,
  name: string,
  detail?: T,
): void {
  element.dispatchEvent(
    new CustomEvent<T>(`frigate-card:${name}`, {
      bubbles: true,
      composed: true,
      detail: detail,
    }),
  );
}

/**
 * Create a MediaShowInfo object.
 * @param source An event or HTMLElement that should be used as a source.
 * @returns A new MediaShowInfo object or null if one could not be created.
 */
export function createMediaShowInfo(source: Event | HTMLElement): MediaShowInfo | null {
  let target: HTMLElement | EventTarget;
  if (source instanceof Event) {
    target = source.composedPath()[0];
  } else {
    target = source;
  }

  if (target instanceof HTMLImageElement) {
    return {
      width: (target as HTMLImageElement).naturalWidth,
      height: (target as HTMLImageElement).naturalHeight,
    };
  } else if (target instanceof HTMLVideoElement) {
    return {
      width: (target as HTMLVideoElement).videoWidth,
      height: (target as HTMLVideoElement).videoHeight,
    };
  } else if (target instanceof HTMLCanvasElement) {
    return {
      width: (target as HTMLCanvasElement).width,
      height: (target as HTMLCanvasElement).height,
    };
  }
  return null;
}

/**
 * Dispatch a Frigate card media show event.
 * @param element The element to send the event.
 * @param source An event or HTMLElement that should be used as a source.
 */
export function dispatchMediaShowEvent(
  element: HTMLElement,
  source: Event | HTMLElement,
): void {
  const mediaShowInfo = createMediaShowInfo(source);
  if (mediaShowInfo) {
    dispatchExistingMediaShowInfoAsEvent(element, mediaShowInfo);
  }
}

/**
 * Dispatch a pre-existing MediaShowInfo object as an event.
 * @param element The element to send the event.
 * @param mediaShowInfo The MediaShowInfo object to send.
 */
export function dispatchExistingMediaShowInfoAsEvent(
  element: HTMLElement,
  mediaShowInfo: MediaShowInfo,
): void {
  dispatchFrigateCardEvent<MediaShowInfo>(element, 'media-show', mediaShowInfo);
}

/**
 * Dispatch an event with a message to show to the user.
 * @param element The element to send the event.
 * @param message The message to show.
 * @param icon An optional icon to attach to the message.
 */
export function dispatchMessageEvent(
  element: HTMLElement,
  message: string,
  icon?: string,
): void {
  dispatchFrigateCardEvent<Message>(element, 'message', {
    message: message,
    type: 'info',
    icon: icon,
  });
}

/**
 * Dispatch an event with an error message to show to the user.
 * @param element The element to send the event.
 * @param message The message to show.
 */
export function dispatchErrorMessageEvent(element: HTMLElement, message: string): void {
  dispatchFrigateCardEvent<Message>(element, 'message', {
    message: message,
    type: 'error',
  });
}

/**
 * Determine whether the card should be updated based on Home Assistant changes.
 * @param newHass The new HA object.
 * @param oldHass The old HA object.
 * @param entities The entities to examine for changes.
 * @returns A boolean indicating whether or not to allow an update.
 */
export function shouldUpdateBasedOnHass(
  newHass: HomeAssistant | undefined | null,
  oldHass: HomeAssistant | undefined | null,
  entities: string[] | null,
): boolean {
  if (!newHass || !entities || !entities.length) {
    return false;
  }

  if (oldHass) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!entity) {
        continue;
      }
      if (oldHass.states[entity] !== newHass.states[entity]) {
        return true;
      }
    }
    return false;
  }
  return false;
}

/**
 * Determine if a MediaShowInfo object is valid/acceptable.
 * @param info The MediaShowInfo object.
 * @returns True if the object is valid, false otherwise.
 */
export function isValidMediaShowInfo(info: MediaShowInfo): boolean {
  return (
    info.height >= MEDIA_INFO_HEIGHT_CUTOFF && info.width >= MEDIA_INFO_WIDTH_CUTOFF
  );
}

/**
 * Convert a generic Action to a FrigateCardCustomAction if it parses correctly.
 * @param action The generic action configuration.
 * @returns A FrigateCardCustomAction or null if it cannot be converted.
 */
export function convertActionToFrigateCardCustomAction(
  action: ActionType | null,
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
 * @returns A FrigateCardCustomAction for that action string.
 */
export function createFrigateCardCustomAction(
  action: FrigateCardAction,
  camera?: string,
): FrigateCardCustomAction | undefined {
  if (action == 'camera_select') {
    if (!camera) {
      return undefined;
    }
    return {
      action: 'fire-dom-event',
      frigate_card_action: action,
      camera: camera,
    };
  }
  return {
    action: 'fire-dom-event',
    frigate_card_action: action,
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
 * Calculate a style brightness from a hass state.
 * Inspired by https://github.com/home-assistant/frontend/blob/7d5b5663123bb16d1da0c5bac3f2fc26d5f69ae8/src/panels/lovelace/cards/hui-button-card.ts#L296
 * @param state The hass state object.
 * @returns A CSS brightness string.
 */
function computeBrightnessFromState(state: HassEntity): string {
  if (state.state === 'off' || !state.attributes.brightness) {
    return '';
  }
  const brightness = state.attributes.brightness;
  return `brightness(${(brightness + 245) / 5}%)`;
}

/**
 * Calculate a style color from a hass state.
 * Inspired by https://github.com/home-assistant/frontend/blob/7d5b5663123bb16d1da0c5bac3f2fc26d5f69ae8/src/panels/lovelace/cards/hui-button-card.ts#L304
 * @param state The hass state object.
 * @returns A CSS color string.
 */
function computeColorFromState(state: HassEntity): string {
  if (state.state === 'off') {
    return '';
  }
  return state.attributes.rgb_color
    ? `rgb(${state.attributes.rgb_color.join(',')})`
    : '';
}

/**
 * Get the style of emphasized menu items.
 * @returns A StyleInfo.
 */
function computeStyle(state: HassEntity): StyleInfo {
  return {
    color: computeColorFromState(state),
    filter: computeBrightnessFromState(state),
  };
}

/**
 * Determine the string state of a given stateObj.
 * From: https://github.com/home-assistant/frontend/blob/dev/src/common/entity/compute_active_state.ts
 * @param stateObj The HassEntity object from `hass.states`.
 * @returns A string state, e.g. 'on'.
 */
export const computeActiveState = (stateObj: HassEntity): string => {
  const domain = stateObj.entity_id.split('.')[0];
  let state = stateObj.state;

  if (domain === 'climate') {
    state = stateObj.attributes.hvac_action;
  }

  return state;
};

/**
 * Use Home Assistant state to refresh state parameters for an item to be rendered.
 * @param hass Home Assistant object.
 * @param params A StateParameters object to modify in place.
 * @returns A StateParameters object updated based on HASS state.
 */
export function refreshDynamicStateParameters(
  hass: HomeAssistant,
  params: StateParameters,
): StateParameters {
  if (!params.entity) {
    return params;
  }
  const state = hass.states[params.entity];
  if (!!state && !!params.state_color) {
    params.style = { ...computeStyle(state), ...params.style };
  }
  params.title = params.title ?? (state?.attributes?.friendly_name || params.entity);
  params.icon = params.icon ?? stateIcon(state);

  const domain = state ? computeStateDomain(state) : undefined;
  params.data_domain =
    params.state_color || (domain === 'light' && params.state_color !== false)
      ? domain
      : undefined;
  params.data_state = computeActiveState(state);
  return params;
}

/**
 * Prettify a Frigate name by converting '_' to spaces and capitalizing words.
 * @param input The input Frigate (camera/label/zone) name.
 * @returns A prettified name.
 */
export function prettifyFrigateName(input?: string): string | undefined {
  if (!input) {
    return undefined;
  }
  const words = input.split(/[_\s]+/);
  return words
    .map((word) => {
      return word[0].toUpperCase() + word.substring(1);
    })
    .join(' ');
}

/**
 * Get the title of an entity.
 * @param entity The entity id.
 * @param hass The Home Assistant object.
 * @returns The title or undefined.
 */
export function getEntityTitle(
  hass?: HomeAssistant,
  entity?: string,
): string | undefined {
  return entity ? hass?.states[entity]?.attributes?.friendly_name : undefined;
}

/**
 * Get the icon of an entity.
 * @param entity The entity id.
 * @param hass The Home Assistant object.
 * @returns The icon or undefined.
 */
export function getEntityIcon(
  hass?: HomeAssistant,
  entity?: string,
): string | undefined {
  return hass && entity ? stateIcon(hass.states[entity]) : undefined;
}

/**
 * Get a camera text title.
 * @param hass The Home Assistant object.
 * @param config The camera config.
 * @returns A title string.
 */
export function getCameraTitle(
  hass?: HomeAssistant,
  config?: CameraConfig | null,
): string {
  return (
    config?.title ||
    (config?.camera_entity ? getEntityTitle(hass, config.camera_entity) : '') ||
    (config?.camera_name ? prettifyFrigateName(config.camera_name) : '') ||
    ''
  );
}

/**
 * Get a camera icon.
 * @param hass The Home Assistant object.
 * @param config The camera config.
 * @returns An icon string.
 */
export function getCameraIcon(
  hass?: HomeAssistant,
  config?: CameraConfig | null,
): string {
  return config?.icon || getEntityIcon(hass, config?.camera_entity) || 'mdi:video';
}

/**
 * Move an element within an array.
 * @param target Target array.
 * @param from From index.
 * @param to To index.
 */
export function arrayMove(target: unknown[], from: number, to: number): void {
  const element = target[from];
  target.splice(from, 1);
  target.splice(to, 0, element);
}

/**
 * Determine if the contents of the n(ew) and o(ld) values have changed. For use
 * in lit web components that may have a value that changes address but not
 * contents -- and for which a re-render is expensive/jarring.
 * @param n The new value.
 * @param o The old value.
 * @returns `true` is the contents have changed.
 */
export function contentsChanged(n: unknown, o: unknown): boolean {
  return !isEqual(n, o);
}

/**
 * Frigate card custom version of handleAction
 * (https://github.com/custom-cards/custom-card-helpers/blob/master/src/handle-action.ts)
 * that handles the custom action events the card supports.
 * @param node The node that fired the event.
 * @param hass The Home Assistant object.
 * @param config The multi-action configuration.
 * @param action The action string (e.g. 'hold')
 * @returns Whether or not an action was executed.
 */
export const frigateCardHandleAction = (
  node: HTMLElement,
  hass: HomeAssistant,
  config: ActionsConfig,
  action: string,
): boolean => {
  return frigateCardHandleActionConfig(
    node,
    hass,
    config,
    action,
    getActionConfigGivenAction(action, config),
  );
};

/**
 * Handle an ActionConfig or array of ActionConfigs.
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
  actionConfig: ActionType | ActionType[] | undefined,
): boolean => {
  if (actionConfig || action == 'tap') {
    // Only allow a tap action to use a default non-config (the more-info config).
    if (Array.isArray(actionConfig)) {
      actionConfig.forEach((action) => handleActionConfig(node, hass, config, action));
    } else {
      handleActionConfig(node, hass, config, actionConfig);
    }
    return true;
  }
  return false;
};

/**
 * Determine if an action config has a real action. A modified version of
 * custom-card-helpers hasAction to also work with arrays of action configs.
 * @param config The action config in question.
 * @returns `true` if there's a real action defined, `false` otherwise.
 */
export const frigateCardHasAction = (
  config?: ActionType | ActionType[] | undefined,
): boolean => {
  if (Array.isArray(config)) {
    return !!config.find((item) => hasAction(item));
  }
  return hasAction(config);
};
