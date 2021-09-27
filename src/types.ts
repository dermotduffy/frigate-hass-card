import { LovelaceCard, LovelaceCardEditor } from 'custom-card-helpers';
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
  'none',
  'hidden-top',
  'hidden-left',
  'hidden-bottom',
  'hidden-right',
  'overlay-top',
  'overlay-left',
  'overlay-bottom',
  'overlay-right',
  'hover-top',
  'hover-left',
  'hover-bottom',
  'hover-right',
  'above',
  'below',
] as const;
export type FrigateMenuMode = typeof FRIGATE_MENU_MODES[number];

export const NEXT_PREVIOUS_CONTROL_STYLES = ['none', 'thumbnails', 'chevrons'] as const;
export type NextPreviousControlStyle = typeof NEXT_PREVIOUS_CONTROL_STYLES[number];

export const LIVE_PROVIDERS = ['frigate', 'frigate-jsmpeg', 'webrtc'] as const;
export type LiveProvider = typeof LIVE_PROVIDERS[number];

export const frigateCardConfigSchema = z.object({
  camera_entity: z.string(),
  // No URL validation to allow relative URLs within HA (e.g. addons).
  frigate_url: z.string().optional(),
  frigate_client_id: z.string().optional().default('frigate'),
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
    .optional()
    .default(180),
  live_provider: z.enum(LIVE_PROVIDERS).default('frigate'),
  webrtc: z
    .object({
      entity: z.string().optional(),
      url: z.string().optional(),
    })
    .passthrough()
    .optional(),
  label: z.string().optional(),
  zone: z.string().optional(),
  autoplay_clip: z.boolean().default(false),
  menu_mode: z.enum(FRIGATE_MENU_MODES).optional().default('hidden-top'),
  menu_buttons: z
    .object({
      frigate: z.boolean().default(true),
      live: z.boolean().default(true),
      clips: z.boolean().default(true),
      snapshots: z.boolean().default(true),
      frigate_ui: z.boolean().default(true),
      fullscreen: z.boolean().default(true),
    })
    .optional(),
  entities: z
    .object({
      entity: z.string(),
      show: z.boolean().default(true),
      icon: z.string().optional(),
    })
    .array()
    .optional(),
  controls: z
    .object({
      nextprev: z.enum(NEXT_PREVIOUS_CONTROL_STYLES).default('thumbnails'),
    })
    .optional(),
  dimensions: z
    .object({
      aspect_ratio_mode: z
        .enum(['dynamic', 'static', 'unconstrained'])
        .default('dynamic'),
      aspect_ratio: z
        .number()
        .array()
        .length(2)
        .or(
          z
            .string()
            .regex(/^\s*\d+\s*[:\/]\s*\d+\s*$/)
            .transform((input) => input.split(/[:\/]/).map((d) => Number(d))),
        )
        .default([16, 9]),
    })
    .optional(),

  // Stock lovelace card config.
  type: z.string(),
  show_warning: z.boolean().optional(),
  show_error: z.boolean().optional(),
  test_gui: z.boolean().optional(),
});
export type FrigateCardConfig = z.infer<typeof frigateCardConfigSchema>;

export interface MenuButton {
  icon?: string;
  description: string;
  emphasize?: boolean;
}

export interface ExtendedHomeAssistant {
  hassUrl(path?): string;
}

export interface BrowseMediaQueryParameters {
  mediaType: 'clips' | 'snapshots';
  clientId: string;
  cameraName: string;
  label?: string;
  zone?: string;
  before?: number;
  after?: number;
}

export interface BrowseMediaNeighbors {
  previous: BrowseMediaSource | null;
  previousIndex: number | null;

  next: BrowseMediaSource | null;
  nextIndex: number | null;
}

export interface MediaLoadInfo {
  width: number;
  height: number;
}

/**
 * Home Assistant API types.
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
  thumbnail: string | null;
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
  }),
);

// Server side data-type defined here: https://github.com/home-assistant/core/blob/dev/homeassistant/components/media_source/models.py
export const resolvedMediaSchema = z.object({
  url: z.string(),
  mime_type: z.string(),
});
export type ResolvedMedia = z.infer<typeof resolvedMediaSchema>;

export const signedPathSchema = z.object({
  path: z.string(),
});
export type SignedPath = z.infer<typeof signedPathSchema>;

export const entitySchema = z.object({
  entity_id: z.string(),
  unique_id: z.string(),
  platform: z.string(),
});
export type Entity = z.infer<typeof entitySchema>;
