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

  if (
    navigator.userAgent.startsWith('Home Assistant/') ||
    navigator.userAgent.startsWith('HomeAssistant/') ||
    (!isSameOrigin && !dataURL)
  ) {
    // Home Assistant companion apps cannot download files without opening a
    // new browser window.
    //
    // User-agents are specified here:
    //  - Android: https://github.com/home-assistant/android/blob/b285c9525dd4837a82db931c1b2321c0511494e6/common/src/main/java/io/homeassistant/companion/android/common/data/HomeAssistantApis.kt#L23
    //  - iOS: https://github.com/home-assistant/iOS/blob/master/Sources/Shared/API/HAAPI.swift#L75
    window.open(url, '_blank');
  } else {
    // Use the HTML5 download attribute to prevent a new window from
    // temporarily opening.
    const link = document.createElement('a');
    link.setAttribute('download', filename);
    link.href = url;
    link.click();
    link.remove();
  }
};

export const downloadMedia = async (
  hass: ExtendedHomeAssistant,
  cameraManager: CameraManager,
  media: ViewMedia,
): Promise<void> => {
  const download = await cameraManager.getMediaDownloadPath(hass, media);
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
