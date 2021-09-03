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

export const FRIGATE_MENU_MODES = [
  'hidden-top',
  'hidden-left',
  'hidden-bottom',
  'hidden-right',
  'overlay-top',
  'overlay-left',
  'overlay-bottom',
  'overlay-right',
  'above',
  'below',
] as const;
export type FrigateMenuMode = typeof FRIGATE_MENU_MODES[number];


export const frigateCardConfigSchema = z.object({
  camera_entity: z.string(),
  motion_entity: z.string().optional(),
  // No URL validation to allow relative URLs within HA (e.g. addons).
  frigate_url: z.string().optional(),
  frigate_client_id: z.string().optional().default("frigate"),
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
    .optional().default(180),
  live_provider: z.enum(['frigate', 'webrtc']).default('frigate'),
  webrtc: z.object({}).passthrough().optional(),
  label: z.string().optional(),
  zone: z.string().optional(),
  autoplay_clip: z.boolean().default(false),
  menu_mode: z.enum(FRIGATE_MENU_MODES).optional().default('hidden-top'),

  // Stock lovelace card config.
  type: z.string(),
  show_warning: z.boolean().optional(),
  show_error: z.boolean().optional(),
  test_gui: z.boolean().optional(),
});
export type FrigateCardConfig = z.infer<typeof frigateCardConfigSchema>;

export interface MediaBeingShown {
  browseMedia: BrowseMediaSource;
  resolvedMedia: ResolvedMedia;
}

export interface MenuButton {
  icon?: string;
  description: string;
  emphasize?: boolean;
}

/**
 * Media Browser API types.
 */

// Recursive type, cannot use type interference:
// See: https://github.com/colinhacks/zod#recursive-types
//
// Server side data-type defined here: https://github.com/home-assistant/core/blob/dev/homeassistant/components/media_player/__init__.py
export interface BrowseMediaSource {
  title: string;
  media_class: string;
  media_content_type: string;
  media_content_id: string;
  can_play: boolean;
  can_expand: boolean;
  children_media_class: string | null;
  thumbnail: string | null
  children?: BrowseMediaSource[] | null;
}

export const browseMediaSourceSchema: z.ZodSchema<BrowseMediaSource> = z.lazy(() =>
  z.object({
    title: z.string(),
    media_class: z.string(),
    media_content_type: z.string(),
    media_content_id: z.string(),
    can_play: z.boolean(),
    can_expand: z.boolean(),
    children_media_class: z.string().nullable(),
    thumbnail: z.string().nullable(),
    children: z.array(browseMediaSourceSchema).nullable().optional(),
  })
);

// Server side data-type defined here: https://github.com/home-assistant/core/blob/dev/homeassistant/components/media_source/models.py
export const resolvedMediaSchema = z.object({
  url: z.string(),
  mime_type: z.string(),
});
export type ResolvedMedia = z.infer<typeof resolvedMediaSchema>;

export interface BrowseMediaNeighbors {
  previous: BrowseMediaSource | null;
  previousIndex: number | null;

  next: BrowseMediaSource | null;
  nextIndex: number | null;
}