import { CameraManager } from '../camera-manager/manager';
import { localize } from '../localize/localize';
import { ExtendedHomeAssistant, FrigateCardError } from '../types';
import { ViewMedia } from '../view/media';
import { errorToConsole } from './basic';
import { homeAssistantSignPath } from './ha';

export const downloadURL = (url: string, filename = 'download'): void => {
  // The download attribute only works on the same origin.
  // See: https://developer.mozilla.org/en-US/docs/Web/HTML/Element/a#attributes
  const isSameOrigin = new URL(url).origin === window.location.origin;
  const dataURL = url.startsWith('data:');

  if (!isSameOrigin && !dataURL) {
    window.open(url, '_blank');
    return;
  }

  // Use the HTML5 download attribute to prevent a new window from
  // temporarily opening.
  const link = document.createElement('a');
  link.setAttribute('download', filename);
  link.href = url;
  link.click();
  link.remove();
};

export const downloadMedia = async (
  hass: ExtendedHomeAssistant,
  cameraManager: CameraManager,
  media: ViewMedia,
): Promise<void> => {
  const download = await cameraManager.getMediaDownloadPath(media);
  if (!download) {
    throw new FrigateCardError(localize('error.download_no_media'));
  }

  let finalURL = download.endpoint;
  if (download.sign) {
    let response: string | null | undefined;
    try {
      response = await homeAssistantSignPath(hass, download.endpoint);
    } catch (e) {
      errorToConsole(e as Error);
    }

    if (!response) {
      throw new FrigateCardError(localize('error.download_sign_failed'));
    }
    finalURL = response;
  }

  downloadURL(finalURL);
};
