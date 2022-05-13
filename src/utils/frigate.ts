import {
    differenceInHours, differenceInMinutes, differenceInSeconds, fromUnixTime
} from 'date-fns';
import { localize } from '../localize/localize.js';
import { FrigateEvent } from '../types.js';

/**
 * Convenience function to convert a timestamp to hours, minutes and seconds
 * string. Heavily inspired by, and returning the same format as, the Frigate
 * UI: https://github.com/blakeblackshear/frigate/blob/master/web/src/components/RecordingPlaylist.jsx#L97
 * @param event The Frigate event.
 * @returns A duration string.
 */
export function getEventDurationString(event: FrigateEvent): string {
  if (!event.end_time) {
    return localize('event.in_progress');
  }
  const start = fromUnixTime(event.start_time);
  const end = fromUnixTime(event.end_time);
  const hours = differenceInHours(end, start);
  const minutes = differenceInMinutes(end, start) - hours * 60;
  const seconds = differenceInSeconds(end, start) - hours * 60 * 60 - minutes * 60;
  let duration = '';

  if (hours) {
    duration += `${hours}h `;
  }
  if (minutes) {
    duration += `${minutes}m `;
  }
  duration += `${seconds}s`;
  return duration;
}
