import cloneDeep from 'lodash-es/cloneDeep'
import get from 'lodash-es/get';
import isEqual from 'lodash-es/isEqual';
import set from 'lodash-es/set';
import {
  CONF_CAMERAS,
  CONF_CAMERAS_ARRAY_CAMERA_ENTITY,
  CONF_CAMERAS_ARRAY_LIVE_PROVIDER,
  CONF_IMAGE_URL,
  CONF_LIVE_AUTO_UNMUTE,
  CONF_LIVE_CONTROLS_NEXT_PREVIOUS_SIZE,
  CONF_LIVE_CONTROLS_THUMBNAILS_SIZE,
  CONF_LIVE_LAZY_UNLOAD,
  CONF_LIVE_PRELOAD,
  CONF_LIVE_WEBRTC_CARD,
  CONF_MEDIA_VIEWER,
  CONF_MENU,
  CONF_MENU_BUTTONS_CAMERAS,
  CONF_MENU_BUTTONS_CLIPS,
  CONF_MENU_BUTTONS_DOWNLOAD,
  CONF_MENU_BUTTONS_FRIGATE,
  CONF_MENU_BUTTONS_FRIGATE_UI,
  CONF_MENU_BUTTONS_FULLSCREEN,
  CONF_MENU_BUTTONS_IMAGE,
  CONF_MENU_BUTTONS_LIVE,
  CONF_MENU_BUTTONS_SNAPSHOTS,
  CONF_MENU_BUTTON_SIZE,
  CONF_MENU_POSITION,
  CONF_MENU_STYLE,
  CONF_OVERRIDES,
  CONF_VIEW_DEFAULT,
  CONF_VIEW_TIMEOUT_SECONDS,
  CONF_VIEW_UPDATE_ENTITIES,
} from './const';
import {
  BUTTON_SIZE_MIN,
  RawFrigateCardConfig,
  RawFrigateCardConfigArray,
  THUMBNAIL_WIDTH_MAX,
  THUMBNAIL_WIDTH_MIN,
} from './types';

/**
 * Set a configuration value.
 * @param obj The configuration.
 * @param keys The key to the property to set.
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
 * @param keys The key to the property to retrieve.
 * @param def Default if key not found.
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
  return upgradeConfig(copyConfig(obj));
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
export const copyConfig = <T>(obj: T): T => {
  return cloneDeep(obj);
};

/**
 * Determines if a property is not an object.
 * @param value The value.
 * @returns `true` is the value is not an object.
 */
const isNotObject = function (value: unknown): unknown | undefined {
  return typeof value !== 'object' ? value : undefined;
};

/**
 * Converts to a number or return undefined.
 * @param value The value.
 * @returns A number or undefined.
 */
const toNumberOrIgnore = function (value: unknown): number | undefined {
  return isNaN(value as number) ? undefined : Number(value);
};

/**
 * Create a transform that will cap a numeric value.
 * @param value The value.
 * @returns A number or null.
 */
const createRangedTransform = function (
  transform: (value: unknown) => unknown,
  min?: number,
  max?: number,
): (valueIn: unknown) => unknown {
  return (value: unknown): unknown => {
    let transformed = transform(value);
    if (typeof transformed !== 'number') {
      return transformed;
    }
    transformed = min ? Math.max(min, transformed as number) : transformed;
    transformed = max ? Math.min(max, transformed as number) : transformed;
    return transformed;
  };
};

/**
 * Convert a value from 'XXpx' to XX (as a number).
 * @param value Incoming value.
 * @returns A number, null if the property should be deleted or undefined if it
 * should be ignored.
 */
const toPixelsOrDelete = function (value: unknown): number | null | undefined {
  // Ignore the value if it's a number.
  if (typeof value === 'number') {
    return undefined;
  }
  // Delete the value if it's not a string.
  if (typeof value !== 'string') {
    return null;
  }
  // Remove 'px' and return the number, unless it's an invalid number -- then
  // delete it.
  value = value.replace(/px$/i, '');
  return isNaN(value as number) ? null : Number(value);
};

