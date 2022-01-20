import { StyleInfo } from 'lit/directives/style-map';
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

import { deepRemoveDefaults } from './zod-util';

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

export type FrigateCardView = typeof FRIGATE_CARD_VIEWS_USER_SPECIFIED[number];

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
const LIVE_PROVIDERS = ['auto', 'frigate', 'frigate-jsmpeg', 'webrtc'] as const;
export type LiveProvider = typeof LIVE_PROVIDERS[number];

export class FrigateCardError extends Error {}

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
const frigateCardCustomActionBaseSchema = customActionSchema.extend({
  // Syntactic sugar to avoid 'fire-dom-event' as part of an external API.
  action: z
    .literal('custom:frigate-card-action')
    .transform((): 'fire-dom-event' => 'fire-dom-event')
    .or(z.literal('fire-dom-event')),
});

const FRIGATE_CARD_GENERAL_ACTIONS = [
  'frigate',
  'clip',
  'clips',
  'image',
  'live',
  'snapshot',
  'snapshots',
  'download',
  'frigate_ui',
  'fullscreen',
] as const;
const FRIGATE_CARD_ACTIONS = [...FRIGATE_CARD_GENERAL_ACTIONS, 'camera_select'] as const;
export type FrigateCardAction = typeof FRIGATE_CARD_ACTIONS[number];

const frigateCardGeneralActionSchema = frigateCardCustomActionBaseSchema.extend({
  frigate_card_action: z.enum(FRIGATE_CARD_GENERAL_ACTIONS),
});
const frigateCardCameraSelectActionSchema = frigateCardCustomActionBaseSchema.extend({
  frigate_card_action: z.literal('camera_select'),
  camera: z.string(),
});
export const frigateCardCustomActionSchema = z.union([
  frigateCardGeneralActionSchema,
  frigateCardCameraSelectActionSchema,
]);
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

const elementsBaseSchema = actionBaseSchema.extend({
  style: z.object({}).passthrough().optional(),
  title: z.string().nullable().optional(),
});

/**
 * Picture Element Configuration.
 *
 * All picture element types are validated (not just the Frigate card custom
 * ones) as a convenience to present the user with a consistent error display
 * up-front regardless of where they made their error.
 */

// https://www.home-assistant.io/lovelace/picture-elements/#state-badge
const stateBadgeIconSchema = elementsBaseSchema.extend({
  type: z.literal('state-badge'),
  entity: z.string(),
});

// https://www.home-assistant.io/lovelace/picture-elements/#state-icon
const stateIconSchema = elementsBaseSchema.extend({
  type: z.literal('state-icon'),
  entity: z.string(),
  icon: z.string().optional(),
  state_color: z.boolean().default(true),
});

// https://www.home-assistant.io/lovelace/picture-elements/#state-label
const stateLabelSchema = elementsBaseSchema.extend({
  type: z.literal('state-label'),
  entity: z.string(),
  attribute: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});

// https://www.home-assistant.io/lovelace/picture-elements/#service-call-button
const serviceCallButtonSchema = elementsBaseSchema.extend({
  type: z.literal('service-button'),
  // Title is required for service button.
  title: z.string(),
  service: z.string(),
  service_data: z.object({}).passthrough().optional(),
});

// https://www.home-assistant.io/lovelace/picture-elements/#icon-element
const iconSchema = elementsBaseSchema.extend({
  type: z.literal('icon'),
  icon: z.string(),
  entity: z.string().optional(),
});

// https://www.home-assistant.io/lovelace/picture-elements/#image-element
const imageSchema = elementsBaseSchema.extend({
  type: z.literal('image'),
  entity: z.string().optional(),
  image: z.string().optional(),
  camera_image: z.string().optional(),
  camera_view: z.string().optional(),
  state_image: z.object({}).passthrough().optional(),
  filter: z.string().optional(),
  state_filter: z.object({}).passthrough().optional(),
  aspect_ratio: z.string().optional(),
});

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
 * Camera configuration section
 */
export const cameraConfigDefault = {
  client_id: 'frigate' as const,
  live_provider: 'auto' as const,
};
const webrtcCameraConfigSchema = z.object({
  entity: z.string().optional(),
  url: z.string().optional(),
});
const cameraConfigSchema = z
  .object({
    // No URL validation to allow relative URLs within HA (e.g. Frigate addon).
    frigate_url: z.string().optional(),
    client_id: z.string().default(cameraConfigDefault.client_id),
    camera_name: z.string().optional(),
    label: z.string().optional(),
    zone: z.string().optional(),
    camera_entity: z.string().optional(),
    live_provider: z.enum(LIVE_PROVIDERS).default(cameraConfigDefault.live_provider),

    // Used for presentation in the UI (autodetected from the entity if
    // specified).
    icon: z.string().optional(),
    title: z.string().optional(),

    // Optional identifier to separate different camera configurations used in
    // this card.
    id: z.string().optional(),

    // Camera identifiers for WebRTC.
    webrtc: webrtcCameraConfigSchema.optional(),
  })
  .default(cameraConfigDefault);
