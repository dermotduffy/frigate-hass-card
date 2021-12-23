import { HassEntity, MessageBase } from 'home-assistant-js-websocket';
import { HomeAssistant, stateIcon } from 'custom-card-helpers';
import { StyleInfo } from 'lit/directives/style-map';
import { ZodSchema, z } from 'zod';

import { localize } from './localize/localize.js';
import {
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
): Promise<T | null> {
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
 * Dispatch a Frigate card play event.
 * @param element The element to send the event.
 */
export function dispatchPlayEvent(element: HTMLElement): void {
  dispatchFrigateCardEvent(element, 'play');
}

/**
 * Dispatch a Frigate card pause event.
 * @param element The element to send the event.
 */
export function dispatchPauseEvent(element: HTMLElement): void {
  dispatchFrigateCardEvent(element, 'pause');
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
  if (!newHass || !entities) {
    return false;
  }
  if (!entities.length) {
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
  config?: {
    hold_action?: ActionType;
    tap_action?: ActionType;
    double_tap_action?: ActionType;
  },
): ActionType | null {
  if (!interaction || !config) {
    return null;
  }
  if (interaction == 'tap' && config.tap_action) {
    return config.tap_action;
  } else if (interaction == 'hold' && config.hold_action) {
    return config.hold_action;
  } else if (interaction == 'double_tap' && config.double_tap_action) {
    return config.double_tap_action;
  }
  return null;
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
  if (
    !!state &&
    !!params.state_color &&
    ['on', 'active', 'home'].includes(state.state)
  ) {
    params.style = { ...computeStyle(state), ...params.style };
  }
  params.title = params.title ?? (state?.attributes?.friendly_name || params.entity);
  params.icon = params.icon ?? stateIcon(state);
  return params;
}

function prettifyCameraName(input: string): string {
  const words = input.split(/[_\s]+/);
  return words
    .map((word) => {
      return word[0].toUpperCase() + word.substring(1);
    })
    .join(' ');
}

export function refreshCameraConfigDynamicParameters(
  config: CameraConfig,
  hass?: HomeAssistant,
): CameraConfig {
  const state =
    hass && config.camera_entity ? hass.states[config.camera_entity] : undefined;
  config.title =
    config.title ??
    (state?.attributes?.friendly_name || prettifyCameraName(config.camera_name || ''));
  config.icon = config.icon ?? (state ? stateIcon(state) : 'mdi:video');
  return config;
}
