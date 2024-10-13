import frigateSVG from '../camera-manager/frigate/assets/frigate.svg';
import motioneyeSVG from '../camera-manager/motioneye/assets/motioneye.svg';

export const getCustomIconURL = (icon?: string): string | null => {
  switch (icon) {
    case 'frigate':
      return frigateSVG;
    case 'motioneye':
      return motioneyeSVG;
    default:
      return null;
  }
};
