import { get, set } from 'lodash-es';
import {
  CONF_CAMERAS,
  CONF_CAMERAS_ARRAY_CAMERA_ENTITY,
  CONF_CAMERAS_ARRAY_CAMERA_NAME,
  CONF_CAMERAS_ARRAY_CLIENT_ID,
  CONF_CAMERAS_ARRAY_LABEL,
  CONF_CAMERAS_ARRAY_LIVE_PROVIDER,
  CONF_CAMERAS_ARRAY_URL,
  CONF_CAMERAS_ARRAY_ZONE,
  CONF_EVENT_VIEWER_AUTO_PLAY,
  CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_SIZE,
  CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE,
  CONF_IMAGE_SRC,
  CONF_LIVE_PRELOAD,
  CONF_LIVE_WEBRTC_CARD,
  CONF_MENU,
  CONF_MENU_BUTTON_SIZE,
  CONF_MENU_MODE,
  CONF_OVERRIDES,
  CONF_VIEW_DEFAULT,
  CONF_VIEW_TIMEOUT_SECONDS,
  CONF_VIEW_UPDATE_ENTITIES,
} from './const';
import { RawFrigateCardConfig, RawFrigateCardConfigArray } from './types';

/**
 * Set a configuration value.
 * @param obj The configuration.
 * @param key The key to the property to set.
 * @param value The value to set.
 */

export const setConfigValue = (
  obj: RawFrigateCardConfig,
  keys: string | (string | number)[],
  value: unknown,
): void => {
  set(obj, keys, value);
};

/**
 * Get a configuration value.
 * @param obj The configuration.
 * @param key The key to the property to retrieve.
 * @returns The property or undefined if not found.
 */
export const getConfigValue = (
  obj: RawFrigateCardConfig,
  keys: string | (string | number)[],
  def?: unknown,
): unknown => {
  return get(obj, keys, def);
};

/**
 * Delete a configuration value.
 * @param obj The configuration.
 * @param key The key to the property to delete.
 */
export const deleteConfigValue = (obj: RawFrigateCardConfig, key: string): void => {
  let id = key;
  let targetObj: unknown = obj;
  if (key && key.split && key.includes('.')) {
    const keys = key.split('.');
    id = keys[keys.length - 1];
    targetObj = getConfigValue(obj, keys.slice(0, -1).join('.'));
  }
  if (targetObj && typeof targetObj === 'object') {
    delete targetObj[id];
  }
};

/**
 * Upgrade a configuration.
 * @param obj The configuration to upgrade.
 * @returns `true` if the configuration is modified.
 */
export const upgradeConfig = function (obj: RawFrigateCardConfig): boolean {
  let upgraded = false;
  for (let i = 0; i < UPGRADES.length; i++) {
    upgraded = UPGRADES[i](obj) || upgraded;
  }
  trimConfig(obj);
  return upgraded;
};

/**
 * Determine if a configuration is automatically upgradeable.
 * @param obj The configuration. It is not modified.
 * @returns `true` if the configuration is upgradeable.
 */
export const isConfigUpgradeable = function (obj: RawFrigateCardConfig): boolean {
  const newObj = JSON.parse(JSON.stringify(obj));
  return upgradeConfig(newObj);
};

/**
 * Remove empty sections from a configuration.
 * @param obj Configuration object.
 * @returns `true` if the configuration was modified.
 */
export const trimConfig = function (obj: RawFrigateCardConfig): boolean {
  const keys = Object.keys(obj);
  let modified = false;
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (typeof obj[key] === 'object' && obj[key] != null) {
      modified ||= trimConfig(obj[key] as RawFrigateCardConfig);

      if (!Object.keys(obj[key] as RawFrigateCardConfig).length) {
        delete obj[key];
        modified = true;
      }
    }
  }
  return modified;
};

/**
 * Copy a configuration.
 * @param obj Configuration to copy.
 * @returns A new deeply-copied configuration.
 */
