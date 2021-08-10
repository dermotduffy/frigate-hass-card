import { ActionConfig, LovelaceCard, LovelaceCardConfig, LovelaceCardEditor } from 'custom-card-helpers';
import { z } from "zod";
declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-editor': LovelaceCardEditor;
    'hui-error-card': LovelaceCard;
  }
}

/**
 * Internal types.
 */
export interface FrigateCardConfig extends LovelaceCardConfig {
  type: string;
  name?: string;

  camera_entity: string;
  motion_entity: string | null;
  frigate_url: string;
  frigate_camera_name?: string | null;
  default_view: string | null;
  timeout_ms?: number | null;

  show_warning?: boolean;
  show_error?: boolean;
  test_gui?: boolean;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

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
})
export type FrigateEvent = z.infer<typeof frigateEventSchema>;

export const frigateGetEventsResponseSchema = z.array(frigateEventSchema);
export type FrigateGetEventsResponse = z.infer<typeof frigateGetEventsResponseSchema>;