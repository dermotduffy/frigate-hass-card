import { computeStateDomain, HomeAssistant } from 'custom-card-helpers';
import { HassEntity, MessageBase } from 'home-assistant-js-websocket';
import { StyleInfo } from 'lit/directives/style-map.js';
import { ZodSchema } from 'zod';
import { localize } from '../../localize/localize.js';
import {
    CardHelpers,
    ExtendedHomeAssistant,
    SignedPath,
    signedPathSchema,
    StateParameters
} from '../../types.js';
import { stateIcon } from '../icons/state-icon.js';
import { getParseErrorKeys } from '../zod.js';

/**
 * Make a HomeAssistant websocket request. May throw.
 * @param hass The HomeAssistant object to send the request with.
 * @param schema The expected Zod schema of the response.
 * @param request The request to make.
 * @returns The parsed valid response or null on malformed.
 */
export async function homeAssistantWSRequest<T>(
  hass: HomeAssistant,
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
  hass: ExtendedHomeAssistant,
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
  if (!oldHass) {
    return true;
  }

  for (let i = 0; i < entities.length; i++) {
    const entity = entities[i];
    if (entity && oldHass.states[entity] !== newHass.states[entity]) {
      return true;
    }
  }
  return false;
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
  if (state) {
    params.data_state = computeActiveState(state);
  }
  return params;
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
export function getEntityIcon(hass?: HomeAssistant, entity?: string): string {
  return stateIcon(entity ? hass?.states[entity] : null);
}

/**
 * Side loads the HA elements this card needs. This trickery is unfortunate
 * necessary, see:
 *  - https://github.com/thomasloven/hass-config/wiki/PreLoading-Lovelace-Elements
 * @returns `true` if the load is successful, `false` otherwise.
 */
export const sideLoadHomeAssistantElements = async (): Promise<boolean> => {
  const neededElements = [
    'ha-selector',
    'ha-menu-button',
    'ha-camera-stream',
    'ha-hls-player',
    'ha-web-rtc-player',
    'ha-icon',
    'ha-circular-progress',
    'ha-icon-button',
    'ha-card',
    'ha-svg-icon',
    'ha-button-menu',
  ];

  if (neededElements.every((element) => customElements.get(element))) {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const helpers: CardHelpers = await (window as any).loadCardHelpers();

  // The picture-glance editor loads everything this card needs.
  const pictureGlance = await helpers.createCardElement({
    type: 'picture-glance',
    entities: [],
    camera_image: 'dummy-to-load-editor-components',
  });
  if (pictureGlance.constructor.getConfigElement) {
    await pictureGlance.constructor.getConfigElement();
    return true;
  }
  return false;
};
