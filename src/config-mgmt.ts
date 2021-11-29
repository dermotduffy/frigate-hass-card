import delve from 'dlv';
import { dset } from 'dset';
import {
  CONF_EVENT_VIEWER_AUTOPLAY_CLIP,
  CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_SIZE,
  CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE,
  CONF_FRIGATE_CAMERA_NAME,
  CONF_FRIGATE_CLIENT_ID,
  CONF_FRIGATE_LABEL,
  CONF_FRIGATE_URL,
  CONF_FRIGATE_ZONE,
  CONF_IMAGE_SRC,
  CONF_LIVE_PRELOAD,
  CONF_LIVE_PROVIDER,
  CONF_MENU_BUTTON_SIZE,
  CONF_MENU_MODE,
  CONF_VIEW_DEFAULT,
  CONF_VIEW_TIMEOUT,
  CONF_VIEW_UPDATE_ENTITIES,
} from './const';
import { RawFrigateCardConfig } from './types';

/**
 * Set a configuration value.
 * @param obj The configuration.
 * @param key The key to the property to set.
 * @param value The value to set.
 */
export const setConfigValue = (
  obj: RawFrigateCardConfig,
  key: string,
  value: unknown,
): void => {
  dset(obj, key, value);
};

/**
 * Get a configuration value.
 * @param obj The configuration.
 * @param key The key to the property to retrieve.
 * @returns The property or undefined if not found.
 */
export const getConfigValue = (
  obj: RawFrigateCardConfig,
  key: string,
  def?: unknown,
): unknown => {
  return delve(obj, key, def);
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
 */
export const trimConfig = function (obj: RawFrigateCardConfig): void {
  const keys = Object.keys(obj);
  for (let i = 0; i < keys.length; i++) {
    const key = keys[i];
    if (typeof obj[key] === 'object' && obj[key] != null) {
      trimConfig(obj[key] as RawFrigateCardConfig);

      if (!Object.keys(obj[key] as RawFrigateCardConfig).length) {
        delete obj[key];
      }
    }
  }
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
 * @param value The property.
 * @returns `true` is the value is not an object.
 */
const isNotObject = function (value: unknown) {
  return typeof value !== 'object' ? value : undefined;
};

/**
 * Move a property from one location to another.
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
};

const UPGRADES = [
  // v1.2.1 -> v2.0.0
  upgradeMoveTo('frigate_url', CONF_FRIGATE_URL),
  upgradeMoveTo('frigate_client_id', CONF_FRIGATE_CLIENT_ID),
  upgradeMoveTo('frigate_camera_name', CONF_FRIGATE_CAMERA_NAME),
  upgradeMoveTo('label', CONF_FRIGATE_LABEL),
  upgradeMoveTo('zone', CONF_FRIGATE_ZONE),
  upgradeMoveTo('view_default', CONF_VIEW_DEFAULT),
  upgradeMoveTo('view_timeout', CONF_VIEW_TIMEOUT),
  upgradeMoveTo('live_provider', CONF_LIVE_PROVIDER),
  upgradeMoveTo('live_preload', CONF_LIVE_PRELOAD),
  upgradeMoveTo('webrtc', 'live.webrtc'),
  upgradeMoveTo('autoplay_clip', CONF_EVENT_VIEWER_AUTOPLAY_CLIP),
  upgradeMoveTo('controls.nextprev', CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE),
  upgradeMoveTo('controls.nextprev_size', CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_SIZE),
  upgradeMoveTo('menu_mode', CONF_MENU_MODE),
  upgradeMoveTo('menu_buttons', 'menu.buttons'),
  upgradeMoveTo('menu_button_size', CONF_MENU_BUTTON_SIZE),
  upgradeMoveTo('image', CONF_IMAGE_SRC, isNotObject),

  // v2.0.0 -> v2.1.0
  upgradeMoveTo('update_entities', CONF_VIEW_UPDATE_ENTITIES),
];
