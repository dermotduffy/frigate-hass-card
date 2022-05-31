import { z } from 'zod';
import { ExtendedHomeAssistant } from '../types';
import { homeAssistantHTTPRequest } from './ha';

const recordingSummaryHourSchema = z.object({
  hour: z.preprocess((arg) => Number(arg), z.number().min(0).max(23)),
  duration: z.number().min(0),
  events: z.number().min(0),
});

const recordingSummarySchema = z
  .object({
    day: z.preprocess((arg) => {
      // Must provide the hour:minute:second on parsing or Javascript will
      // assume UTC midnight.
      return typeof arg === 'string' ? new Date(`${arg} 00:00:00`) : arg;
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
const recordingSegmentsSchema = recordingSegmentSchema.array();
export type RecordingSegments = z.infer<typeof recordingSegmentsSchema>;

/**
 * Get the recordings summary.
 * @param hass The Home Assistant object.
 * @param client_id The Frigate client_id.
 * @param camera_name The Frigate camera name.
 * @returns A RecordingSummary object.
 */
export const getRecordingsSummary = async (
  hass: ExtendedHomeAssistant,
  client_id: string,
  camera_name: string,
): Promise<RecordingSummary> => {
  return await homeAssistantHTTPRequest(
    hass,
    recordingSummarySchema,
    `/api/frigate/${client_id}/${camera_name}/recordings/summary`,
  );
};

/**
 * Get the recording segments..
 * @param hass The Home Assistant object.
 * @param client_id The Frigate client_id.
 * @param camera_name The Frigate camera name.
 * @param before The segment low watermark.
 * @param after The segment high watermark.
 * @returns A RecordingSegments object.
 */
export const getRecordingSegments = async (
  hass: ExtendedHomeAssistant,
  client_id: string,
  camera_name: string,
  before: Date,
  after: Date,
): Promise<RecordingSegments> => {
  return await homeAssistantHTTPRequest(
    hass,
    recordingSegmentsSchema,
    `/api/frigate/${client_id}/${camera_name}/recordings`,
    new URLSearchParams({
      before: String(before.getTime() / 1000),
      after: String(after.getTime() / 1000),
    }),
  );
};
