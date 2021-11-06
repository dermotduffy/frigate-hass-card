import delve from 'dlv';
import { dset } from 'dset';
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
export const getConfigValue = (obj: RawFrigateCardConfig, key: string, def?: unknown): unknown => {
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
}

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
  upgradeMoveTo('frigate_url', 'frigate.url'),
  upgradeMoveTo('frigate_client_id', 'frigate.client_id'),
  upgradeMoveTo('frigate_camera_name', 'frigate.camera_name'),
  upgradeMoveTo('label', 'frigate.label'),
  upgradeMoveTo('zone', 'frigate.zone'),
  upgradeMoveTo('view_default', 'view.default'),
  upgradeMoveTo('view_timeout', 'view.timeout'),
  upgradeMoveTo('live_provider', 'live.provider'),
  upgradeMoveTo('live_preload', 'live.preload'),
  upgradeMoveTo('webrtc', 'live.webrtc'),
  upgradeMoveTo('autoplay_clip', 'event_viewer.autoplay_clip'),
  upgradeMoveTo('controls.nextprev', 'event_viewer.controls.next_previous.style'),
  upgradeMoveTo('controls.nextprev_size', 'event_viewer.controls.next_previous.size'),
  upgradeMoveTo('menu_mode', 'menu.mode'),
  upgradeMoveTo('menu_buttons', 'menu.buttons'),
  upgradeMoveTo('menu_button_size', 'menu.button_size'),
  upgradeMoveTo('image', 'image.src', isNotObject),
];