export type CameraConfig = z.infer<typeof cameraConfigSchema>;

/**
 * Custom Element Types.
 */

export const menuIconSchema = iconSchema.extend({
  type: z.literal('custom:frigate-card-menu-icon'),
});
export type MenuIcon = z.infer<typeof menuIconSchema>;

export const menuStateIconSchema = stateIconSchema.extend({
  type: z.literal('custom:frigate-card-menu-state-icon'),
});
export type MenuStateIcon = z.infer<typeof menuStateIconSchema>;

const menuSubmenuItemSchema = elementsBaseSchema.extend({
  entity: z.string().optional(),
  icon: z.string().optional(),
  state_color: z.boolean().default(true),
  selected: z.boolean().default(false),
});
export type MenuSubmenuItem = z.infer<typeof menuSubmenuItemSchema>;

export const menuSubmenuSchema = iconSchema.extend({
  type: z.literal('custom:frigate-card-menu-submenu'),
  items: menuSubmenuItemSchema.array(),
});
export type MenuSubmenu = z.infer<typeof menuSubmenuSchema>;

const frigateCardConditionSchema = z.object({
  view: z.string().array().optional(),
  fullscreen: z.boolean().optional(),
  camera: z.string().array().optional(),
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
  menuSubmenuSchema,
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
 * View configuration section.
 */
const viewConfigDefault = {
  default: 'live' as const,
  timeout: 180,
  update_force: false,
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
    update_force: z.boolean().default(viewConfigDefault.update_force),
    update_entities: z.string().array().optional(),
  })
  .merge(actionsSchema)
  .default(viewConfigDefault);

/**
 * Image view configuration section.
 */

const imageConfigDefault = {
  refresh_seconds: 0,
};
const imageConfigSchema = z
  .object({
    src: z.string().optional(),
    refresh_seconds: z.number().min(0).default(imageConfigDefault.refresh_seconds)
  })
  .merge(actionsSchema)
  .default(imageConfigDefault);
export type ImageViewConfig = z.infer<typeof imageConfigSchema>;

/**
 * Thumbnail controls configuration section.
 */

const thumbnailsControlSchema = z.object({
  mode: z.enum(['none', 'above', 'below']),
  size: z.string().optional(),
});
export type ThumbnailsControlConfig = z.infer<typeof thumbnailsControlSchema>;

/**
 * Next/Previous Control configuration section.
 */

const nextPreviousControlConfigSchema = z.object({
  style: z.enum(['none', 'chevrons', 'icons', 'thumbnails']),
  size: z.string(),
});
export type NextPreviousControlConfig = z.infer<typeof nextPreviousControlConfigSchema>;

/**
 * Live view configuration section.
 */
const liveConfigDefault = {
  preload: false,
  lazy_load: true,
  draggable: true,
  controls: {
    next_previous: {
      size: '48px',
      style: 'chevrons' as const,
    },
    thumbnails: {
      media: 'clips' as const,
      size: '100px',
      mode: 'none' as const,
    },
  },
};

const webrtcConfigSchema = webrtcCameraConfigSchema.passthrough().optional();
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

const liveNextPreviousControlConfigSchema = nextPreviousControlConfigSchema.extend({
  // Live cannot show thumbnails, remove that option.
  style: z
    .enum(['none', 'chevrons', 'icons'])
    .default(liveConfigDefault.controls.next_previous.style),
  size: nextPreviousControlConfigSchema.shape.size.default(
    liveConfigDefault.controls.next_previous.size,
  ),
});

const liveThumbnailControlConfigSchema = thumbnailsControlSchema.extend({
  mode: thumbnailsControlSchema.shape.mode.default(
    liveConfigDefault.controls.thumbnails.mode,
  ),
  size: thumbnailsControlSchema.shape.size.default(
    liveConfigDefault.controls.thumbnails.size,
  ),
  media: z
    .enum(['clips', 'snapshots'])
    .default(liveConfigDefault.controls.thumbnails.media),
});

const liveOverridableConfigSchema = z
  .object({
    webrtc: webrtcConfigSchema,
    jsmpeg: jsmpegConfigSchema,
    controls: z
      .object({
        next_previous: liveNextPreviousControlConfigSchema.default(
          liveConfigDefault.controls.next_previous,
        ),
        thumbnails: liveThumbnailControlConfigSchema.default(
          liveConfigDefault.controls.thumbnails,
        ),
      })
      .default(liveConfigDefault.controls),
  })
  .merge(actionsSchema);

const liveConfigSchema = liveOverridableConfigSchema
  .extend({
    // Non-overrideable parameters.
    preload: z.boolean().default(liveConfigDefault.preload),
    lazy_load: z.boolean().default(liveConfigDefault.lazy_load),
    draggable: z.boolean().default(liveConfigDefault.draggable),
  })
  .default(liveConfigDefault);
export type LiveConfig = z.infer<typeof liveConfigSchema>;

/**
 * Menu configuration section.
 */
const menuConfigDefault = {
  mode: 'hidden-top' as const,
  buttons: {
    frigate: true,
    cameras: true,
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
    mode: z.enum(FRIGATE_MENU_MODES).default(menuConfigDefault.mode),
    buttons: z
      .object({
        frigate: z.boolean().default(menuConfigDefault.buttons.frigate),
        cameras: z.boolean().default(menuConfigDefault.buttons.cameras),
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
  })
  .default(menuConfigDefault);
export type MenuConfig = z.infer<typeof menuConfigSchema>;

/**
 * Event viewer configuration section (clip, snapshot).
 */
const viewerConfigDefault = {
  autoplay_clip: true,
  lazy_load: true,
  draggable: true,
  controls: {
    next_previous: {
      size: '48px',
      style: 'thumbnails' as const,
    },
    thumbnails: {
      size: '100px',
      mode: 'none' as const,
    },
  },
};
const viewerNextPreviousControlConfigSchema = nextPreviousControlConfigSchema.extend({
  style: z
    .enum(['none', 'thumbnails', 'chevrons'])
    .default(viewerConfigDefault.controls.next_previous.style),
  size: z.string().default(viewerConfigDefault.controls.next_previous.size),
});
export type ViewerNextPreviousControlConfig = z.infer<
  typeof viewerNextPreviousControlConfigSchema
>;

const viewerConfigSchema = z
  .object({
    autoplay_clip: z.boolean().default(viewerConfigDefault.autoplay_clip),
    lazy_load: z.boolean().default(viewerConfigDefault.lazy_load),
    draggable: z.boolean().default(viewerConfigDefault.draggable),
    controls: z
      .object({
        next_previous: viewerNextPreviousControlConfigSchema.default(
          viewerConfigDefault.controls.next_previous,
        ),
        thumbnails: thumbnailsControlSchema
          .extend({
            mode: thumbnailsControlSchema.shape.mode.default(
              viewerConfigDefault.controls.thumbnails.mode,
            ),
            size: thumbnailsControlSchema.shape.size.default(
              viewerConfigDefault.controls.thumbnails.size,
            ),
          })
          .default(viewerConfigDefault.controls.thumbnails),
      })
      .default(viewerConfigDefault.controls),
  })
  .merge(actionsSchema)
  .default(viewerConfigDefault);
export type ViewerConfig = z.infer<typeof viewerConfigSchema>;

/**
 * Event gallery configuration section (clips, snapshots).
 */
const galleryConfigDefault = {
  min_columns: 5,
};

const galleryConfigSchema = z
  .object({
    min_columns: z.number().min(1).max(10).default(galleryConfigDefault.min_columns),
  })
  .merge(actionsSchema)
  .default(galleryConfigDefault);
export type GalleryConfig = z.infer<typeof galleryConfigSchema>;

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
 * Configuration overrides
 */
// Strip all defaults from the override schemas, to ensure values are only what
// the user has specified.
const overrideConfigurationSchema = z.object({
  live: deepRemoveDefaults(liveOverridableConfigSchema).optional(),
  menu: deepRemoveDefaults(menuConfigSchema).optional(),
});
export type OverrideConfigurationKey = keyof z.infer<typeof overrideConfigurationSchema>;

const overridesSchema = z
  .object({
    conditions: frigateCardConditionSchema,
    overrides: overrideConfigurationSchema,
  })
  .array()
  .optional();

const liveOverridesSchema = z
  .object({
    conditions: frigateCardConditionSchema,
    overrides: liveOverridableConfigSchema,
  })
  .array()
  .optional();
export type LiveOverrides = z.infer<typeof liveOverridesSchema>;

/**
 * Main card config.
 */
export const frigateCardConfigSchema = z.object({
  // Main configuration sections.
  cameras: cameraConfigSchema.array().nonempty(),
  view: viewConfigSchema,
  menu: menuConfigSchema,
  live: liveConfigSchema,
  event_viewer: viewerConfigSchema,
  event_gallery: galleryConfigSchema,
  image: imageConfigSchema,
  elements: pictureElementsSchema,
  dimensions: dimensionsConfigSchema,

  // Configuration overrides.
  overrides: overridesSchema,

  // Stock lovelace card config.
  type: z.string(),
  test_gui: z.boolean().optional(),
});
export type FrigateCardConfig = z.infer<typeof frigateCardConfigSchema>;
export type RawFrigateCardConfig = Record<string, unknown>;
export type RawFrigateCardConfigArray = RawFrigateCardConfig[];

export const frigateCardConfigDefaults = {
  cameras: cameraConfigDefault,
  view: viewConfigDefault,
  menu: menuConfigDefault,
  live: liveConfigDefault,
  event_viewer: viewerConfigDefault,
  event_gallery: galleryConfigDefault,
  image: imageConfigDefault,
};

const menuButtonSchema = z.union([
  menuIconSchema,
  menuStateIconSchema,
  menuSubmenuSchema,
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

export interface GetFrigateCardMenuButtonParameters {
  icon: string;
  title: string;
  tap_action: FrigateCardAction;
  hold_action?: FrigateCardAction;
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

export interface StateParameters {
  entity?: string;
  icon?: string;
  title?: string | null;
  state_color?: boolean;
  style?: StyleInfo;
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