export const copyConfig = function (obj: RawFrigateCardConfig): RawFrigateCardConfig {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Determines if a property is not an object.
 * @param value The value.
 * @returns `true` is the value is not an object.
 */
const isNotObject = function (value: unknown) {
  return typeof value !== 'object' ? value : undefined;
};

/**
 * Converts to a number or return undefined.
 * @param value The value.
 * @returns A number or undefined.
 */
const toNumberOrIgnore = function (value: unknown) {
  return isNaN(value as number) ? undefined : Number(value);
};

/**
 * Move a property from one location to another.
 * @param obj The configuration object in which the property resides.
 * @param oldPath The old property path.
 * @param newPath The new property path.
 * @param transform An optional transform for the value.
 * @returns `true` if the configuration was modified.
 */
export const moveConfigValue = (
  obj: RawFrigateCardConfig,
  oldPath: string,
  newPath: string,
  transform?: (valueIn: unknown) => unknown,
): boolean => {
  let value = getConfigValue(obj, oldPath);
  if (transform) {
    value = transform(value);
  }
  if (typeof value !== 'undefined') {
    deleteConfigValue(obj, oldPath);
    setConfigValue(obj, newPath, value);
    return true;
  }
  return false;
};

/**
 * Given an array path, return a true path.
 * @param path The array path (should have a '#').
 * @param index The numeric array index to use.
 * @returns The true config path.
 */
export const getArrayConfigPath = (path: string, index: number): string => {
  return path.replace('#', `[${index.toString()}]`);
};

/**
 * Upgrade by moving a property from one location to another.
 * @param oldPath The old property path.
 * @param newPath The new property path.
 * @param transform An optional transform for the value.
 * @returns `true` if the configuration was modified.
 */
const upgradeMoveTo = function (
  oldPath: string,
  newPath: string,
  transform?: (valueIn: unknown) => unknown,
): (obj: RawFrigateCardConfig) => boolean {
  return function (obj: RawFrigateCardConfig): boolean {
    return moveConfigValue(obj, oldPath, newPath, transform);
  };
};

/**
 * Upgrade a property by changing it if it is present.
 * @param path The property path.
 * @param transform A callback that transforms the old value to the new value,
 * if undefined is returned the property is removed.
 * @returns `true` if the configuration was modified.
 */
const upgradeChangeIfPresent = function (
  path: string,
  transform: (valueIn: unknown) => unknown,
): (obj: RawFrigateCardConfig) => boolean {
  return function (obj: RawFrigateCardConfig): boolean {
    const oldValue = getConfigValue(obj, path);
    if (oldValue !== undefined) {
      const newValue = transform(oldValue);
      if (newValue === undefined) {
        deleteConfigValue(obj, path);
        return true;
      } else if (newValue !== oldValue) {
        setConfigValue(obj, path, newValue);
        return true;
      }
    }
    return false;
  };
};

/**
 * Upgrade by moving a property from one location to another, and moving a
 * property specified in a top-level overrides object.
 * @param oldPath The old property path.
 * @param newPath The new property path.
 * @param transform An optional transform for the value.
 * @returns A function that returns `true` if the configuration was modified.
 */
const upgradeMoveToWithOverrides = function (
  oldPath: string,
  newPath: string,
  transform?: (valueIn: unknown) => unknown,
): (obj: RawFrigateCardConfig) => boolean {
  return function (obj: RawFrigateCardConfig): boolean {
    let modified = upgradeMoveTo(oldPath, newPath, transform)(obj);
    modified =
      upgradeArrayValue(
        CONF_OVERRIDES,
        upgradeMoveTo(oldPath, newPath, transform),
        (obj) => obj.overrides as RawFrigateCardConfig | undefined,
      )(obj) || modified;
    return modified;
  };
};

/**
 * Given a path to an array, apply an upgrade to each object in the array.
 * @param arrayPath The path to the array to upgrade.
 * @param upgrade A function that applies an upgrade to an object.
 * @param getObject A optional function that takes an item in the array and
 * returns the object to modify within it.
 * @returns A function that returns `true` if the configuration was modified.
 */
const upgradeArrayValue = function (
  arrayPath: string,
  upgrade: (obj: RawFrigateCardConfig) => boolean,
  getObject?: (obj: RawFrigateCardConfig) => RawFrigateCardConfig | undefined,
): (obj: RawFrigateCardConfig) => boolean {
  return function (obj: RawFrigateCardConfig): boolean {
    let modified = false;
    const array = getConfigValue(obj, arrayPath);
    if (Array.isArray(array)) {
      array.forEach((item) => {
        const object = getObject ? getObject(item) : item;
        if (object && typeof object === 'object') {
          modified = upgrade(object) || modified;
        }
      });
    }
    return modified;
  };
};

/**
 * Upgrade from a singular camera model to multiple.
 * @param key A string key.
 * @returns A safe key.
 */
const upgradeToMultipleCameras = (): ((obj: RawFrigateCardConfig) => boolean) => {
  return function (obj: RawFrigateCardConfig): boolean {
    let modified = false;
    const cameras = getConfigValue(obj, CONF_CAMERAS) as RawFrigateCardConfigArray;

    // Only do an upgrade if the cameras section does not exist.
    if (cameras !== undefined) {
      return false;
    }

    const imports = {
      camera_entity: CONF_CAMERAS_ARRAY_CAMERA_ENTITY,
      'frigate.camera_name': CONF_CAMERAS_ARRAY_CAMERA_NAME,
      'frigate.client_id': CONF_CAMERAS_ARRAY_CLIENT_ID,
      'frigate.label': CONF_CAMERAS_ARRAY_LABEL,
      'frigate.url': CONF_CAMERAS_ARRAY_URL,
      'frigate.zone': CONF_CAMERAS_ARRAY_ZONE,
      'live.webrtc.entity': `cameras.#.webrtc.entity`,
      'live.webrtc.url': `cameras.#.webrtc.url`,
      'live.provider': CONF_CAMERAS_ARRAY_LIVE_PROVIDER,
    };
    Object.keys(imports).forEach((key) => {
      modified =
        moveConfigValue(obj, key, getArrayConfigPath(imports[key], 0)) || modified;
    });
    return modified;
  };
};

/**
 * Upgrade from a condition on the menu (to allow rendering) to a menu mode
 * override instead.
 * @param key A string key.
 * @returns A safe key.
 */
const updateMenuConditionToMenuOverride = (): ((
  obj: RawFrigateCardConfig,
) => boolean) => {
  return function (obj: RawFrigateCardConfig): boolean {
    const menuConditions = getConfigValue(
      obj,
      `${CONF_MENU}.conditions`,
    ) as RawFrigateCardConfig;

    if (menuConditions === undefined) {
      return false;
    }

    const overrides =
      (getConfigValue(obj, `${CONF_OVERRIDES}`) as RawFrigateCardConfigArray) || [];
    setConfigValue(obj, `${CONF_OVERRIDES}.[${overrides.length}]`, {
      conditions: menuConditions,
      overrides: {
        menu: {
          mode: 'none',
        },
      },
    });
    deleteConfigValue(obj, `${CONF_MENU}.conditions`);
    return true;
  };
};

const UPGRADES = [
  // v1.2.1 -> v2.0.0
  upgradeMoveTo('frigate_url', 'frigate.url'),
  upgradeMoveTo('frigate_client_id', 'frigate.client_id'),
  upgradeMoveTo('frigate_camera_name', 'frigate.camera_name'),
  upgradeMoveTo('label', 'frigate.label'),
  upgradeMoveTo('zone', 'frigate.zone'),
  upgradeMoveTo('view_default', CONF_VIEW_DEFAULT),
  upgradeMoveTo('view_timeout', 'view.timeout'),
  upgradeMoveTo('live_provider', 'live.provider'),
  upgradeMoveTo('live_preload', CONF_LIVE_PRELOAD),
  upgradeMoveTo('webrtc', 'live.webrtc'),
  upgradeMoveTo('autoplay_clip', 'event_viewer.autoplay_clip'),
  upgradeMoveTo('controls.nextprev', CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE),
  upgradeMoveTo('controls.nextprev_size', CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_SIZE),
  upgradeMoveTo('menu_mode', CONF_MENU_MODE),
  upgradeMoveTo('menu_buttons', 'menu.buttons'),
  upgradeMoveTo('menu_button_size', CONF_MENU_BUTTON_SIZE),
  upgradeMoveTo('image', CONF_IMAGE_SRC, isNotObject),

  // v2.0.0 -> v2.1.0
  upgradeMoveTo('update_entities', CONF_VIEW_UPDATE_ENTITIES),

  // v2.1.0 -> v3.0.0-rc.1
  upgradeToMultipleCameras(),
  updateMenuConditionToMenuOverride(),
  upgradeMoveTo('view.timeout', CONF_VIEW_TIMEOUT_SECONDS, toNumberOrIgnore),
  upgradeMoveTo('event_viewer.autoplay_clip', CONF_EVENT_VIEWER_AUTO_PLAY),

  // v3.0.0-rc.1 -> v3.0.0-rc.2
  upgradeArrayValue(
    CONF_CAMERAS,
    upgradeChangeIfPresent('live_provider', (val) => (val === 'frigate' ? 'ha' : val)),
  ),
  upgradeArrayValue(CONF_CAMERAS, upgradeMoveTo('webrtc', 'webrtc_card')),
  upgradeMoveToWithOverrides('live.webrtc', CONF_LIVE_WEBRTC_CARD),
];
