import {
  FrigateCardMediaPlayer,
  MediaLoadedCapabilities,
  MediaLoadedInfo,
} from '../types.js';
import { dispatchFrigateCardEvent } from './basic.js';

const MEDIA_INFO_HEIGHT_CUTOFF = 50;
const MEDIA_INFO_WIDTH_CUTOFF = MEDIA_INFO_HEIGHT_CUTOFF;

/**
 * Create a MediaLoadedInfo object.
 * @param source An event or HTMLElement that should be used as a source.
 * @returns A new MediaLoadedInfo object or null if one could not be created.
 */
export function createMediaLoadedInfo(
  source: Event | HTMLElement,
  options?: {
    player?: FrigateCardMediaPlayer;
    capabilities?: MediaLoadedCapabilities;
  },
): MediaLoadedInfo | null {
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
      ...options,
    };
  } else if (target instanceof HTMLVideoElement) {
    return {
      width: (target as HTMLVideoElement).videoWidth,
      height: (target as HTMLVideoElement).videoHeight,
      ...options,
    };
  } else if (target instanceof HTMLCanvasElement) {
    return {
      width: (target as HTMLCanvasElement).width,
      height: (target as HTMLCanvasElement).height,
      player: options?.player,
      ...options,
    };
  }
  return null;
}

/**
 * Dispatch a Frigate card media loaded event.
 * @param element The element to send the event.
 * @param source An event or HTMLElement that should be used as a source.
 */
export function dispatchMediaLoadedEvent(
  target: HTMLElement,
  source: Event | HTMLElement,
  options?: {
    player?: FrigateCardMediaPlayer;
    capabilities?: MediaLoadedCapabilities;
  },
): void {
  const mediaLoadedInfo = createMediaLoadedInfo(source, options);
  if (mediaLoadedInfo) {
    dispatchExistingMediaLoadedInfoAsEvent(target, mediaLoadedInfo);
  }
}

/**
 * Dispatch a pre-existing MediaLoadedInfo object as an event.
 * @param element The element to send the event.
 * @param MediaLoadedInfo The MediaLoadedInfo object to send.
 */
export function dispatchExistingMediaLoadedInfoAsEvent(
  target: EventTarget,
  MediaLoadedInfo: MediaLoadedInfo,
): void {
  dispatchFrigateCardEvent<MediaLoadedInfo>(target, 'media:loaded', MediaLoadedInfo);
}

/**
 * Dispatch a media unloaded event.
 * @param element The element to send the event.
 */
export function dispatchMediaUnloadedEvent(element: HTMLElement): void {
  dispatchFrigateCardEvent(element, 'media:unloaded');
}

export function dispatchMediaVolumeChangeEvent(target: HTMLElement): void {
  dispatchFrigateCardEvent(target, 'media:volumechange');
}

export function dispatchMediaPlayEvent(target: HTMLElement): void {
  dispatchFrigateCardEvent(target, 'media:play');
}

export function dispatchMediaPauseEvent(target: HTMLElement): void {
  dispatchFrigateCardEvent(target, 'media:pause');
}

/**
 * Determine if a MediaLoadedInfo object is valid/acceptable.
 * @param info The MediaLoadedInfo object.
 * @returns True if the object is valid, false otherwise.
 */
export function isValidMediaLoadedInfo(info: MediaLoadedInfo): boolean {
  return (
    info.height >= MEDIA_INFO_HEIGHT_CUTOFF && info.width >= MEDIA_INFO_WIDTH_CUTOFF
  );
}
