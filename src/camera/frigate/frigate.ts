import { HomeAssistant } from 'custom-card-helpers';
import utcToZonedTime from 'date-fns-tz/utcToZonedTime';
import fromUnixTime from 'date-fns/fromUnixTime';
import { z } from 'zod';
import { localize } from '../../localize/localize';
import {
  ClipsOrSnapshots,
  FrigateCardError,
  FrigateEvent,
  FrigateEvents,
  frigateEventsSchema,
  FrigateRecording,
} from '../../types';
import { formatDateAndTime, prettifyTitle } from '../../utils/basic';
import { homeAssistantWSRequest } from '../../utils/ha';

export const FRIGATE_ICON_SVG_PATH =
  'm 4.8759466,22.743573 c 0.0866,0.69274 0.811811,1.16359 0.37885,1.27183 ' +
  '-0.43297,0.10824 -2.32718,-3.43665 -2.7601492,-4.95202 -0.4329602,-1.51538 ' +
  '-0.6764993,-3.22017 -0.5682593,-4.19434 0.1082301,-0.97417 5.7097085,-2.48955 ' +
  '5.7097085,-2.89545 0,-0.4059 -1.81304,-0.0271 -1.89422,-0.35178 -0.0812,-0.32472 ' +
  '1.36925,-0.12989 1.75892,-0.64945 0.60885,-0.81181 1.3800713,-0.6765 1.8671505,' +
  '-1.1094696 0.4870902,-0.4329599 1.0824089,-2.0836399 1.1906589,-2.7871996 0.108241,' +
  '-0.70357 -1.0824084,-1.51538 -1.4071389,-2.05658 -0.3247195,-0.54121 0.7035702,' +
  '-0.92005 3.1931099,-1.94834 2.48954,-1.02829 10.39114,-3.30134994 10.49938,' +
  '-3.03074994 0.10824,0.27061 -2.59779,1.40713994 -4.492,2.11069994 -1.89422,0.70357 ' +
  '-4.97909,2.05658 -4.97909,2.43542 0,0.37885 0.16236,0.67651 0.0541,1.54244 -0.10824,' +
  '0.86593 -0.12123,1.2702597 -0.32472,1.8400997 -0.1353,0.37884 -0.2706,1.27183 ' +
  '0,2.0836295 0.21648,0.64945 0.92005,1.13653 1.24477,1.24478 0.2706,0.018 1.01746,' +
  '0.0433 1.8401,0 1.02829,-0.0541 2.48954,0.0541 2.48954,0.32472 0,0.2706 -2.21894,' +
  '0.10824 -2.21894,0.48708 0,0.37885 2.27306,-0.0541 2.21894,0.32473 -0.0541,0.37884 ' +
  '-1.89422,0.21648 -2.86839,0.21648 -0.77933,0 -1.93031,-0.0361 -2.43542,-0.21648 ' +
  'l -0.10824,0.37884 c -0.18038,0 -0.55744,0.10824 -0.94711,0.10824 -0.48708,0 ' +
  '-0.51414,0.16236 -1.40713,0.16236 -0.892989,0 -0.622391,-0.0541 -1.4341894,-0.10824 ' +
  '-0.81181,-0.0541 -3.842561,2.27306 -4.383761,3.03075 -0.54121,0.75768 ' +
  '-0.21649,2.59778 -0.21649,3.43665 0,0.75379 -0.10824,2.43542 0,3.30135 z';

const recordingSummaryHourSchema = z.object({
  hour: z.preprocess((arg) => Number(arg), z.number().min(0).max(23)),
  duration: z.number().min(0),
  events: z.number().min(0),
});

const recordingSummarySchema = z
  .object({
    day: z.preprocess((arg) => {
      // Must provide the hour:minute:second on parsing or Javascript will
      // assume *UTC* midnight.
      return typeof arg === 'string' ? new Date(`${arg}T00:00:00`) : arg;
    }, z.date()),
    events: z.number(),
    hours: recordingSummaryHourSchema.array(),
  })
  .array();
export type RecordingSummary = z.infer<typeof recordingSummarySchema>;

const recordingSegmentSchema = z.object({
  start_time: z.number(),
  end_time: z.number(),
  id: z.string(),
});
export type RecordingSegment = z.infer<typeof recordingSegmentSchema>;

const recordingSegmentsSchema = recordingSegmentSchema.array();
export type RecordingSegments = z.infer<typeof recordingSegmentsSchema>;

const retainResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type RetainResult = z.infer<typeof retainResultSchema>;

/**
 * Get the recordings summary. May throw.
 * @param hass The Home Assistant object.
 * @param client_id The Frigate client_id.
 * @param camera_name The Frigate camera name.
 * @returns A RecordingSummary object.
 */
export const getRecordingsSummary = async (
  hass: HomeAssistant,
  client_id: string,
  camera_name: string,
): Promise<RecordingSummary> => {
  return await homeAssistantWSRequest(
    hass,
    recordingSummarySchema,
    {
      type: 'frigate/recordings/summary',
      instance_id: client_id,
      camera: camera_name,
    },
    true,
  );
};

export interface NativeFrigateRecordingSegmentsQuery {
  instance_id: string;
  camera: string;
  after: number;
  before: number;
}

/**
 * Get the recording segments. May throw.
 * @param hass The Home Assistant object.
 * @param params The recording segment query parameters.
 * @returns A RecordingSegments object.
 */
export const getRecordingSegments = async (
  hass: HomeAssistant,
  params: NativeFrigateRecordingSegmentsQuery,
): Promise<RecordingSegments> => {
  return await homeAssistantWSRequest(
    hass,
    recordingSegmentsSchema,
    {
      type: 'frigate/recordings/get',
      ...params,
    },
    true,
  );
};

/**
 * Request that Frigate retain an event. May throw.
 * @param hass The HomeAssistant object.
 * @param client_id The Frigate client_id.
 * @param eventID The event ID to retain.
 * @param retain `true` to retain or `false` to unretain.
 */
export async function retainEvent(
  hass: HomeAssistant,
  client_id: string,
  eventID: string,
  retain: boolean,
): Promise<void> {
  const retainRequest = {
    type: 'frigate/event/retain',
    instance_id: client_id,
    event_id: eventID,
    retain: retain,
  };
  const response = await homeAssistantWSRequest<RetainResult>(
    hass,
    retainResultSchema,
    retainRequest,
    true,
  );
  if (!response.success) {
    throw new FrigateCardError(localize('error.failed_retain'), {
      request: retainRequest,
      response: response,
    });
  }
}

export interface NativeFrigateEventQuery {
  instance_id?: string;
  camera?: string;
  label?: string;
  zone?: string;
  after?: number;
  before?: number;
  limit?: number;
  has_clip?: boolean;
  has_snapshot?: boolean;
}

/**
 * Get events over websocket. May throw.
 * @param hass The Home Assistant object.
 * @param params The events search parameters.
 * @returns An array of 'FrigateEvent's.
 */
export const getEvents = async (
  hass: HomeAssistant,
  params?: NativeFrigateEventQuery,
): Promise<FrigateEvents> => {
  return await homeAssistantWSRequest(
    hass,
    frigateEventsSchema,
    {
      type: 'frigate/events/get',
      ...params,
    },
    true,
  );
};

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
