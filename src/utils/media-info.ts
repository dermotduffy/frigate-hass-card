import { MediaShowInfo } from '../types.js';
import { dispatchFrigateCardEvent } from './basic.js';

const MEDIA_INFO_HEIGHT_CUTOFF = 50;
const MEDIA_INFO_WIDTH_CUTOFF = MEDIA_INFO_HEIGHT_CUTOFF;

/**
 * Create a MediaShowInfo object.
 * @param source An event or HTMLElement that should be used as a source.
 * @returns A new MediaShowInfo object or null if one could not be created.
 */
export function createMediaShowInfo(source: Event | HTMLElement): MediaShowInfo | null {
  let target: HTMLElement | EventTarget;
  if (source instanceof Event) {
    target = source.composedPath()[0];
  } else {
    target = source;
  }

  if (target instanceof HTMLImageElement) {
    return {
      width: (target as HTMLImageElement).naturalWidth,
      height: (target as HTMLImageElement).naturalHeight,
    };
  } else if (target instanceof HTMLVideoElement) {
    return {
      width: (target as HTMLVideoElement).videoWidth,
      height: (target as HTMLVideoElement).videoHeight,
    };
  } else if (target instanceof HTMLCanvasElement) {
    return {
      width: (target as HTMLCanvasElement).width,
      height: (target as HTMLCanvasElement).height,
    };
  }
  return null;
}

/**
 * Dispatch a Frigate card media show event.
 * @param element The element to send the event.
 * @param source An event or HTMLElement that should be used as a source.
 */
export function dispatchMediaShowEvent(
  element: HTMLElement,
  source: Event | HTMLElement,
): void {
  const mediaShowInfo = createMediaShowInfo(source);
  if (mediaShowInfo) {
    dispatchExistingMediaShowInfoAsEvent(element, mediaShowInfo);
  }
}

/**
 * Dispatch a pre-existing MediaShowInfo object as an event.
 * @param element The element to send the event.
 * @param mediaShowInfo The MediaShowInfo object to send.
 */
export function dispatchExistingMediaShowInfoAsEvent(
  element: HTMLElement,
  mediaShowInfo: MediaShowInfo,
): void {
  dispatchFrigateCardEvent<MediaShowInfo>(element, 'media-show', mediaShowInfo);
}

/**
 * Determine if a MediaShowInfo object is valid/acceptable.
 * @param info The MediaShowInfo object.
 * @returns True if the object is valid, false otherwise.
 */
export function isValidMediaShowInfo(info: MediaShowInfo): boolean {
  return (
    info.height >= MEDIA_INFO_HEIGHT_CUTOFF && info.width >= MEDIA_INFO_WIDTH_CUTOFF
  );
}
