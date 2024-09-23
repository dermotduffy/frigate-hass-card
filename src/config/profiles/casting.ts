import {
  CONF_DIMENSIONS_ASPECT_RATIO,
  CONF_LIVE_AUTO_UNMUTE,
  CONF_MENU_STYLE,
} from '../../const.js';

export const CASTING_PROFILE = {
  [CONF_MENU_STYLE]: 'none' as const,
  [CONF_LIVE_AUTO_UNMUTE]: ['selected', 'visible'],
  [CONF_DIMENSIONS_ASPECT_RATIO]: '16:9',
};
