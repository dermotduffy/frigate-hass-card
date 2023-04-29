import startOfHour from 'date-fns/startOfHour';
import endOfHour from 'date-fns/endOfHour';
import startOfDay from 'date-fns/startOfDay';
import endOfDay from 'date-fns/endOfDay';
import endOfMinute from 'date-fns/endOfMinute';
import { DateRange } from './range';
import orderBy from 'lodash-es/orderBy';
import uniqBy from 'lodash-es/uniqBy';
import { ViewMedia } from '../view/media';
import { CameraConfig } from '../types';

export const convertRangeToCacheFriendlyTimes = (
  range: DateRange,
  options?: {
    endCap?: boolean;
  },
): DateRange => {
  const widthSeconds = (range.end.getTime() - range.start.getTime()) / 1000;
  let cacheableStart: Date;
  let cacheableEnd: Date;

  if (widthSeconds <= 60 * 60) {
    cacheableStart = startOfHour(range.start);
    cacheableEnd = endOfHour(range.end);
  } else {
    cacheableStart = startOfDay(range.start);
    cacheableEnd = endOfDay(range.end);
  }

  if (options?.endCap) {
    cacheableEnd = endOfMinute(capEndDate(cacheableEnd));
  }

  return {
    start: cacheableStart,
    end: cacheableEnd,
  };
};

export const capEndDate = (end: Date): Date => {
  const now = new Date();
  return end > now ? now : end;
};

export const sortMedia = (mediaArray: ViewMedia[]): ViewMedia[] => {
  return orderBy(
    // Ensure uniqueness by the ID (if specified), otherwise all elements
    // are assumed to be unique.
    uniqBy(mediaArray, (media) => media.getID() ?? media),

    // Sort all items leading oldest -> youngest (so media is loaded in this
    // order in the viewer which matches the left-to-right timeline order).
    (media) => media.getStartTime(),
    'asc',
  );
};

export const getCameraEntityFromConfig = (cameraConfig: CameraConfig): string | null => {
  return cameraConfig.camera_entity ?? cameraConfig.webrtc_card?.entity ?? null;
};