/**
 * Request a property be deleted.
 * @param _value Inbound value (not required).
 * @returns `null` to request the property be deleted.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const deleteProperty = function (_value: unknown): number | null | undefined {
  return null;
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
  options?: {
    transform?: (valueIn: unknown) => unknown;
    keepOriginal?: boolean;
  },
): boolean => {
  const inValue = getConfigValue(obj, oldPath);
  if (inValue === undefined) {
    return false;
  }
  const outValue = options?.transform ? options.transform(inValue) : inValue;
  if (oldPath === newPath && isEqual(inValue, outValue)) {
    return false;
  }
  if (outValue === null) {
    if (!options?.keepOriginal) {
      deleteConfigValue(obj, oldPath);
      return true;
    }
    return false;
  }
  if (outValue !== undefined) {
    if (!options?.keepOriginal) {
      deleteConfigValue(obj, oldPath);
    }
    setConfigValue(obj, newPath, outValue);
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
  options?: {
    transform?: (valueIn: unknown) => unknown;
    keepOriginal?: boolean;
  },
): (obj: RawFrigateCardConfig) => boolean {
  return function (obj: RawFrigateCardConfig): boolean {
    return moveConfigValue(obj, oldPath, newPath, options);
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
  options?: {
    transform?: (valueIn: unknown) => unknown;
    keepOriginal?: boolean;
  },
): (obj: RawFrigateCardConfig) => boolean {
  return function (obj: RawFrigateCardConfig): boolean {
    let modified = upgradeMoveTo(oldPath, newPath, options)(obj);
    modified =
      upgradeArrayValue(
        CONF_OVERRIDES,
        upgradeMoveTo(oldPath, newPath, options),
        (obj) => obj.overrides as RawFrigateCardConfig | undefined,
      )(obj) || modified;
    return modified;
  };
};

/**
 * Upgrade a property in place with overrides.
 * @param path The old property path.
 * @param transform An optional transform for the value.
 * @returns A function that returns `true` if the configuration was modified.
 */
const upgradeWithOverrides = function (
  path: string,
  transform: (valueIn: unknown) => unknown,
): (obj: RawFrigateCardConfig) => boolean {
  return upgradeMoveToWithOverrides(path, path, { transform: transform });
};

/**
 * Upgrade a property in place without overrides.
 * @param path The old property path.
 * @param transform An optional transform for the value.
 * @returns A function that returns `true` if the configuration was modified.
 */
