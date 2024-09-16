import cloneDeep from 'lodash-es/cloneDeep';
import get from 'lodash-es/get';
import isEqual from 'lodash-es/isEqual';
import set from 'lodash-es/set';
import unset from 'lodash-es/unset';
import {
  CONF_AUTOMATIONS,
  CONF_CAMERAS,
  CONF_CAMERAS_GLOBAL_DIMENSIONS_LAYOUT,
  CONF_CAMERAS_GLOBAL_IMAGE,
  CONF_CAMERAS_GLOBAL_JSMPEG,
  CONF_CAMERAS_GLOBAL_PTZ,
  CONF_CAMERAS_GLOBAL_WEBRTC_CARD,
  CONF_DIMENSIONS_HEIGHT,
  CONF_ELEMENTS,
  CONF_LIVE_CONTROLS_THUMBNAILS_EVENTS_MEDIA_TYPE,
  CONF_LIVE_CONTROLS_TIMELINE_EVENTS_MEDIA_TYPE,
  CONF_MEDIA_GALLERY,
  CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_EVENTS_MEDIA_TYPE,
  CONF_MENU_BUTTONS_CAMERA_UI,
  CONF_OVERRIDES,
  CONF_PROFILES,
  CONF_STATUS_BAR,
  CONF_TIMELINE_EVENTS_MEDIA_TYPE,
  CONF_VIEW_DEFAULT_CYCLE_CAMERA,
  CONF_VIEW_DEFAULT_RESET_ENTITIES,
  CONF_VIEW_DEFAULT_RESET_EVERY_SECONDS,
  CONF_VIEW_DEFAULT_RESET_INTERACTION_MODE,
  CONF_VIEW_INTERACTION_SECONDS,
  CONF_VIEW_TRIGGERS,
  CONF_VIEW_TRIGGERS_ACTIONS_TRIGGER,
  CONF_VIEW_TRIGGERS_ACTIONS_UNTRIGGER,
  CONF_VIEW_TRIGGERS_FILTER_SELECTED_CAMERA,
} from '../const';
import { arrayify } from '../utils/basic';
import {
  FrigateCardCondition,
  RawFrigateCardConfig,
  RawFrigateCardConfigArray,
} from './types';

