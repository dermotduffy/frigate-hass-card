import {
  CallServiceActionConfig,
  LovelaceCard,
  LovelaceCardEditor,
  MoreInfoActionConfig,
  NavigateActionConfig,
  ToggleActionConfig,
  UrlActionConfig,
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
  'image'
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

/**
 * Action Types (for "Picture Elements" / Menu)
 */

// Declare schemas to existing types:
// - https://github.com/colinhacks/zod/issues/372#issuecomment-826380330
const schemaForType =
  <T>() =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  <S extends z.ZodType<T, any, any>>(arg: S) => {
    return arg;
  };
const toggleActionSchema = schemaForType<ToggleActionConfig>()(
  z.object({
    action: z.literal('toggle'),
  }),
);
const callServiceActionSchema = schemaForType<CallServiceActionConfig>()(
  z.object({
    action: z.literal('call-service'),
    service: z.string(),
    service_data: z.object({}).passthrough().optional(),
  }),
);
const navigateActionSchema = schemaForType<NavigateActionConfig>()(
  z.object({
    action: z.literal('navigate'),
    navigation_path: z.string(),
  }),
);
const urlActionSchema = schemaForType<UrlActionConfig>()(
  z.object({
    action: z.literal('url'),
    url_path: z.string(),
  }),
);
const moreInfoActionSchema = schemaForType<MoreInfoActionConfig>()(
  z.object({
    action: z.literal('more-info'),
  }),
);
const elementsActionSchema = z.union([
  toggleActionSchema,
  callServiceActionSchema,
  navigateActionSchema,
  urlActionSchema,
  moreInfoActionSchema,
]);
export type ElementsActionType = z.infer<typeof elementsActionSchema>;

const elementsBaseSchema = z.object({
  style: z.object({}).passthrough().optional(),
  title: z.string().nullable().optional(),
  tap_action: elementsActionSchema.optional(),
  hold_action: elementsActionSchema.optional(),
  double_tap_action: elementsActionSchema.optional(),
});

/**
 * Picture Element Types
 * 
 * All picture element types are validated (not just the Frigate card custom
 * ones) as a convenience to present the user with a consistent error display
 * up-front regardless of where they made their error.
 */

// https://www.home-assistant.io/lovelace/picture-elements/#state-badge
const stateBadgeIconSchema = elementsBaseSchema.merge(
  z.object({
    type: z.literal('state-badge'),
    entity: z.string(),
  }));

// https://www.home-assistant.io/lovelace/picture-elements/#state-icon
const stateIconSchema = elementsBaseSchema.merge(
  z.object({
    type: z.literal('state-icon'),
    entity: z.string(),
    icon: z.string().optional(),
    state_color: z.boolean().default(true),
  }));

// https://www.home-assistant.io/lovelace/picture-elements/#state-label
const stateLabelSchema = elementsBaseSchema.merge(
  z.object({
    type: z.literal('state-label'),
    entity: z.string(),
    attribute: z.string().optional(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
  }));

// https://www.home-assistant.io/lovelace/picture-elements/#service-call-button
const serviceCallButtonSchema = 
  elementsBaseSchema.merge(z
    .object({
      type: z.literal('service-button'),
      // Title is required for service button.
      title: z.string(),  
      service: z.string(),
      service_data: z.object({}).passthrough().optional(),
    })
  )

// https://www.home-assistant.io/lovelace/picture-elements/#icon
const iconSchema = elementsBaseSchema.merge(
  z.object({
    type: z.literal('icon'),
    icon: z.string(),
    entity: z.string().optional(),
  }));

// https://www.home-assistant.io/lovelace/picture-elements/#image-element
const imageSchema = elementsBaseSchema.merge(
  z.object({
    type: z.literal('image'),
    entity: z.string().optional(),
    image: z.string().optional(),
    camera_image: z.string().optional(),
    camera_view: z.string().optional(),
    state_image: z.object({}).passthrough().optional(),
    filter: z.string().optional(),
    state_filter: z.object({}).passthrough().optional(),
    aspect_ratio: z.string().optional(),
}));

// https://www.home-assistant.io/lovelace/picture-elements/#image-element
const conditionalSchema = z.object({
    type: z.literal('conditional'),
    conditions: z.object({
      entity: z.string(),
      state: z.string().optional(),
      state_not: z.string().optional(),
    }).array(),
    elements: z.lazy(() => pictureElementsSchema),
  });

// https://www.home-assistant.io/lovelace/picture-elements/#custom-elements
const customSchema = z.object({
    // Insist that Frigate card custom elements are handled by other schemas.
    type: z.string().superRefine((val, ctx) => {
      if (!val.match(/^custom:(?!frigate-card).+/)) {
        ctx.addIssue({
          code: z.ZodIssueCode.invalid_type,
          expected: "string",
          received: "string",
        });
      }
    })
  }).passthrough();

/**
 * Custom Element Types
 */

export const menuIconSchema = iconSchema.merge(
  z.object({
    type: z.literal('custom:frigate-card-menu-icon'),
  }));
export type MenuIcon = z.infer<typeof menuIconSchema>;

export const menuStateIconSchema = stateIconSchema.merge(
  z.object({
    type: z.literal('custom:frigate-card-menu-state-icon'),
  }));
export type MenuStateIcon = z.infer<typeof menuStateIconSchema>;

const frigateConditionalSchema = z.object({
  type: z.literal('custom:frigate-card-conditional'),
  conditions: z.object({
    view: z.string().array().optional(),
  }),
  elements: z.lazy(() => pictureElementsSchema),
});
export type FrigateConditional = z.infer<typeof frigateConditionalSchema>;


// 'internalMenuIconSchema' is excluded to disallow the user from manually
// changing the internal menu buttons.
const pictureElementSchema = z.union([
  menuStateIconSchema,
  menuIconSchema,
  frigateConditionalSchema,
  stateBadgeIconSchema,
  stateIconSchema,
  stateLabelSchema,
  serviceCallButtonSchema,
  iconSchema,
  imageSchema,
  conditionalSchema,
  customSchema,
]);
export type PictureElement = z.infer<typeof pictureElementSchema>;

const pictureElementsSchema = pictureElementSchema.array().optional();
export type PictureElements = z.infer<typeof pictureElementsSchema>;

export const frigateCardConfigSchema = z.object({
  camera_entity: z.string().optional(),

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
  live_preload: z.boolean().default(false),
  image: z.string().optional(),
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
  event_viewer: z.object({
    lazy_load: z.boolean().default(true),
  }).optional(),
  menu_mode: z.enum(FRIGATE_MENU_MODES).optional().default('hidden-top'),
  menu_buttons: z
    .object({
      frigate: z.boolean().default(true),
      live: z.boolean().default(true),
      clips: z.boolean().default(true),
      snapshots: z.boolean().default(true),
      image: z.boolean().default(false),
      frigate_ui: z.boolean().default(true),
      fullscreen: z.boolean().default(true),
    })
    .optional(),
  update_entities: z.string().array().optional(),
  elements: pictureElementsSchema,
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

// Schema for card (non-user configured) menu icons.
const internalMenuIconSchema = z
  .object({
    type: z.literal('internal-menu-icon'),
    title: z.string(),
    icon: z.string().optional(),
    emphasize: z.boolean().default(false).optional(),
    card_action: z.string(),
  });

const menuButtonSchema = z.union([
  menuIconSchema,
  menuStateIconSchema,
  internalMenuIconSchema,
]);
export type MenuButton = z.infer<typeof menuButtonSchema>;
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

export interface Message {
  message: string;
  type: 'error' | 'info';
  icon?: string;
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
