// TODO: Change defaults themselves?
// TODO: CSS
// TODO: Don't pump out conditionStates based on state?

import { deepRemoveDefaults } from './utils/zod.js';
import {
  frigateCardConfigSchema,
  FrigateCardConfig,
  RawFrigateCardConfig,
} from './types';
import { getArrayConfigPath, getConfigValue, setConfigValue } from './config-mgmt.js';
import {
  CONF_CAMERAS_ARRAY_TRIGGERS_OCCUPANCY,
  CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SHOW_DETAILS,
  CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
  CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
  CONF_LIVE_AUTO_MUTE,
  CONF_LIVE_CONTROLS_THUMBNAILS_MODE,
  CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_DETAILS,
  CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
  CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
  CONF_LIVE_CONTROLS_TIMELINE_SHOW_RECORDINGS,
  CONF_LIVE_CONTROLS_TITLE_MODE,
  CONF_LIVE_DRAGGABLE,
  CONF_LIVE_LAZY_UNLOAD,
  CONF_LIVE_SHOW_IMAGE_DURING_LOAD,
  CONF_LIVE_TRANSITION_EFFECT,
  CONF_MEDIA_VIEWER_AUTO_MUTE,
  CONF_MEDIA_VIEWER_AUTO_PAUSE,
  CONF_MEDIA_VIEWER_AUTO_PLAY,
  CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE,
  CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_MODE,
  CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_DETAILS,
  CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
  CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
  CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_SHOW_RECORDINGS,
  CONF_MEDIA_VIEWER_CONTROLS_TITLE_MODE,
  CONF_MEDIA_VIEWER_DRAGGABLE,
  CONF_MEDIA_VIEWER_TRANSITION_EFFECT,
  CONF_MENU_BUTTONS_FRIGATE,
  CONF_MENU_BUTTONS_MEDIA_PLAYER,
  CONF_MENU_BUTTONS_TIMELINE,
  CONF_MENU_STYLE,
  CONF_PERFORMANCE_FEATURES_ANIMATED_PROGRESS_INDICATOR,
  CONF_TIMELINE_CONTROLS_THUMBNAILS_MODE,
  CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_DETAILS,
  CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
  CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
  CONF_TIMELINE_SHOW_RECORDINGS,
} from './const.js';

// Caution: These values are applied after parsing (since we cannot know the
// performance profile until afterwards), so there is no validation on these
// defaults.
const LOW_PROFILE_DEFAULTS = {
  // Disable thumbnail carousels.
  [CONF_LIVE_CONTROLS_THUMBNAILS_MODE]: 'none' as const,
  [CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_MODE]: 'none' as const,
  [CONF_TIMELINE_CONTROLS_THUMBNAILS_MODE]: 'none' as const,

  // Do not show recordings on timelines.
  [CONF_LIVE_CONTROLS_TIMELINE_SHOW_RECORDINGS]: false,
  [CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_SHOW_RECORDINGS]: false,
  [CONF_TIMELINE_SHOW_RECORDINGS]: false,

  // Take no automatic media actions.
  [CONF_LIVE_AUTO_MUTE]: 'never' as const,
  [CONF_MEDIA_VIEWER_AUTO_PLAY]: 'never' as const,
  [CONF_MEDIA_VIEWER_AUTO_PAUSE]: 'never' as const,
  [CONF_MEDIA_VIEWER_AUTO_MUTE]: 'never' as const,

  // Always unload resources that are lazily loaded.
  [CONF_LIVE_LAZY_UNLOAD]: 'all' as const,

  // Media carousels do not drag.
  [CONF_LIVE_DRAGGABLE]: false,
  [CONF_MEDIA_VIEWER_DRAGGABLE]: false,

  // Media carousels have no effects.
  [CONF_LIVE_TRANSITION_EFFECT]: 'none' as const,
  [CONF_MEDIA_VIEWER_TRANSITION_EFFECT]: 'none' as const,

  // Do not show image during load.
  [CONF_LIVE_SHOW_IMAGE_DURING_LOAD]: false,

  // Media player next/previous are chevrons.
  [CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE]: 'chevrons' as const,

  [CONF_MEDIA_VIEWER_CONTROLS_TITLE_MODE]: 'none' as const,
  [CONF_LIVE_CONTROLS_TITLE_MODE]: 'none' as const,

  // Move the menu to outside to remove the need to interact with it with open.
  [CONF_MENU_STYLE]: 'outside',

  // Hide several buttons that are otherwise visible by default.
  [`${CONF_MENU_BUTTONS_FRIGATE}.enabled`]: false,
  [`${CONF_MENU_BUTTONS_TIMELINE}.enabled`]: false,
  [`${CONF_MENU_BUTTONS_MEDIA_PLAYER}.enabled`]: false,
  [`${CONF_MENU_BUTTONS_TIMELINE}.enabled`]: false,

  // Disable all options in thumbnails.
  [CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL]: false,
  [CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL]: false,
  [CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SHOW_DETAILS]: false,
  [CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL]: false,
  [CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL]: false,
  [CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_DETAILS]: false,
  [CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL]: false,
  [CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL]: false,
  [CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_DETAILS]: false,
  [CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL]: false,
  [CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL]: false,
  [CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_DETAILS]: false,

  // Disable all optional performance related features.
  [CONF_PERFORMANCE_FEATURES_ANIMATED_PROGRESS_INDICATOR]: false,
};

const LOW_PROFILE_CAMERA_DEFAULTS = {
  [CONF_CAMERAS_ARRAY_TRIGGERS_OCCUPANCY]: false,
};

/**
 * Set low performance profile mode. Sets flags as defined in
 * LOW_PROFILE_DEFAULTS unless they are explicitly overriden in the
 * configuration.
 * @param inputConfig The raw unparsed input configuration.
 * @param parsedConfig The parsed input configuration.
 * @returns A changed (in-place) parsed input configuration.
 */
export const setLowPerformanceProfile = (
  inputConfig: RawFrigateCardConfig,
  parsedConfig: FrigateCardConfig,
): FrigateCardConfig => {
  const setIfNotSpecified = (
    defaultLessConfig: RawFrigateCardConfig,
    parsedConfig: FrigateCardConfig,
    key: string,
    value: unknown,
  ) => {
    if (getConfigValue(defaultLessConfig, key) === undefined) {
      setConfigValue(parsedConfig, key, value);
    }
  };

  const defaultLessParseResult = deepRemoveDefaults(frigateCardConfigSchema).safeParse(
    inputConfig,
  );
  if (defaultLessParseResult.success) {
    const defaultLessConfig = defaultLessParseResult.data;
    Object.entries(LOW_PROFILE_DEFAULTS).forEach(([k, v]: [string, unknown]) =>
      setIfNotSpecified(defaultLessConfig, parsedConfig, k, v),
    );

    Object.entries(LOW_PROFILE_CAMERA_DEFAULTS).forEach(
      ([rawKey, v]: [string, unknown]) => {
        defaultLessConfig.cameras.forEach((_, index: number) => {
          const indexedKey = getArrayConfigPath(rawKey, index);
          setIfNotSpecified(defaultLessConfig, parsedConfig, indexedKey, v);
        });
      },
    );
  }
  return parsedConfig;
};