// *************************************************************************
//                  General Config Management Functions
// *************************************************************************

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
export const deleteConfigValue = (obj: RawFrigateCardConfig, path: string): void => {
  unset(obj, path);
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
 * Given an array path, return a true path.
 * @param path The array path (should have a '#').
 * @param index The numeric array index to use.
 * @returns The true config path.
 */
export const getArrayConfigPath = (path: string, index: number): string => {
  return path.replace('#', `[${index.toString()}]`);
};

// *************************************************************************
//                  Upgrade Related Functions
// *************************************************************************

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
 * Upgrade by moving a property from one location to another.
 * @param oldPath The old property path.
 * @param newPath The new property path.
 * @param transform An optional transform for the value.
 * @returns `true` if the configuration was modified.
 */
export const upgradeMoveTo = function (
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
export const upgradeMoveToWithOverrides = function (
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
      upgradeArrayOfObjects(
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
export const upgradeWithOverrides = function (
  path: string,
  transform: (valueIn: unknown) => unknown,
): (obj: RawFrigateCardConfig) => boolean {
  return upgradeMoveToWithOverrides(path, path, { transform: transform });
};

/**
 * Delete a property in place with overrides.
 * @param path The property path.
 * @returns A function that returns `true` if the configuration was modified.
 */
export const deleteWithOverrides = function (
  path: string,
): (obj: RawFrigateCardConfig) => boolean {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return upgradeMoveToWithOverrides(path, path, { transform: (_) => null });
};

/**
 * Given a path to an array, apply an upgrade to each object in the array.
 * @param arrayPath The path to the array to upgrade.
 * @param upgrade A function that applies an upgrade to an object.
 * @param getObject A optional function that takes an item in the array and
 * returns the object to modify within it.
 * @returns A function that returns `true` if the configuration was modified.
 */
export const upgradeArrayOfObjects = function (
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
 * Recursively upgrade an object.
 * @param transform A transform applied to each object recursively.
 * @param getObject A function to get the object to be upgraded.
 * @returns An upgrade function.
 */
export const upgradeObjectRecursively = (
  transform: (data: RawFrigateCardConfig) => boolean,
  getObject?: (data: RawFrigateCardConfig) => RawFrigateCardConfig | undefined | null,
): ((data: RawFrigateCardConfig) => boolean) => {
  const recurse = (data: RawFrigateCardConfig): boolean => {
    let result = false;
    if (data && typeof data === 'object') {
      const object = getObject ? getObject(data) : data;
      if (object) {
        result = transform(object) || result;
      }
      if (Array.isArray(data)) {
        data.forEach((item: RawFrigateCardConfig) => {
          result = recurse(item) || result;
        });
      } else {
        Object.keys(data).forEach((key) => {
          result = recurse(data[key] as RawFrigateCardConfig) || result;
        });
      }
    }
    return result;
  };
  return recurse;
};

// *************************************************************************
//              Upgrade Related Functions: Generic Transforms
// *************************************************************************

/**
 * Create a transform that will cap a numeric value.
 * @param value The value.
 * @returns A number or null.
 */
export const createRangedTransform = function (
  transform: (value: unknown) => unknown,
  min?: number,
  max?: number,
): (valueIn: unknown) => unknown {
  return (value: unknown): unknown => {
    let transformed = transform(value);
    if (typeof transformed !== 'number') {
      return transformed;
    }
    transformed = min !== undefined ? Math.max(min, transformed as number) : transformed;
    transformed = max !== undefined ? Math.min(max, transformed as number) : transformed;
    return transformed;
  };
};

/**
 * Request a property be deleted.
 * @param _value Inbound value (not required).
 * @returns `null` to request the property be deleted.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const deleteTransform = function (_value: unknown): number | null | undefined {
  return null;
};

// *************************************************************************
//        Upgrade Related Functions: Specific Transforms / Upgraders
// *************************************************************************

/**
 * Transform mediaLoaded -> media_loaded
 * @param data Input data.
 * @returns `true` if the configuration was modified.
 */
const conditionMediaLoadedTransform = (data: unknown): boolean => {
  if (typeof data === 'object' && data && data['mediaLoaded'] !== undefined) {
    data['media_loaded'] = data['mediaLoaded'];
    delete data['mediaLoaded'];
    return true;
  }
  return false;
};

/**
 * Transform a single object with multiple conditions to multiple objects with
 * single conditions
 * @param data Input data.
 * @returns `true` if the configuration was modified.
 */
const conditionToConditionsTransform = (data: unknown): boolean => {
  if (
    typeof data !== 'object' ||
    !data ||
    typeof data['conditions'] !== 'object' ||
    !data['conditions']
  ) {
    return false;
  }

  const oldConditions = data['conditions'];
  const newConditions: FrigateCardCondition[] = [];

  if (oldConditions['view'] !== undefined) {
    newConditions.push({
      condition: 'view' as const,
      views: oldConditions['view'],
    });
  }
  if (oldConditions['fullscreen'] !== undefined) {
    newConditions.push({
      condition: 'fullscreen' as const,
      fullscreen: oldConditions['fullscreen'],
    });
  }
  if (oldConditions['expand'] !== undefined) {
    newConditions.push({
      condition: 'expand' as const,
      expand: oldConditions['expand'],
    });
  }
  if (oldConditions['camera'] !== undefined) {
    newConditions.push({
      condition: 'camera' as const,
      cameras: oldConditions['camera'],
    });
  }
  if (oldConditions['media_loaded'] !== undefined) {
    newConditions.push({
      condition: 'media_loaded' as const,
      media_loaded: oldConditions['media_loaded'],
    });
  }
  if (oldConditions['state'] !== undefined && Array.isArray(oldConditions['state'])) {
    for (const stateCondition of oldConditions['state']) {
      if (
        typeof stateCondition === 'object' &&
        stateCondition &&
        (stateCondition['state'] !== undefined ||
          stateCondition['state_not'] !== undefined ||
          stateCondition['entity'] !== undefined)
      ) {
        newConditions.push({
          condition: 'state' as const,
          ...(stateCondition['state'] && {
            state: stateCondition['state'],
          }),
          ...(stateCondition['state_not'] && {
            state_not: stateCondition['state_not'],
          }),
          ...(stateCondition['entity'] && {
            entity: stateCondition['entity'],
          }),
        });
      }
    }
  }
  if (oldConditions['media_query'] !== undefined) {
    newConditions.push({
      condition: 'screen' as const,
      media_query: oldConditions['media_query'],
    });
  }

  // These conditions did not exist prior to v6.0.0 and so are not converted:
  // - display_mode
  // - triggered
  // - interaction
  // - microphone

  if (newConditions.length) {
    data['conditions'] = newConditions;
    return true;
  }
  return false;
};

const callServiceToPerformActionTransform = (data: unknown): boolean => {
  if (
    typeof data !== 'object' ||
    !data ||
    data['action'] !== 'call-service' ||
    typeof data['service'] !== 'string'
  ) {
    return false;
  }
  data['action'] = 'perform-action';
  data['perform_action'] = data['service'];
  delete data['service'];
  return true;
};

/**
 * Transform service_data -> data
 * See: https://github.com/dermotduffy/frigate-hass-card/issues/1103
 * @param data Input data.
 * @returns `true` if the configuration was modified.
 */
const serviceDataToDataTransform = (data: unknown): boolean => {
  if (
    typeof data === 'object' &&
    data &&
    data['action'] === 'call-service' &&
    data['service'] !== undefined &&
    data['service_data'] !== undefined &&
    data['data'] === undefined
  ) {
    data['data'] = data['service_data'];
    delete data['service_data'];
    return true;
  }
  return false;
};

/**
 * Transform action frigate_ui -> camera_ui
 * @param data Input data.
 * @returns `true` if the configuration was modified.
 */
const frigateUIActionTransform = (data: unknown): boolean => {
  if (
    typeof data === 'object' &&
    data &&
    data['action'] === 'custom:frigate-card-action' &&
    data['frigate_card_action'] === 'frigate_ui'
  ) {
    data['frigate_card_action'] = 'camera_ui';
    return true;
  }
  return false;
};

/**
 * Transform element PTZ to native live PTZ.
 * @param data Input data.
 * @returns `true` if the configuration was modified.
 */
const upgradePTZElementsToLive = function (): (data: unknown) => boolean {
  return function (data: unknown): boolean {
    if (
      typeof data !== 'object' ||
      !data ||
      !(CONF_ELEMENTS in data) ||
      !Array.isArray(data[CONF_ELEMENTS])
    ) {
      return false;
    }

    let foundPTZ = false;
    const movePTZ = (element: RawFrigateCardConfig): void => {
      if (!foundPTZ) {
        if (!get(data, 'live.controls.ptz')) {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { type: _, ...newPTZ } = element;
          set(data, 'live.controls.ptz', newPTZ);
        }
        foundPTZ = true;
      }
    };

    const processElements = (
      elements: RawFrigateCardConfigArray,
    ): RawFrigateCardConfigArray => {
      const newElements: RawFrigateCardConfigArray = [];
      for (const element of elements) {
        if (element['type'] === 'custom:frigate-card-ptz') {
          movePTZ(element);
        } else if (
          (element['type'] === 'conditional' ||
            element['type'] === 'custom:frigate-card-conditional') &&
          Array.isArray(element['elements'])
        ) {
          const newConditionalElements = processElements(element['elements']);
          if (newConditionalElements.length) {
            element['elements'] = newConditionalElements;
            newElements.push(element);
          }
        } else {
          newElements.push(element);
        }
      }
      return newElements;
    };

    const newElements = processElements(data[CONF_ELEMENTS]);

    if (foundPTZ) {
      if (newElements.length) {
        data[CONF_ELEMENTS] = newElements;
      } else {
        delete data[CONF_ELEMENTS];
      }
    }
    return foundPTZ;
  };
};

const ptzActionsToCamerasGlobalTransform = (data: unknown): unknown => {
  if (typeof data !== 'object' || !data) {
    return undefined;
  }

  const NON_PRESET_DATA_KEYS = [
    'data_left',
    'data_right',
    'data_up',
    'data_down',
    'data_zoom_in',
    'data_zoom_out',
    'service',
  ];

  const NON_PRESET_ACTION_KEYS = [
    // 'actions_' will overwrite 'data_*' if there's duplication.
    'actions_left',
    'actions_right',
    'actions_up',
    'actions_down',
    'actions_zoom_in',
    'actions_zoom_out',
  ];

  const PRESET_TRANSFORM_KEYS = ['data_home', 'actions_home'];
  const TRANSFORM_KEYS = [
    ...NON_PRESET_DATA_KEYS,
    ...NON_PRESET_ACTION_KEYS,
    ...PRESET_TRANSFORM_KEYS,
  ];

  const keys = Object.keys(data);
  const hasTransformable = keys.some((key) => TRANSFORM_KEYS.includes(key));
  if (!hasTransformable) {
    return undefined;
  }

  const output = {};

  NON_PRESET_DATA_KEYS.filter((key) => key in data).reduce((obj, key) => {
    obj[key] = data[key];
    return obj;
  }, output);

  NON_PRESET_ACTION_KEYS.filter((key) => key in data).reduce((obj, key) => {
    if (typeof data[key] === 'object' && 'tap_action' in data[key]) {
      obj[key] = data[key]['tap_action'];
    }
    return obj;
  }, output);

  const createPresets = () => {
    output['presets'] =
      'presets' in data && typeof data['presets'] === 'object' && !!data['presets']
        ? data['presets']
        : {};
  };

  if (
    'actions_home' in data &&
    typeof data['actions_home'] === 'object' &&
    data['actions_home'] &&
    'tap_action' in data['actions_home']
  ) {
    createPresets();
    output['presets']['home'] = data['actions_home']['tap_action'];
  } else if (
    'data_home' in data &&
    typeof data['data_home'] === 'object' &&
    data['data_home'] &&
    typeof data['service'] === 'string'
  ) {
    createPresets();
    output['presets']['service'] = data['service'];
    output['presets']['data_home'] = data['data_home'];
  }

  return output;
};

const ptzControlSettingsTransform = (data: unknown): unknown => {
  if (typeof data !== 'object' || !data) {
    return data;
  }

  const TRANSFORM_KEYS = [
    'mode',
    'position',
    'orientation',
    'hide_pan_tilt',
    'hide_zoom',
    'hide_home',
    'style',
  ];

  const keys = Object.keys(data);
  const hasSomethingToFilter = keys.some((key) => !TRANSFORM_KEYS.includes(key));
  if (!hasSomethingToFilter) {
    return undefined;
  }

  return keys
    .filter((key) => TRANSFORM_KEYS.includes(key))
    .reduce((obj, key) => {
      obj[key] = data[key];
      return obj;
    }, {});
};

const titleControlTransform = (data: unknown): unknown => {
  if (typeof data !== 'object' || !data || typeof data['mode'] !== 'string') {
    return null;
  }
  if (data['mode'] === 'none') {
    return {
      style: 'none',
    };
  }
  if (data['mode'].includes('bottom')) {
    return {
      position: 'bottom',
    };
  } else if (data['mode'].includes('top')) {
    return {
      position: 'top',
    };
  }
  return null;
};

const UPGRADES = [
  // v4.0.0 -> v4.1.0
  upgradeArrayOfObjects(
    CONF_OVERRIDES,
    conditionMediaLoadedTransform,
    (data) => data.conditions as RawFrigateCardConfig | undefined,
  ),
  (data: unknown): boolean => {
    return upgradeObjectRecursively(
      conditionMediaLoadedTransform,
      (data) => data.conditions as RawFrigateCardConfig | undefined,
    )(typeof data === 'object' && data ? data[CONF_ELEMENTS] : {});
  },
  upgradeMoveToWithOverrides('event_gallery', CONF_MEDIA_GALLERY),
  upgradeMoveToWithOverrides('menu.buttons.frigate_ui', CONF_MENU_BUTTONS_CAMERA_UI),
  (data: unknown): boolean => {
    return upgradeObjectRecursively(frigateUIActionTransform)(
      typeof data === 'object' && data ? <RawFrigateCardConfig>data : {},
    );
  },
  upgradeArrayOfObjects(
    CONF_CAMERAS,
    upgradeWithOverrides('live_provider', (val) =>
      val === 'frigate-jsmpeg' ? 'jsmpeg' : val,
    ),
  ),
  upgradeMoveToWithOverrides('live.jsmpeg', CONF_CAMERAS_GLOBAL_JSMPEG),
  upgradeMoveToWithOverrides('live.image', CONF_CAMERAS_GLOBAL_IMAGE),
  upgradeMoveToWithOverrides('live.webrtc_card', CONF_CAMERAS_GLOBAL_WEBRTC_CARD),
  upgradeArrayOfObjects(
    CONF_CAMERAS,
    upgradeMoveToWithOverrides('frigate.zone', 'frigate.zones', {
      transform: (zone) => arrayify(zone),
    }),
  ),
  upgradeArrayOfObjects(
    CONF_CAMERAS,
    upgradeMoveToWithOverrides('frigate.label', 'frigate.labels', {
      transform: (label) => arrayify(label),
    }),
  ),

  // v5.2.0 -> v6.0.0
  (data: unknown): boolean => {
    return upgradeObjectRecursively(serviceDataToDataTransform)(
      typeof data === 'object' && data ? <RawFrigateCardConfig>data : {},
    );
  },
  upgradePTZElementsToLive(),
  upgradeMoveToWithOverrides('view.timeout_seconds', CONF_VIEW_INTERACTION_SECONDS),
  upgradeWithOverrides('live.lazy_unload', (data) =>
    data === 'all' ? ['unselected', 'hidden'] : data === 'never' ? null : arrayify(data),
  ),
  upgradeWithOverrides('live.auto_play', (data) =>
    data === 'all' ? null : data === 'never' ? [] : arrayify(data),
  ),
  upgradeWithOverrides('live.auto_pause', (data) =>
    data === 'all' ? ['unselected', 'hidden'] : data === 'never' ? null : arrayify(data),
  ),
  upgradeWithOverrides('live.auto_mute', (data) =>
    data === 'all' ? null : data === 'never' ? [] : arrayify(data),
  ),
  upgradeWithOverrides('live.auto_unmute', (data) =>
    data === 'all'
      ? ['selected', 'visible', 'microphone']
      : data === 'never'
        ? null
        : arrayify(data),
  ),
  upgradeWithOverrides('media_viewer.auto_play', (data) =>
    data === 'all' ? null : data === 'never' ? [] : arrayify(data),
  ),
  upgradeWithOverrides('media_viewer.auto_pause', (data) =>
    data === 'all' ? null : data === 'never' ? [] : arrayify(data),
  ),
  upgradeWithOverrides('media_viewer.auto_mute', (data) =>
    data === 'all' ? null : data === 'never' ? [] : arrayify(data),
  ),
  upgradeWithOverrides('media_viewer.auto_unmute', (data) =>
    data === 'all' ? ['selected', 'visible'] : data === 'never' ? null : arrayify(data),
  ),
  upgradeMoveToWithOverrides(
    'live.controls.thumbnails.media',
    CONF_LIVE_CONTROLS_THUMBNAILS_EVENTS_MEDIA_TYPE,
  ),
  upgradeMoveToWithOverrides('timeline.media', CONF_TIMELINE_EVENTS_MEDIA_TYPE),
  upgradeMoveToWithOverrides(
    'live.controls.timeline.media',
    CONF_LIVE_CONTROLS_TIMELINE_EVENTS_MEDIA_TYPE,
  ),
  upgradeMoveToWithOverrides(
    'media_viewer.controls.timeline.media',
    CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_EVENTS_MEDIA_TYPE,
  ),
  upgradeMoveToWithOverrides('view.scan', CONF_VIEW_TRIGGERS),
  upgradeMoveToWithOverrides(
    'view.triggers.enabled',
    CONF_VIEW_TRIGGERS_ACTIONS_TRIGGER,
    {
      transform: (data) => (data === true ? 'live' : null),
      // Keep it around, for the following transform.
      keepOriginal: true,
    },
  ),
  upgradeMoveToWithOverrides(
    'view.triggers.enabled',
    CONF_VIEW_TRIGGERS_FILTER_SELECTED_CAMERA,
    {
      transform: (data) => (data === true ? false : null),
    },
  ),
  upgradeMoveToWithOverrides(
    'view.triggers.untrigger_reset',
    CONF_VIEW_TRIGGERS_ACTIONS_UNTRIGGER,
    {
      // Delete the value if it's set to the default.
      transform: (val) => (val ? 'default' : null),
    },
  ),
  upgradeMoveToWithOverrides('live.layout', CONF_CAMERAS_GLOBAL_DIMENSIONS_LAYOUT),
  deleteWithOverrides('media_viewer.layout'),
  deleteWithOverrides('image.layout'),
  upgradeArrayOfObjects(CONF_OVERRIDES, conditionToConditionsTransform),
  (data: unknown): boolean => {
    return upgradeObjectRecursively(conditionToConditionsTransform)(
      typeof data === 'object' && data ? data[CONF_ELEMENTS] : {},
    );
  },
  (data: unknown): boolean => {
    return upgradeObjectRecursively(conditionToConditionsTransform)(
      typeof data === 'object' && data ? data[CONF_AUTOMATIONS] : {},
    );
  },
  upgradeArrayOfObjects(
    CONF_CAMERAS,
    upgradeMoveToWithOverrides('hide', 'capabilities', {
      transform: (val) => (val === true ? { disable_except: ['substream'] } : null),
    }),
  ),
  upgradeMoveToWithOverrides('performance.profile', CONF_PROFILES, {
    // Delete the value if it's set to the default.
    transform: (val) => (val === 'low' ? ['low-performance'] : null),
  }),
  upgradeArrayOfObjects(CONF_OVERRIDES, upgradeMoveTo('overrides', 'merge')),
  upgradeMoveToWithOverrides('live.controls.ptz', CONF_CAMERAS_GLOBAL_PTZ, {
    transform: ptzActionsToCamerasGlobalTransform,
    keepOriginal: true,
  }),
  upgradeWithOverrides('live.controls.ptz', ptzControlSettingsTransform),
  upgradeMoveToWithOverrides('view.update_cycle_camera', CONF_VIEW_DEFAULT_CYCLE_CAMERA),
  upgradeMoveToWithOverrides(
    'view.update_force',
    CONF_VIEW_DEFAULT_RESET_INTERACTION_MODE,
    {
      transform: (val) => (val === true ? 'all' : null),
    },
  ),
  upgradeMoveToWithOverrides(
    'view.update_seconds',
    CONF_VIEW_DEFAULT_RESET_EVERY_SECONDS,
  ),
  upgradeMoveToWithOverrides('view.update_entities', CONF_VIEW_DEFAULT_RESET_ENTITIES),
  upgradeMoveTo('live.controls.title', CONF_STATUS_BAR, {
    transform: titleControlTransform,
  }),
  deleteWithOverrides('live.controls.title'),
  deleteWithOverrides('media_viewer.controls.title'),

  // Upgrade call-service calls throughout the card config. They could show up
  // attached to any element, any automation, or any card/view action (i.e. very
  // broadly across the config), so it's challenging to better target this
  // upgrade. As written, this will convert things that look like call-service
  // calls recurseively throughout the whole card config, but this could
  // conceivably be an overreach if (e.g.) some totally unrelated object has {
  // action: 'call-service', service: '<any string>' } that means something
  // different.
  (data: unknown): boolean => {
    return upgradeObjectRecursively(callServiceToPerformActionTransform)(
      typeof data === 'object' && data ? (data as RawFrigateCardConfig) : {},
    );
  },
  upgradeMoveToWithOverrides('dimensions.max_height', CONF_DIMENSIONS_HEIGHT),
  deleteWithOverrides('dimensions.min_height'),
];
