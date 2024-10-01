import {
  CONF_CAMERAS_GLOBAL_IMAGE_REFRESH_SECONDS,
  CONF_DIMENSIONS_ASPECT_RATIO,
  CONF_DIMENSIONS_ASPECT_RATIO_MODE,
  CONF_LIVE_AUTO_UNMUTE,
  CONF_LIVE_CONTROLS_BUILTIN,
  CONF_LIVE_SHOW_IMAGE_DURING_LOAD,
  CONF_MEDIA_VIEWER_CONTROLS_BUILTIN,
  CONF_MENU_BUTTONS_FULLSCREEN,
  CONF_MENU_BUTTONS_MEDIA_PLAYER,
  CONF_MENU_BUTTONS_MUTE,
  CONF_MENU_BUTTONS_PLAY,
  CONF_MENU_STYLE,
} from '../../const.js';

export const CASTING_PROFILE = {
  [CONF_LIVE_CONTROLS_BUILTIN]: false,
  [CONF_MEDIA_VIEWER_CONTROLS_BUILTIN]: false,

  // TVs are generally not touch-enabled, so we don't want to show the menu
  [CONF_MENU_STYLE]: 'none',

  // But in case the user enables the menu, let's make sure to enable the
  // buttons that make sense and disable the ones that don't
  [`${CONF_MENU_BUTTONS_PLAY}.enabled`]: true,
  [`${CONF_MENU_BUTTONS_MUTE}.enabled`]: true,
  [`${CONF_MENU_BUTTONS_FULLSCREEN}.enabled`]: false,
  [`${CONF_MENU_BUTTONS_MEDIA_PLAYER}.enabled`]: false,

  [CONF_LIVE_AUTO_UNMUTE]: ['selected', 'visible'],

  [CONF_DIMENSIONS_ASPECT_RATIO_MODE]: 'static',
  [CONF_DIMENSIONS_ASPECT_RATIO]: '16:9',

  // These values are defaults anyway unless another profile (e.g.
  // low-performance) is also selected, but at pretty important to a good
  // experience so are reset here.
  [CONF_CAMERAS_GLOBAL_IMAGE_REFRESH_SECONDS]: 1,
  [CONF_LIVE_SHOW_IMAGE_DURING_LOAD]: true,
};
