import {
  CallServiceActionConfig,
  CustomActionConfig,
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

const FRIGATE_CARD_VIEWS_USER_SPECIFIED = [
  'live', // Live view.
  'clip', // Most recent clip.
  'clips', // Clips gallery.
  'snapshot', // Most recent snapshot.
  'snapshots', // Snapshots gallery.
  'image', // Static image.
] as const;

const FRIGATE_CARD_VIEWS_INTERNAL = [
  'clip-specific', // A specific clip.
  'snapshot-specific', // A specific snapshot.
] as const;

export type FrigateCardView =
  | typeof FRIGATE_CARD_VIEWS_USER_SPECIFIED[number]
  | typeof FRIGATE_CARD_VIEWS_INTERNAL[number];

const FRIGATE_MENU_MODES = [
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
export const NEXT_PREVIOUS_CONTROL_STYLES = ['none', 'thumbnails', 'chevrons'] as const;
export const LIVE_PROVIDERS = ['frigate', 'frigate-jsmpeg', 'webrtc'] as const;

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
const customActionSchema = schemaForType<CustomActionConfig>()(
  z.object({
    action: z.literal('fire-dom-event'),
  }),
);
export const frigateCardCustomActionSchema = customActionSchema.merge(
  z.object({
    // Syntactic sugar to avoid 'fire-dom-event' as part of an external API.
    action: z
      .literal('custom:frigate-card-action')
      .transform((): 'fire-dom-event' => 'fire-dom-event')
      .or(z.literal('fire-dom-event')),
    frigate_card_action: z.string(),
  }),
);
export type FrigateCardCustomAction = z.infer<typeof frigateCardCustomActionSchema>;

const actionSchema = z.union([
  toggleActionSchema,
  callServiceActionSchema,
  navigateActionSchema,
  urlActionSchema,
  moreInfoActionSchema,
  frigateCardCustomActionSchema,
]);
export type ActionType = z.infer<typeof actionSchema>;

const actionBaseSchema = z
  .object({
    tap_action: actionSchema.optional(),
    hold_action: actionSchema.optional(),
    double_tap_action: actionSchema.optional(),
  })
  .passthrough();
export type Actions = z.infer<typeof actionBaseSchema>;

const actionsSchema = z.object({
  // Passthrough to allow (at least) entity/camera_image to go through. This
  // card doesn't need these attributes, but handleAction() in
  // custom_card_helpers may depending on how the action is configured.
  actions: actionBaseSchema.optional(),
});

const elementsBaseSchema = actionBaseSchema.merge(
  z.object({
    style: z.object({}).passthrough().optional(),
    title: z.string().nullable().optional(),
  }),
);

/**
 * Picture Element Configuration.
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
  }),
);

// https://www.home-assistant.io/lovelace/picture-elements/#state-icon
const stateIconSchema = elementsBaseSchema.merge(
  z.object({
    type: z.literal('state-icon'),
    entity: z.string(),
    icon: z.string().optional(),
    state_color: z.boolean().default(true),
  }),
);

// https://www.home-assistant.io/lovelace/picture-elements/#state-label
const stateLabelSchema = elementsBaseSchema.merge(
  z.object({
    type: z.literal('state-label'),
    entity: z.string(),
    attribute: z.string().optional(),
    prefix: z.string().optional(),
    suffix: z.string().optional(),
  }),
);

// https://www.home-assistant.io/lovelace/picture-elements/#service-call-button
const serviceCallButtonSchema = elementsBaseSchema.merge(
  z.object({
    type: z.literal('service-button'),
    // Title is required for service button.
    title: z.string(),
    service: z.string(),
    service_data: z.object({}).passthrough().optional(),
  }),
);

// https://www.home-assistant.io/lovelace/picture-elements/#icon
const iconSchema = elementsBaseSchema.merge(
  z.object({
    type: z.literal('icon'),
    icon: z.string(),
    entity: z.string().optional(),
  }),
);

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
  }),
);

// https://www.home-assistant.io/lovelace/picture-elements/#image-element
const conditionalSchema = z.object({
  type: z.literal('conditional'),
  conditions: z
    .object({
      entity: z.string(),
      state: z.string().optional(),
      state_not: z.string().optional(),
    })
    .array(),
  elements: z.lazy(() => pictureElementsSchema),
});

// https://www.home-assistant.io/lovelace/picture-elements/#custom-elements
const customSchema = z
  .object({
    // Insist that Frigate card custom elements are handled by other schemas.
    type: z.string().superRefine((val, ctx) => {
      if (!val.match(/^custom:(?!frigate-card).+/)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Frigate-card custom elements must match specific schemas',
          fatal: true,
        });
      }
    }),
  })
  .passthrough();

/**
 * Custom Element Types.
 */

export const menuIconSchema = iconSchema.merge(
  z.object({
    type: z.literal('custom:frigate-card-menu-icon'),
  }),
);
export type MenuIcon = z.infer<typeof menuIconSchema>;

export const menuStateIconSchema = stateIconSchema.merge(
  z.object({
    type: z.literal('custom:frigate-card-menu-state-icon'),
  }),
);
export type MenuStateIcon = z.infer<typeof menuStateIconSchema>;

const frigateCardConditionSchema = z.object({
  view: z.string().array().optional(),
  fullscreen: z.boolean().optional(),
});
export type FrigateCardCondition = z.infer<typeof frigateCardConditionSchema>;

const frigateConditionalSchema = z.object({
  type: z.literal('custom:frigate-card-conditional'),
  conditions: frigateCardConditionSchema,
  elements: z.lazy(() => pictureElementsSchema),
});
export type FrigateConditional = z.infer<typeof frigateConditionalSchema>;

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

/**
 * Frigate configuration section.
 */
const frigateConfigDefault = {
  client_id: 'frigate' as const,
};
const frigateConfigDefaultSchema = z
  .object({
    // No URL validation to allow relative URLs within HA (e.g. addons).
    url: z.string().optional(),
    client_id: z.string().optional().default(frigateConfigDefault.client_id),
    camera_name: z.string().optional(),
    label: z.string().optional(),
    zone: z.string().optional(),
  })
  .default(frigateConfigDefault);

/**
 * View configuration section.
 */
const viewConfigDefault = {
  default: 'live' as const,
  timeout: 180,
};
const viewConfigSchema = z
  .object({
    default: z
      .enum(FRIGATE_CARD_VIEWS_USER_SPECIFIED)
      .optional()
      .default(viewConfigDefault.default),
    timeout: z
      .number()
      .or(
        z
          .string()
          .regex(/^\d+$/)
          .transform((val) => Number(val)),
      )
      .optional()
      .default(viewConfigDefault.timeout),
  })
  .merge(actionsSchema)
  .default(viewConfigDefault);

/**
 * Image view configuration section.
 */
const imageConfigSchema = z
  .object({
    src: z.string().optional(),
  })
  .merge(actionsSchema)
  .optional();
export type ImageViewConfig = z.infer<typeof imageConfigSchema>;

/**
 * Live view configuration section.
 */
const liveConfigDefault = {
  provider: 'frigate' as const,
  preload: false,
};
const webrtcConfigSchema = z
  .object({
    entity: z.string().optional(),
    url: z.string().optional(),
  })
  .passthrough()
  .optional();
export type WebRTCConfig = z.infer<typeof webrtcConfigSchema>;

const jsmpegConfigSchema = z
  .object({
    options: z
      .object({
        // https://github.com/phoboslab/jsmpeg#usage
        audio: z.boolean().optional(),
        video: z.boolean().optional(),
        pauseWhenHidden: z.boolean().optional(),
        disableGl: z.boolean().optional(),
        disableWebAssembly: z.boolean().optional(),
        preserveDrawingBuffer: z.boolean().optional(),
        progressive: z.boolean().optional(),
        throttled: z.boolean().optional(),
        chunkSize: z.number().optional(),
        maxAudioLag: z.number().optional(),
        videoBufferSize: z.number().optional(),
        audioBufferSize: z.number().optional(),
      })
      .optional(),
  })
  .optional();
export type JSMPEGConfig = z.infer<typeof jsmpegConfigSchema>;

const liveConfigSchema = z
  .object({
    provider: z.enum(LIVE_PROVIDERS).default(liveConfigDefault.provider),
    preload: z.boolean().default(liveConfigDefault.preload),
    webrtc: webrtcConfigSchema,
    jsmpeg: jsmpegConfigSchema,
  })
  .merge(actionsSchema)
  .default(liveConfigDefault);

/**
 * Menu configuration section.
 */
const menuConfigDefault = {
  mode: 'hidden-top' as const,
  buttons: {
    frigate: true,
    live: true,
    clips: true,
    snapshots: true,
    image: false,
    download: true,
    frigate_ui: true,
    fullscreen: true,
  },
  button_size: '40px',
};
const menuConfigSchema = z
  .object({
    mode: z.enum(FRIGATE_MENU_MODES).optional().default(menuConfigDefault.mode),
    buttons: z
      .object({
        frigate: z.boolean().default(menuConfigDefault.buttons.frigate),
        live: z.boolean().default(menuConfigDefault.buttons.live),
        clips: z.boolean().default(menuConfigDefault.buttons.clips),
        snapshots: z.boolean().default(menuConfigDefault.buttons.snapshots),
        image: z.boolean().default(menuConfigDefault.buttons.image),
        download: z.boolean().default(menuConfigDefault.buttons.download),
        frigate_ui: z.boolean().default(menuConfigDefault.buttons.frigate_ui),
        fullscreen: z.boolean().default(menuConfigDefault.buttons.fullscreen),
      })
      .default(menuConfigDefault.buttons),
    button_size: z.string().default(menuConfigDefault.button_size),
    conditions: frigateCardConditionSchema.optional(),
  })
  .default(menuConfigDefault);
export type MenuConfig = z.infer<typeof menuConfigSchema>;

/**
 * Event viewer configuration section (clip, snapshot, clip-specific, snapshot-specific).
 */
const viewerConfigDefault = {
  autoplay_clip: false,
  lazy_load: true,
  draggable: true,
  controls: {
    next_previous: {
      size: '48px',
      style: 'thumbnails' as const,
    },
    thumbnails: {
      size: '100px',
      mode: 'below' as const,
    },
  },
};
const nextPreviousControlConfigSchema = z
  .object({
    style: z
      .enum(NEXT_PREVIOUS_CONTROL_STYLES)
      .default(viewerConfigDefault.controls.next_previous.style),
    size: z.string().default(viewerConfigDefault.controls.next_previous.size),
  })
  .default(viewerConfigDefault.controls.next_previous);
export type NextPreviousControlConfig = z.infer<typeof nextPreviousControlConfigSchema>;

const thumbnailsControlConfigSchema = z
  .object({
    mode: z
      .enum(['none', 'above', 'below'])
      .default(viewerConfigDefault.controls.thumbnails.mode),
    size: z.string().default(viewerConfigDefault.controls.thumbnails.size),
  })
  .default(viewerConfigDefault.controls.thumbnails);
export type ThumbnailsControlConfig = z.infer<typeof thumbnailsControlConfigSchema>;

const viewerConfigSchema = z
  .object({
    autoplay_clip: z.boolean().default(viewerConfigDefault.autoplay_clip),
    lazy_load: z.boolean().default(viewerConfigDefault.lazy_load),
    draggable: z.boolean().default(viewerConfigDefault.draggable),
    controls: z
      .object({
        next_previous: nextPreviousControlConfigSchema,
        thumbnails: thumbnailsControlConfigSchema,
      })
      .default(viewerConfigDefault.controls),
  })
  .merge(actionsSchema)
  .default(viewerConfigDefault);
export type ViewerConfig = z.infer<typeof viewerConfigSchema>;

/**
 * Event gallery configuration section (clips, snapshots).
 */

const galleryConfigSchema = actionsSchema.optional();

/**
 * Dimensions configuration section.
 */
const dimensionsConfigDefault = {
  aspect_ratio_mode: 'dynamic' as const,
  aspect_ratio: [16, 9],
};
const dimensionsConfigSchema = z
  .object({
    aspect_ratio_mode: z
      .enum(['dynamic', 'static', 'unconstrained'])
      .default(dimensionsConfigDefault.aspect_ratio_mode),
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
      .default(dimensionsConfigDefault.aspect_ratio),
  })
  .default(dimensionsConfigDefault);

/**
 * Main card config.
 */
export const frigateCardConfigSchema = z.object({
  camera_entity: z.string().optional(),

  // Main configuration sections.
  frigate: frigateConfigDefaultSchema,
  view: viewConfigSchema,
  menu: menuConfigSchema,
  live: liveConfigSchema,
  event_viewer: viewerConfigSchema,
  event_gallery: galleryConfigSchema,
  image: imageConfigSchema,
  elements: pictureElementsSchema,
  dimensions: dimensionsConfigSchema,

  // Entities that should trigger a card update.
  update_entities: z.string().array().optional(),

  // Stock lovelace card config.
  type: z.string(),
  test_gui: z.boolean().optional(),
});
export type FrigateCardConfig = z.infer<typeof frigateCardConfigSchema>;
export type RawFrigateCardConfig = Record<string, unknown>;

export const frigateCardConfigDefaults = {
  frigate: frigateConfigDefault,
  view: viewConfigDefault,
  menu: menuConfigDefault,
  live: liveConfigDefault,
  event_viewer: viewerConfigDefault,
};

const menuButtonSchema = z.union([menuIconSchema, menuStateIconSchema]);
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

export interface GetFrigateCardMenuButtonParameters {
  icon: string;
  title: string;
  tap_action: string;

  hold_action?: string;
  emphasize?: boolean;
}

export interface BrowseMediaNeighbors {
  previous: BrowseMediaSource | null;
  previousIndex: number | null;

  next: BrowseMediaSource | null;
  nextIndex: number | null;
}

export interface MediaShowInfo {
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
