import {
  LovelaceCard,
  LovelaceCardEditor,
} from 'custom-card-helpers';
import { z } from 'zod';

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-editor': LovelaceCardEditor;
    'hui-error-card': LovelaceCard;
  }
}

/**
 * Internal types.
 */

export const FRIGATE_CARD_VIEWS = [
  'live',
  'clip',
  'clips',
  'snapshot',
  'snapshots',
] as const;
export type FrigateCardView = typeof FRIGATE_CARD_VIEWS[number];

export const frigateCardConfigSchema = z.object({
  camera_entity: z.string(),
  motion_entity: z.string().optional(),
  frigate_url: z.string().url(),
  frigate_camera_name: z.string().optional(),
  view_default: z.enum(FRIGATE_CARD_VIEWS).optional().default('live'),

  view_timeout: z
    .number()
    .or(
      z
        .string()
        .regex(/^\d+$/)
        .transform((val) => Number(val)),
    )
    .optional(),
  live_provider: z.enum(['frigate', 'webrtc']).default('frigate'),
  webrtc: z.object({}).passthrough().optional(),
  label: z.string().optional(),
  zone: z.string().optional(),

  // Stock lovelace card config.
  type: z.string(),
  show_warning: z.boolean().optional(),
  show_error: z.boolean().optional(),
  test_gui: z.boolean().optional(),
});
export type FrigateCardConfig = z.infer<typeof frigateCardConfigSchema>;

export interface GetEventsParameters {
  has_clip?: boolean;
  has_snapshot?: boolean;
  limit?: number;
}

export interface ControlVideosParameters {
  stop: boolean;
  control_live?: boolean;
  control_clip?: boolean;
}

/**
 * Frigate API types.
 */

export const frigateEventSchema = z.object({
  camera: z.string(),
  end_time: z.number(),
  false_positive: z.boolean(),
  has_clip: z.boolean(),
  has_snapshot: z.boolean(),
  id: z.string(),
  label: z.string(),
  start_time: z.number(),
  thumbnail: z.string(),
  top_score: z.number(),
  zones: z.string().array(),
});
export type FrigateEvent = z.infer<typeof frigateEventSchema>;

export const frigateGetEventsResponseSchema = z.array(frigateEventSchema);
export type FrigateGetEventsResponse = z.infer<typeof frigateGetEventsResponseSchema>;
