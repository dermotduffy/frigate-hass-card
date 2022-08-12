import { MediaLayoutConfig } from '../types';

/**
 * Update element style from a media configuration.
 * @param element The element to update the style for.
 * @param mediaLayoutConfig The media config object.
 */
export const updateElementStyleFromMediaLayoutConfig = (
  element: HTMLElement,
  mediaLayoutConfig?: MediaLayoutConfig,
) => {
  if (mediaLayoutConfig?.fit !== undefined) {
    element.style.setProperty('--frigate-card-media-layout-fit', mediaLayoutConfig.fit);
  } else {
    element.style.removeProperty('--frigate-card-media-layout-fit');
  }
  for (const dimension of ['x', 'y']) {
    if (mediaLayoutConfig?.position?.[dimension] !== undefined) {
      element.style.setProperty(
        `--frigate-card-media-layout-position-${dimension}`,
        `${mediaLayoutConfig.position[dimension]}%`,
      );
    } else {
      element.style.removeProperty(`--frigate-card-media-layout-position-${dimension}`);
    }
  }
};
