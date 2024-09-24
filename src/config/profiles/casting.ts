import {
  CONF_CAMERAS_GLOBAL_IMAGE_REFRESH_SECONDS,
  CONF_DIMENSIONS_ASPECT_RATIO,
  CONF_LIVE_AUTO_UNMUTE,
  CONF_LIVE_CONTROLS_BUILTIN,
  CONF_LIVE_SHOW_IMAGE_DURING_LOAD,
  CONF_MEDIA_VIEWER_CONTROLS_BUILTIN,
  CONF_MENU_STYLE,
} from '../../const.js';

export const CASTING_PROFILE = {
  [CONF_MENU_STYLE]: 'none' as const,
  [CONF_LIVE_AUTO_UNMUTE]: ['selected', 'visible'],
  [CONF_DIMENSIONS_ASPECT_RATIO]: '16:9',
  [CONF_LIVE_CONTROLS_BUILTIN]: false,
  [CONF_MEDIA_VIEWER_CONTROLS_BUILTIN]: false,

  // These values are defaults anyway unless another profile (e.g.
  // low-performance) is also selected, but at pretty important to a good
  // experience so are reset here.
  [CONF_CAMERAS_GLOBAL_IMAGE_REFRESH_SECONDS]: 1,
  [CONF_LIVE_SHOW_IMAGE_DURING_LOAD]: true,
};