const upgrade = function (
  path: string,
  transform: (valueIn: unknown) => unknown,
): (obj: RawFrigateCardConfig) => boolean {
  return upgradeMoveTo(path, path, { transform: transform });
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
 * @returns An upgrade function.
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
      'frigate.camera_name': 'cameras.#.camera_name',
      'frigate.client_id': 'cameras.#.client_id',
      'frigate.label': 'cameras.#.label',
      'frigate.url': 'cameras.#.frigate_url',
      'frigate.zone': 'cameras.#.zone',
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
 * Upgrade from a menu-mode to a style & position.
 * @returns An upgrade function.
 */
const upgradeMenuModeToStyleAndPosition = (): ((
  obj: RawFrigateCardConfig,
) => boolean) => {
  return function (obj: RawFrigateCardConfig): boolean {
    let modified = false;

    // Change the 'start' of the mode into a style.
    modified =
      upgradeMoveToWithOverrides('menu.mode', CONF_MENU_STYLE, {
        transform: (mode: unknown): string | undefined => {
          if (typeof mode === 'string') {
            const result = mode.match(/^(hover|hidden|overlay|above|below|none)/);
            if (result) {
              switch (result[1]) {
                case 'hover':
                case 'hidden':
                case 'overlay':
                case 'none':
                  return result[1];
                case 'above':
                case 'below':
                  return 'outside';
              }
            }
          }
          return undefined;
        },
        keepOriginal: true,
      })(obj) || modified;

    // Change the 'end' of the mode into a position.
    modified =
      upgradeMoveToWithOverrides('menu.mode', CONF_MENU_POSITION, {
        transform: (mode: unknown): string | undefined => {
          if (typeof mode === 'string') {
            const result = mode.match(/(above|below|left|right|top|bottom)$/);
            if (result) {
              switch (result[1]) {
                case 'left':
                case 'right':
                case 'top':
                case 'bottom':
                  return result[1];
                case 'above':
                  return 'top';
                case 'below':
                  return 'bottom';
              }
            }
          }
          return undefined;
        },
        keepOriginal: true,
      })(obj) || modified;

    // Delete the old `menu.mode` .
    return upgradeWithOverrides('menu.mode', deleteProperty)(obj) || modified;
  };
};

/**
 * Upgrade from a condition on the menu (to allow rendering) to a menu mode
 * override instead.
 * @param key A string key.
 * @returns A safe key.
 */
const upgradeMenuConditionToMenuOverride = (): ((
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

/**
 * Transform a menu button from a boolean to a priority.
 * @param value The boolean true/false for show/hide the switch.
 * @returns A priority value.
 */
const menuButtonBooleanToObject = function (
  value: unknown,
): { enabled: boolean } | null | undefined {
  if (typeof value === 'object') {
    return undefined;
  }
  // If it's not a boolean remove it.
  if (typeof value !== 'boolean') {
    return null;
  }
  return { enabled: value };
};

/**
 * Upgrade from a show_controls key to individual favorite/timeline keys.
 * @returns An upgrade function.
 */
const upgradeThumbnailShowControlsToIndividualControls = (
  thumbnailsBasePath: string,
): ((obj: RawFrigateCardConfig) => boolean) => {
  const thumbnailsShowControlsPath = `${thumbnailsBasePath}.show_controls`;

  return function (obj: RawFrigateCardConfig): boolean {
    let modified = false;
    modified =
      upgradeMoveToWithOverrides(
        thumbnailsShowControlsPath,
        `${thumbnailsBasePath}.show_favorite_control`,
        { keepOriginal: true },
      )(obj) || modified;

    modified =
      upgradeMoveToWithOverrides(
        thumbnailsShowControlsPath,
        `${thumbnailsBasePath}.show_timeline_control`,
        { keepOriginal: true },
      )(obj) || modified;

    // Delete the old `show_controls`.
    return (
      upgradeWithOverrides(thumbnailsShowControlsPath, deleteProperty)(obj) || modified
    );
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
  upgradeMoveTo('controls.nextprev', 'event_viewer.controls.next_previous.style'),
  upgradeMoveTo('controls.nextprev_size', 'event_viewer.controls.next_previous.size'),
  upgradeMoveTo('menu_mode', 'menu.mode'),
  upgradeMoveTo('menu_buttons', 'menu.buttons'),
  upgradeMoveTo('menu_button_size', CONF_MENU_BUTTON_SIZE),
  upgradeMoveTo('image', 'image.src', { transform: isNotObject }),

  // v2.0.0 -> v2.1.0
  upgradeMoveTo('update_entities', CONF_VIEW_UPDATE_ENTITIES),

  // v2.1.0 -> v3.0.0-rc.1
  upgradeToMultipleCameras(),
  upgradeMenuConditionToMenuOverride(),
  upgradeMoveTo('view.timeout', CONF_VIEW_TIMEOUT_SECONDS, {
    transform: toNumberOrIgnore,
  }),
  upgradeMoveTo('event_viewer.autoplay_clip', 'event_viewer.auto_play'),

  // v3.0.0-rc.1 -> v3.0.0-rc.2
  upgradeArrayValue(
    CONF_CAMERAS,
    upgradeWithOverrides('live_provider', (val) =>
      val === 'frigate' ? 'ha' : val === 'webrtc' ? 'webrtc-card' : val,
    ),
  ),
  upgradeArrayValue(CONF_CAMERAS, upgradeMoveTo('webrtc', 'webrtc_card')),
  upgradeMoveToWithOverrides('live.webrtc', CONF_LIVE_WEBRTC_CARD),
  upgradeMoveToWithOverrides('image.src', CONF_IMAGE_URL),

  // v3.0.0 -> v4.0.0-rc.1
  upgradeWithOverrides(
    CONF_LIVE_CONTROLS_THUMBNAILS_SIZE,
    createRangedTransform(toPixelsOrDelete, THUMBNAIL_WIDTH_MIN, THUMBNAIL_WIDTH_MAX),
  ),
  upgradeWithOverrides(
    'event_viewer.controls.thumbnails.size',
    createRangedTransform(toPixelsOrDelete, THUMBNAIL_WIDTH_MIN, THUMBNAIL_WIDTH_MAX),
  ),
  upgradeWithOverrides(
    CONF_LIVE_CONTROLS_NEXT_PREVIOUS_SIZE,
    createRangedTransform(toPixelsOrDelete, BUTTON_SIZE_MIN),
  ),
  upgradeWithOverrides(
    'event_viewer.controls.next_previous.size',
    createRangedTransform(toPixelsOrDelete, BUTTON_SIZE_MIN),
  ),
  upgradeWithOverrides(
    CONF_MENU_BUTTON_SIZE,
    createRangedTransform(toPixelsOrDelete, BUTTON_SIZE_MIN),
  ),
  upgradeWithOverrides('event_gallery.min_columns', deleteProperty),
  upgradeMenuModeToStyleAndPosition(),
  upgradeWithOverrides(CONF_MENU_BUTTONS_FRIGATE, menuButtonBooleanToObject),
  upgradeWithOverrides(CONF_MENU_BUTTONS_CAMERAS, menuButtonBooleanToObject),
  upgradeWithOverrides(CONF_MENU_BUTTONS_LIVE, menuButtonBooleanToObject),
  upgradeWithOverrides(CONF_MENU_BUTTONS_CLIPS, menuButtonBooleanToObject),
  upgradeWithOverrides(CONF_MENU_BUTTONS_SNAPSHOTS, menuButtonBooleanToObject),
  upgradeWithOverrides(CONF_MENU_BUTTONS_IMAGE, menuButtonBooleanToObject),
  upgradeWithOverrides(CONF_MENU_BUTTONS_DOWNLOAD, menuButtonBooleanToObject),
  upgradeWithOverrides(CONF_MENU_BUTTONS_FRIGATE_UI, menuButtonBooleanToObject),
  upgradeWithOverrides(CONF_MENU_BUTTONS_FULLSCREEN, menuButtonBooleanToObject),
  upgrade(CONF_LIVE_LAZY_UNLOAD, (val) =>
    typeof val === 'boolean' ? (val ? 'all' : 'never') : undefined,
  ),
  upgrade(CONF_LIVE_AUTO_UNMUTE, (val) =>
    typeof val === 'boolean' ? (val ? 'all' : 'never') : undefined,
  ),
  upgrade('event_viewer.auto_play', (val) =>
    typeof val === 'boolean' ? (val ? 'all' : 'never') : undefined,
  ),
  upgrade('event_viewer.auto_unmute', (val) =>
    typeof val === 'boolean' ? (val ? 'all' : 'never') : undefined,
  ),
  upgradeMoveToWithOverrides('event_viewer', CONF_MEDIA_VIEWER),
  upgradeArrayValue(CONF_CAMERAS, upgradeMoveTo('camera_name', 'frigate.camera_name')),
  upgradeArrayValue(CONF_CAMERAS, upgradeMoveTo('client_id', 'frigate.client_id')),
  upgradeArrayValue(CONF_CAMERAS, upgradeMoveTo('label', 'frigate.label')),
  upgradeArrayValue(CONF_CAMERAS, upgradeMoveTo('frigate_url', 'frigate.url')),
  upgradeArrayValue(CONF_CAMERAS, upgradeMoveTo('zone', 'frigate.zone')),

  // v4.0.0-rc.1 -> v4.0.0-rc.3
  upgradeThumbnailShowControlsToIndividualControls('event_gallery.controls.thumbnails'),
  upgradeThumbnailShowControlsToIndividualControls('media_viewer.controls.thumbnails'),
  upgradeThumbnailShowControlsToIndividualControls('live.controls.thumbnails'),
  upgradeThumbnailShowControlsToIndividualControls('timeline.controls.thumbnails'),
];
