import { z } from 'zod';

export const eventSchema = z.object({
  camera: z.string(),
  end_time: z.number().nullable(),
  false_positive: z.boolean().nullable(),
  has_clip: z.boolean(),
  has_snapshot: z.boolean(),
  id: z.string(),
  label: z.string(),
  start_time: z.number(),
  top_score: z.number(),
  zones: z.string().array(),
  retain_indefinitely: z.boolean().optional(),
});
export const frigateEventsSchema = eventSchema.array();

export type FrigateEvent = z.infer<typeof eventSchema>;

const recordingSummaryHourSchema = z.object({
  hour: z.preprocess((arg) => Number(arg), z.number().min(0).max(23)),
  duration: z.number().min(0),
  events: z.number().min(0),
});

export const recordingSummarySchema = z
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
export const recordingSegmentsSchema = recordingSegmentSchema.array();

export const retainResultSchema = z.object({
  success: z.boolean(),
  message: z.string(),
});
export type RetainResult = z.infer<typeof retainResultSchema>;

export interface FrigateRecording {
  cameraID: string;
  startTime: Date;
  endTime: Date;
  events: number;
}