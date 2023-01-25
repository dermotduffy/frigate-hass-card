import { HomeAssistant } from 'custom-card-helpers';
import { localize } from '../../localize/localize';
import {
  FrigateCardError,
  RecordingSegment,
} from '../../types';
import { homeAssistantWSRequest } from '../../utils/ha';
import { FrigateEvent, frigateEventsSchema, recordingSegmentsSchema, RecordingSummary, recordingSummarySchema, RetainResult, retainResultSchema } from './types';

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
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
): Promise<RecordingSegment[]> => {
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
  cameras?: string[];
  labels?: string[];
  zones?: string[];
  after?: number;
  before?: number;
  limit?: number;
  has_clip?: boolean;
  has_snapshot?: boolean;
  favorites?: boolean;
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
): Promise<FrigateEvent[]> => {
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
