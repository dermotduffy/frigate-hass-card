import frigateSVG from '../camera-manager/frigate/assets/frigate.svg';
import motioneyeSVG from '../camera-manager/motioneye/assets/motioneye.svg';
import reolinkSVG from '../camera-manager/reolink/assets/reolink.svg';

export const getCustomIconURL = (icon?: string): string | null => {
  switch (icon) {
    case 'frigate':
      return frigateSVG;
    case 'motioneye':
      return motioneyeSVG;
    case 'reolink':
      return reolinkSVG;
    default:
      return null;
  }
};
