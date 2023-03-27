import { computeStateDomain, HomeAssistant } from 'custom-card-helpers';
import { HassEntity, MessageBase } from 'home-assistant-js-websocket';
import { StyleInfo } from 'lit/directives/style-map.js';
import { ZodSchema } from 'zod';
import { localize } from '../../localize/localize.js';
import {
  CardHelpers,
  ExtendedHomeAssistant,
  FrigateCardError,
  SignedPath,
  signedPathSchema,
  StateParameters,
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
  passthrough = false,
): Promise<T> {
  let response;
  try {
    response = await hass.callWS<T>(request);
  } catch (e) {
    if (!(e instanceof Error)) {
      throw new FrigateCardError(localize('error.failed_response'), {
        request: request,
        response: e,
      });
    }
    throw e;
  }

  if (!response) {
    throw new FrigateCardError(localize('error.empty_response'), {
      request: request,
    });
  }
  // Some endpoints on the integration pass through JSON directly from Frigate
  // These end up wrapped in a string and must be unwrapped first
  const parseResult = passthrough
    ? schema.safeParse(JSON.parse(response))
    : schema.safeParse(response);
  if (!parseResult.success) {
    throw new FrigateCardError(localize('error.invalid_response'), {
      request: request,
      response: response,
      invalid_keys: getParseErrorKeys<T>(parseResult.error),
    });
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

interface HassStateDifference {
  entity: string;
  oldState?: HassEntity;
  newState: HassEntity;
}

/**
 * Get the difference between two hass objects.
 * @param newHass The new HA object.
 * @param oldHass The old HA object.
 * @param entities The entities to examine for changes.
 * @param options An options object. stateOnly: whether or not to compare state
 * strings only, firstOnly: whether or not to get the first difference only.
 * @returns An array of HassStateDifference objects.
 */
export function getHassDifferences(
  newHass: HomeAssistant | undefined | null,
  oldHass: HomeAssistant | undefined | null,
  entities: string[] | null,
  options?: {
    firstOnly?: boolean;
    stateOnly?: boolean;
  },
): HassStateDifference[] {
  if (!newHass || !entities || !entities.length) {
    return [];
  }

  const differences: HassStateDifference[] = [];
  for (const entity of entities) {
    const oldState: HassEntity | undefined = oldHass?.states[entity];
    const newState: HassEntity | undefined = newHass.states[entity];
    if (
      (options?.stateOnly && oldState?.state !== newState?.state) ||
      (!options?.stateOnly && oldState !== newState)
    ) {
      differences.push({
        entity: entity,
        oldState: oldState,
        newState: newState,
      });
      if (options?.firstOnly) {
        break;
      }
    }
  }
  return differences;
}

/**
 * Determine if two hass objects are different for a list of entities.
 * @param newHass The new HA object.
 * @param oldHass The old HA object.
 * @param entities The entities to examine for changes.
 * @param options An options object. stateOnly: whether or not to compare state strings only.
 * @returns An array of HassStateDifference objects.
 */
export function isHassDifferent(
  newHass: HomeAssistant | undefined | null,
  oldHass: HomeAssistant | undefined | null,
  entities: string[] | null,
  options?: {
    stateOnly?: boolean;
  },
): boolean {
  return !!getHassDifferences(newHass, oldHass, entities, {
    ...options,
    firstOnly: true,
  }).length;
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
const computeActiveState = (stateObj: HassEntity): string => {
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

/**
 * Determine if a given state qualifies as 'triggered'.
 * @param state The HASSEntity.
 * @returns `true` if triggered, `false` otherwise.
 */
export const isTriggeredState = (state?: HassEntity): boolean => {
  return !!state && ['on', 'open'].includes(state.state);
};

/**
 * Get entities from the HASS object.
 * @param hass
 * @param domain
 * @returns A list of entities ids.
 */
export const getEntitiesFromHASS = (hass: HomeAssistant, domain?: string): string[] => {
  if (!hass) {
    return [];
  }
  const entities = Object.keys(hass.states).filter(
    (eid) => !domain || eid.substr(0, eid.indexOf('.')) === domain,
  );
  entities.sort();
  return entities;
};

/**
 * Determine if a card is in panel mode.
 */
export const isCardInPanel = (card: HTMLElement): boolean => {
  const parent = card.getRootNode();
  return !!(
    parent &&
    parent instanceof ShadowRoot &&
    parent.host.tagName === 'HUI-PANEL-VIEW'
  );
};

/**
 * Ensure URLs use the correct HA URL (relevant for Chromecast where the default
 * location will be the Chromecast receiver, not HA).
 * @param url The media URL
 */
export function canonicalizeHAURL(hass: ExtendedHomeAssistant, url: string): string;
export function canonicalizeHAURL(
  hass: ExtendedHomeAssistant,
  url?: string,
): string | null {
  if (hass && url && url.startsWith('/')) {
    return hass.hassUrl(url);
  }
  return url ?? null;
}
