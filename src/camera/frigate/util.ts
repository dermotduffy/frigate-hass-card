import utcToZonedTime from 'date-fns-tz/utcToZonedTime';
import fromUnixTime from 'date-fns/fromUnixTime';
import { ClipsOrSnapshots } from '../../types';
import { formatDateAndTime, prettifyTitle } from '../../utils/basic';
import { FrigateEvent, FrigateRecording } from './types';

/**
 * Given an event generate a title.
 * @param event
 */
export const getEventTitle = (event: FrigateEvent): string => {
  const localTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const durationSeconds = Math.round(
    event.end_time
      ? event.end_time - event.start_time
      : Date.now() / 1000 - event.start_time,
  );
  return `${formatDateAndTime(
    utcToZonedTime(event.start_time * 1000, localTimezone),
  )} [${durationSeconds}s, ${prettifyTitle(event.label)} ${Math.round(
    event.top_score * 100,
  )}%]`;
};

export const getRecordingTitle = (recording: FrigateRecording): string => {
  return `${prettifyTitle(recording.camera)} ${formatDateAndTime(
    fromUnixTime(recording.start_time),
  )}`;
};

/**
 * Get a thumbnail URL for an event.
 * @param clientId The Frigate client id.
 * @param event The event.
 * @returns A string URL.
 */
export const getEventThumbnailURL = (clientId: string, event: FrigateEvent): string => {
  return `/api/frigate/${clientId}/thumbnail/${event.id}`;
};

/**
 * Get a media content ID for an event.
 * @param clientId The Frigate client id.
 * @param cameraName The Frigate camera name.
 * @param event The Frigate event.
 * @param mediaType The media type required.
 * @returns A string media content id.
 */
export const getEventMediaContentID = (
  clientId: string,
  cameraName: string,
  event: FrigateEvent,
  mediaType: ClipsOrSnapshots,
): string => {
  return `media-source://frigate/${clientId}/event/${mediaType}/${cameraName}/${event.id}`;
};

/**
 * Generate a recording identifier.
 * @param clientId The Frigate client id.
 * @param cameraName The Frigate camera name.
 * @param recording The Frigate recording.
 * @returns A recording identifier.
 */
export const getRecordingMediaContentID = (
  clientId: string,
  cameraName: string,
  recording: FrigateRecording,
): string => {
  const date = fromUnixTime(recording.start_time);
  return [
    'media-source://frigate',
    clientId,
    'recordings',
    cameraName,
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
      String(date.getDate()).padStart(2, '0'),
    )}`,
    String(date.getHours()).padStart(2, '0'),
  ].join('/');
};
