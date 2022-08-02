import {
  CallServiceActionConfig,
  ConfirmationRestrictionConfig,
  CustomActionConfig,
  HomeAssistant,
  LovelaceCardConfig,
  MoreInfoActionConfig,
  NavigateActionConfig,
  NoActionConfig,
  Themes,
  ToggleActionConfig,
  UrlActionConfig,
} from 'custom-card-helpers';
import { StyleInfo } from 'lit/directives/style-map.js';
import { z } from 'zod';
import { deepRemoveDefaults } from './utils/zod.js';

// The min allowed size of buttons.
export const BUTTON_SIZE_MIN = 20;

// The min/max width thumbnail (Frigate returns a maximum of 175px).
export const THUMBNAIL_WIDTH_MAX = 175;
export const THUMBNAIL_WIDTH_MIN = 75;

/**
 * Internal types.
 */

export const FRIGATE_CARD_VIEWS_USER_SPECIFIED = [
  'live',
  'clip',
  'clips',
  'snapshot',
  'snapshots',
  'image',
  'timeline',
] as const;

const FRIGATE_CARD_VIEWS = [
  ...FRIGATE_CARD_VIEWS_USER_SPECIFIED,

  // Media: A generic piece of media (could be clip, snapshot, recording).
  'media',
] as const;

export type FrigateCardView = typeof FRIGATE_CARD_VIEWS[number];
export type FrigateCardUserSpecifiedView =
  typeof FRIGATE_CARD_VIEWS_USER_SPECIFIED[number];
export const FRIGATE_CARD_VIEW_DEFAULT = 'live' as const;

const FRIGATE_MENU_STYLES = ['none', 'hidden', 'overlay', 'hover', 'outside'] as const;
const FRIGATE_MENU_POSITIONS = ['left', 'right', 'top', 'bottom'] as const;
const FRIGATE_MENU_ALIGNMENTS = FRIGATE_MENU_POSITIONS;

export const FRIGATE_MENU_PRIORITY_DEFAULT = 50;
export const FRIGATE_MENU_PRIORITY_MAX = 100;

const LIVE_PROVIDERS = ['auto', 'ha', 'frigate-jsmpeg', 'webrtc-card'] as const;
export type LiveProvider = typeof LIVE_PROVIDERS[number];

const MEDIA_ACTION_NEGATIVE_CONDITIONS = [
  'all',
  'unselected',
  'hidden',
  'never',
] as const;
export type LazyUnloadCondition = typeof MEDIA_ACTION_NEGATIVE_CONDITIONS[number];
export type AutoMuteCondition = typeof MEDIA_ACTION_NEGATIVE_CONDITIONS[number];
export type AutoPauseCondition = typeof MEDIA_ACTION_NEGATIVE_CONDITIONS[number];

const MEDIA_ACTION_POSITIVE_CONDITIONS = [
  'all',
  'selected',
  'visible',
  'never',
] as const;
export type AutoUnmuteCondition = typeof MEDIA_ACTION_POSITIVE_CONDITIONS[number];
export type AutoPlayCondition = typeof MEDIA_ACTION_POSITIVE_CONDITIONS[number];

export class FrigateCardError extends Error {
  context?: unknown;

  constructor(message: string, context?: unknown) {
    super(message);
    this.context = context;
  }
}

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

// https://www.home-assistant.io/dashboards/actions/#options-for-confirmation
const actionBaseSchema = z.object({
  confirmation: z
    .boolean()
    .or(
      z.object({
        text: z.string().optional(),
        exemptions: z
          .object({
            user: z.string(),
          })
          .array()
          .optional(),
      }),
    )
    .optional(),
});

// HA accepts either a boolean or a ConfirmationRestrictionConfig object.
// `custom-card-helpers` currently only supports the latter. For maximum
// compatibility, this card supports what HA supports.
export interface ExtendedConfirmationRestrictionConfig {
  confirmation?: boolean | ConfirmationRestrictionConfig;
}

const toggleActionSchema = schemaForType<
  ToggleActionConfig & ExtendedConfirmationRestrictionConfig
>()(
  actionBaseSchema.extend({
    action: z.literal('toggle'),
  }),
);
const callServiceActionSchema = schemaForType<
  CallServiceActionConfig & ExtendedConfirmationRestrictionConfig
>()(
  actionBaseSchema.extend({
    action: z.literal('call-service'),
    service: z.string(),
    service_data: z.object({}).passthrough().optional(),
  }),
);
const navigateActionSchema = schemaForType<
  NavigateActionConfig & ExtendedConfirmationRestrictionConfig
>()(
  actionBaseSchema.extend({
    action: z.literal('navigate'),
    navigation_path: z.string(),
  }),
);
const urlActionSchema = schemaForType<
  UrlActionConfig & ExtendedConfirmationRestrictionConfig
>()(
  actionBaseSchema.extend({
    action: z.literal('url'),
    url_path: z.string(),
  }),
);
const moreInfoActionSchema = schemaForType<
  MoreInfoActionConfig & ExtendedConfirmationRestrictionConfig
>()(
  actionBaseSchema.extend({
    action: z.literal('more-info'),
  }),
);
const customActionSchema = schemaForType<
  CustomActionConfig & ExtendedConfirmationRestrictionConfig
>()(
  actionBaseSchema.extend({
    action: z.literal('fire-dom-event'),
  }).passthrough(),
);
const noActionSchema = schemaForType<
  NoActionConfig & ExtendedConfirmationRestrictionConfig
>()(
  actionBaseSchema.extend({
    action: z.literal('none'),
  }),
);

const frigateCardCustomactionsBaseSchema = customActionSchema.extend({
  action: z
    .literal('custom:frigate-card-action')
    // Syntactic sugar to avoid 'fire-dom-event' as part of an external API.
    .transform((): 'fire-dom-event' => 'fire-dom-event')
    .or(z.literal('fire-dom-event')),
});

const FRIGATE_CARD_GENERAL_ACTIONS = [
  'default',
  'clip',
  'clips',
  'image',
  'live',
  'snapshot',
  'snapshots',
  'timeline',
  'download',
  'frigate_ui',
  'fullscreen',
  'menu_toggle',
  'diagnostics',
] as const;
const FRIGATE_CARD_ACTIONS = [
  ...FRIGATE_CARD_GENERAL_ACTIONS,
  'camera_select',
  'media_player',
] as const;
export type FrigateCardAction = typeof FRIGATE_CARD_ACTIONS[number];

const frigateCardGeneralActionSchema = frigateCardCustomactionsBaseSchema.extend({
  frigate_card_action: z.enum(FRIGATE_CARD_GENERAL_ACTIONS),
});
const frigateCardCameraSelectActionSchema = frigateCardCustomactionsBaseSchema.extend({
  frigate_card_action: z.literal('camera_select'),
  camera: z.string(),
});
const frigateCarMediaPlayerActionSchema = frigateCardCustomactionsBaseSchema.extend({
  frigate_card_action: z.literal('media_player'),
  media_player: z.string(),
  media_player_action: z.enum(['play', 'stop']),
});

export const frigateCardCustomActionSchema = z.union([
  frigateCardGeneralActionSchema,
  frigateCardCameraSelectActionSchema,
  frigateCarMediaPlayerActionSchema,
]);
export type FrigateCardCustomAction = z.infer<typeof frigateCardCustomActionSchema>;

// Cannot use discriminatedUnion since frigateCardCustomActionSchema uses a
// transform on the discriminated union key.
const actionSchema = z.union([
  toggleActionSchema,
  callServiceActionSchema,
  navigateActionSchema,
  urlActionSchema,
  moreInfoActionSchema,
  noActionSchema,
  customActionSchema,
  frigateCardCustomActionSchema,
]);
export type ActionType = z.infer<typeof actionSchema>;

const actionsBaseSchema = z
  .object({
    tap_action: actionSchema.or(actionSchema.array()).optional(),
    hold_action: actionSchema.or(actionSchema.array()).optional(),
    double_tap_action: actionSchema.or(actionSchema.array()).optional(),
    start_tap_action: actionSchema.or(actionSchema.array()).optional(),
    end_tap_action: actionSchema.or(actionSchema.array()).optional(),
  })
  // Passthrough to allow (at least) entity/camera_image to go through. This
  // card doesn't need these attributes, but handleAction() in
  // custom_card_helpers may depending on how the action is configured.
  .passthrough();
export type Actions = z.infer<typeof actionsBaseSchema>;
export type ActionsConfig = Actions & {
  camera_image?: string;
  entity?: string;
};

const actionsSchema = z.object({
  actions: actionsBaseSchema.optional(),
});

const elementsBaseSchema = actionsBaseSchema.extend({
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

// This state condition is used both for the Picture elements conditional
// schema, and also in frigateCardConditionSchema.
const stateConditions = z
  .object({
    entity: z.string(),
    state: z.string().optional(),
    state_not: z.string().optional(),
  })
  .array();

// https://www.home-assistant.io/lovelace/picture-elements/#image-element
const conditionalSchema = z.object({
  type: z.literal('conditional'),
  conditions: stateConditions,
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
  live_provider: 'auto' as const,
  frigate: {
    client_id: 'frigate' as const,
  },
  dependencies: {
    all_cameras: false,
    cameras: [],
  },
  triggers: {
    motion: false,
    occupancy: true,
    entities: [],
  },
};
const webrtcCardCameraConfigSchema = z.object({
  entity: z.string().optional(),
  url: z.string().optional(),
});
const cameraConfigSchema = z
  .object({
    camera_entity: z.string().optional(),
    live_provider: z.enum(LIVE_PROVIDERS).default(cameraConfigDefault.live_provider),

    // Used for presentation in the UI (autodetected from the entity if
    // specified).
    icon: z.string().optional(),
    title: z.string().optional(),

    // Optional identifier to separate different camera configurations used in
    // this card.
    id: z.string().optional(),

    frigate: z
      .object({
        // No URL validation to allow relative URLs within HA (e.g. Frigate addon).
        url: z.string().optional(),
        client_id: z.string().default(cameraConfigDefault.frigate.client_id),
        camera_name: z.string().optional(),
        label: z.string().optional(),
        zone: z.string().optional(),
      })
      .default(cameraConfigDefault.frigate),

    // Camera identifiers for WebRTC.
    webrtc_card: webrtcCardCameraConfigSchema.optional(),

    dependencies: z
      .object({
        all_cameras: z.boolean().default(cameraConfigDefault.dependencies.all_cameras),
        cameras: z.string().array().default(cameraConfigDefault.dependencies.cameras),
      })
      .default(cameraConfigDefault.dependencies),

    triggers: z
      .object({
        motion: z.boolean().default(cameraConfigDefault.triggers.motion),
        occupancy: z.boolean().default(cameraConfigDefault.triggers.occupancy),
        entities: z.string().array().default(cameraConfigDefault.triggers.entities),
      })
      .default(cameraConfigDefault.triggers),
  })
  .default(cameraConfigDefault);
export type CameraConfig = z.infer<typeof cameraConfigSchema>;

/**
 * Custom Element Types.
 */
const menuBaseSchema = z.object({
  enabled: z.boolean().default(true).optional(),
  priority: z
    .number()
    .min(0)
    .max(FRIGATE_MENU_PRIORITY_MAX)
    .default(FRIGATE_MENU_PRIORITY_DEFAULT)
    .optional(),
  alignment: z.enum(['matching', 'opposing']).default('matching').optional(),
  icon: z.string().optional(),
});

export const menuIconSchema = menuBaseSchema.merge(iconSchema).extend({
  type: z.literal('custom:frigate-card-menu-icon'),
});
export type MenuIcon = z.infer<typeof menuIconSchema>;

export const menuStateIconSchema = menuBaseSchema
  .merge(stateIconSchema)
  .extend({
    type: z.literal('custom:frigate-card-menu-state-icon'),
  })
  .merge(menuBaseSchema);
export type MenuStateIcon = z.infer<typeof menuStateIconSchema>;

const menuSubmenuItemSchema = elementsBaseSchema.extend({
  entity: z.string().optional(),
  icon: z.string().optional(),
  state_color: z.boolean().default(true),
  selected: z.boolean().default(false),
  subtitle: z.string().optional(),
  enabled: z.boolean().default(true),
});
export type MenuSubmenuItem = z.infer<typeof menuSubmenuItemSchema>;

const menuSubmenuSchema = menuBaseSchema.merge(iconSchema).extend({
  type: z.literal('custom:frigate-card-menu-submenu'),
  items: menuSubmenuItemSchema.array(),
});
export type MenuSubmenu = z.infer<typeof menuSubmenuSchema>;

const menuSubmenuSelectSchema = menuBaseSchema.merge(stateIconSchema).extend({
  type: z.literal('custom:frigate-card-menu-submenu-select'),
  options: z.record(menuSubmenuItemSchema.deepPartial()).optional(),
});
export type MenuSubmenuSelect = z.infer<typeof menuSubmenuSelectSchema>;

export type MenuItem = MenuIcon | MenuStateIcon | MenuSubmenu | MenuSubmenuSelect;

const frigateCardConditionSchema = z.object({
  view: z.string().array().optional(),
  fullscreen: z.boolean().optional(),
  camera: z.string().array().optional(),
  state: stateConditions.optional(),
});
export type FrigateCardCondition = z.infer<typeof frigateCardConditionSchema>;

const frigateConditionalSchema = z.object({
  type: z.literal('custom:frigate-card-conditional'),
  conditions: frigateCardConditionSchema,
  elements: z.lazy(() => pictureElementsSchema),
});
export type FrigateConditional = z.infer<typeof frigateConditionalSchema>;

// Cannot use discriminatedUnion since customSchema uses a superRefine, which
// causes false rejections.
const pictureElementSchema = z.union([
  menuStateIconSchema,
  menuIconSchema,
  menuSubmenuSchema,
  menuSubmenuSelectSchema,
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
  default: FRIGATE_CARD_VIEW_DEFAULT,
  camera_select: 'current' as const,
  timeout_seconds: 300,
  update_seconds: 0,
  update_force: false,
  update_cycle_camera: false,
  dark_mode: 'off' as const,
  scan: {
    enabled: false,
    show_trigger_status: true,
    untrigger_seconds: 0,
    untrigger_reset: true,
  },
};
const viewConfigSchema = z
  .object({
    default: z
      .enum(FRIGATE_CARD_VIEWS_USER_SPECIFIED)
      .default(viewConfigDefault.default),
    camera_select: z
      .enum([...FRIGATE_CARD_VIEWS_USER_SPECIFIED, 'current'])
      .default(viewConfigDefault.camera_select),
    timeout_seconds: z.number().default(viewConfigDefault.timeout_seconds),
    update_seconds: z.number().default(viewConfigDefault.update_seconds),
    update_force: z.boolean().default(viewConfigDefault.update_force),
    update_cycle_camera: z.boolean().default(viewConfigDefault.update_cycle_camera),
    update_entities: z.string().array().optional(),
    render_entities: z.string().array().optional(),
    dark_mode: z.enum(['on', 'off', 'auto']).optional(),
    scan: z
      .object({
        enabled: z.boolean().default(viewConfigDefault.scan.enabled),
        show_trigger_status: z
          .boolean()
          .default(viewConfigDefault.scan.show_trigger_status),
        untrigger_seconds: z.number().default(viewConfigDefault.scan.untrigger_seconds),
        untrigger_reset: z.boolean().default(viewConfigDefault.scan.untrigger_reset),
      })
      .default(viewConfigDefault.scan),
  })
  .merge(actionsSchema)
  .default(viewConfigDefault);

/**
 * Image view configuration section.
 */

export const IMAGE_MODES = ['screensaver', 'camera', 'url'] as const;
const imageConfigDefault = {
  mode: 'url' as const,
  refresh_seconds: 0,
};
const imageConfigSchema = z
  .object({
    mode: z.enum(IMAGE_MODES).default(imageConfigDefault.mode),
    url: z.string().optional(),
    refresh_seconds: z.number().min(0).default(imageConfigDefault.refresh_seconds),
  })
  .merge(actionsSchema)
  .default(imageConfigDefault);
export type ImageViewConfig = z.infer<typeof imageConfigSchema>;

/**
 * Thumbnail controls configuration section.
 */

const thumbnailsControlSchema = z.object({
  mode: z.enum(['none', 'above', 'below', 'left', 'right']),
  size: z.number().min(THUMBNAIL_WIDTH_MIN).max(THUMBNAIL_WIDTH_MAX).optional(),
  show_details: z.boolean().optional(),
  show_favorite_control: z.boolean().optional(),
  show_timeline_control: z.boolean().optional(),
});
export type ThumbnailsControlConfig = z.infer<typeof thumbnailsControlSchema>;

/**
 * Next/Previous Control configuration section.
 */

const nextPreviousControlConfigSchema = z.object({
  style: z.enum(['none', 'chevrons', 'icons', 'thumbnails']),
  size: z.number().min(BUTTON_SIZE_MIN),
});
export type NextPreviousControlConfig = z.infer<typeof nextPreviousControlConfigSchema>;

/**
 * Carousel transition effect configuration.
 */
const transitionEffectConfigSchema = z.enum(['none', 'slide']);
export type TransitionEffect = z.infer<typeof transitionEffectConfigSchema>;

/**
 * Title Control configuration section.
 */
const titleControlConfigSchema = z.object({
  mode: z.enum([
    'none',
    'popup-top-right',
    'popup-top-left',
    'popup-bottom-right',
    'popup-bottom-left',
  ]),
  duration_seconds: z.number().min(0).max(60),
});
export type TitleControlConfig = z.infer<typeof titleControlConfigSchema>;

/**
 * Live view configuration section.
 */
const liveConfigDefault = {
  auto_play: 'all' as const,
  auto_pause: 'never' as const,
  auto_mute: 'all' as const,
  auto_unmute: 'never' as const,
  preload: false,
  lazy_load: true,
  lazy_unload: 'never' as const,
  draggable: true,
  transition_effect: 'slide' as const,
  controls: {
    next_previous: {
      size: 48,
      style: 'chevrons' as const,
    },
    thumbnails: {
      media: 'clips' as const,
      size: 100,
      show_details: true,
      show_favorite_control: true,
      show_timeline_control: true,
      mode: 'left' as const,
    },
    title: {
      mode: 'popup-bottom-right' as const,
      duration_seconds: 2,
    },
  },
};

const webrtcCardConfigSchema = webrtcCardCameraConfigSchema.passthrough().optional();
export type WebRTCCardConfig = z.infer<typeof webrtcCardConfigSchema>;

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

const liveOverridableConfigSchema = z
  .object({
    webrtc_card: webrtcCardConfigSchema,
    jsmpeg: jsmpegConfigSchema,
    controls: z
      .object({
        next_previous: nextPreviousControlConfigSchema
          .extend({
            // Live cannot show thumbnails, remove that option.
            style: z
              .enum(['none', 'chevrons', 'icons'])
              .default(liveConfigDefault.controls.next_previous.style),
            size: nextPreviousControlConfigSchema.shape.size.default(
              liveConfigDefault.controls.next_previous.size,
            ),
          })
          .default(liveConfigDefault.controls.next_previous),
        thumbnails: thumbnailsControlSchema
          .extend({
            mode: thumbnailsControlSchema.shape.mode.default(
              liveConfigDefault.controls.thumbnails.mode,
            ),
            size: thumbnailsControlSchema.shape.size.default(
              liveConfigDefault.controls.thumbnails.size,
            ),
            show_details: thumbnailsControlSchema.shape.show_details.default(
              liveConfigDefault.controls.thumbnails.show_details,
            ),
            show_favorite_control: thumbnailsControlSchema.shape.show_favorite_control.default(
              liveConfigDefault.controls.thumbnails.show_favorite_control,
            ),
            show_timeline_control: thumbnailsControlSchema.shape.show_timeline_control.default(
              liveConfigDefault.controls.thumbnails.show_timeline_control,
            ),
            media: z
              .enum(['clips', 'snapshots'])
              .default(liveConfigDefault.controls.thumbnails.media),
          })
          .default(liveConfigDefault.controls.thumbnails),
        title: titleControlConfigSchema
          .extend({
            mode: titleControlConfigSchema.shape.mode.default(
              liveConfigDefault.controls.title.mode,
            ),
            duration_seconds: titleControlConfigSchema.shape.duration_seconds.default(
              liveConfigDefault.controls.title.duration_seconds,
            ),
          })
          .default(liveConfigDefault.controls.title),
      })
      .default(liveConfigDefault.controls),
  })
  .merge(actionsSchema);

const liveConfigSchema = liveOverridableConfigSchema
  .extend({
    // Non-overrideable parameters.
    auto_play: z
      .enum(MEDIA_ACTION_POSITIVE_CONDITIONS)
      .default(liveConfigDefault.auto_play),
    auto_pause: z
      .enum(MEDIA_ACTION_NEGATIVE_CONDITIONS)
      .default(liveConfigDefault.auto_pause),
    auto_mute: z
      .enum(MEDIA_ACTION_NEGATIVE_CONDITIONS)
      .default(liveConfigDefault.auto_mute),
    auto_unmute: z
      .enum(MEDIA_ACTION_POSITIVE_CONDITIONS)
      .default(liveConfigDefault.auto_unmute),
    preload: z.boolean().default(liveConfigDefault.preload),
    lazy_load: z.boolean().default(liveConfigDefault.lazy_load),
    lazy_unload: z
      .enum(MEDIA_ACTION_NEGATIVE_CONDITIONS)
      .default(liveConfigDefault.lazy_unload),
    draggable: z.boolean().default(liveConfigDefault.draggable),
    transition_effect: transitionEffectConfigSchema.default(
      liveConfigDefault.transition_effect,
    ),
  })
  .default(liveConfigDefault);
export type LiveConfig = z.infer<typeof liveConfigSchema>;

/**
 * Menu configuration section.
 */

const visibleButtonDefault = {
  priority: FRIGATE_MENU_PRIORITY_DEFAULT,
  enabled: true,
};
const hiddenButtonDefault = {
  priority: FRIGATE_MENU_PRIORITY_DEFAULT,
  enabled: false,
};

const menuConfigDefault = {
  style: 'hidden' as const,
  position: 'top' as const,
  alignment: 'left' as const,
  buttons: {
    frigate: visibleButtonDefault,
    cameras: visibleButtonDefault,
    live: visibleButtonDefault,
    clips: visibleButtonDefault,
    snapshots: visibleButtonDefault,
    image: hiddenButtonDefault,
    timeline: visibleButtonDefault,
    download: visibleButtonDefault,
    frigate_ui: visibleButtonDefault,
    fullscreen: visibleButtonDefault,
    media_player: visibleButtonDefault,
  },
  button_size: 40,
};

const visibleButtonSchema = menuBaseSchema.extend({
  enabled: menuBaseSchema.shape.enabled.default(visibleButtonDefault.enabled),
  priority: menuBaseSchema.shape.priority.default(visibleButtonDefault.priority),
});
const hiddenButtonSchema = menuBaseSchema.extend({
  enabled: menuBaseSchema.shape.enabled.default(hiddenButtonDefault.enabled),
  priority: menuBaseSchema.shape.priority.default(hiddenButtonDefault.priority),
});

const menuConfigSchema = z
  .object({
    style: z.enum(FRIGATE_MENU_STYLES).default(menuConfigDefault.style),
    position: z.enum(FRIGATE_MENU_POSITIONS).default(menuConfigDefault.position),
    alignment: z.enum(FRIGATE_MENU_ALIGNMENTS).default(menuConfigDefault.alignment),
    buttons: z
      .object({
        frigate: visibleButtonSchema.default(menuConfigDefault.buttons.frigate),
        cameras: visibleButtonSchema.default(menuConfigDefault.buttons.cameras),
        live: visibleButtonSchema.default(menuConfigDefault.buttons.live),
        clips: visibleButtonSchema.default(menuConfigDefault.buttons.clips),
        snapshots: visibleButtonSchema.default(menuConfigDefault.buttons.snapshots),
        image: hiddenButtonSchema.default(menuConfigDefault.buttons.image),
        timeline: visibleButtonSchema.default(menuConfigDefault.buttons.timeline),
        download: visibleButtonSchema.default(menuConfigDefault.buttons.download),
        frigate_ui: visibleButtonSchema.default(menuConfigDefault.buttons.frigate_ui),
        fullscreen: visibleButtonSchema.default(menuConfigDefault.buttons.fullscreen),
        media_player: visibleButtonSchema.default(
          menuConfigDefault.buttons.media_player,
        ),
      })
      .default(menuConfigDefault.buttons),
    button_size: z.number().min(BUTTON_SIZE_MIN).default(menuConfigDefault.button_size),
  })
  .default(menuConfigDefault);
export type MenuConfig = z.infer<typeof menuConfigSchema>;

/**
 * Event viewer configuration section (clip, snapshot).
 */
const viewerConfigDefault = {
  auto_play: 'all' as const,
  auto_pause: 'all' as const,
  auto_mute: 'all' as const,
  auto_unmute: 'never' as const,
  lazy_load: true,
  draggable: true,
  transition_effect: 'slide' as const,
  controls: {
    next_previous: {
      size: 48,
      style: 'thumbnails' as const,
    },
    thumbnails: {
      size: 100,
      show_details: true,
      show_favorite_control: true,
      show_timeline_control: true,
      mode: 'left' as const,
    },
    title: {
      mode: 'popup-bottom-right' as const,
      duration_seconds: 2,
    },
  },
};
const viewerNextPreviousControlConfigSchema = nextPreviousControlConfigSchema.extend({
  style: z
    .enum(['none', 'thumbnails', 'chevrons'])
    .default(viewerConfigDefault.controls.next_previous.style),
  size: nextPreviousControlConfigSchema.shape.size.default(
    viewerConfigDefault.controls.next_previous.size,
  ),
});
export type ViewerNextPreviousControlConfig = z.infer<
  typeof viewerNextPreviousControlConfigSchema
>;

const viewerConfigSchema = z
  .object({
    auto_play: z
      .enum(MEDIA_ACTION_POSITIVE_CONDITIONS)
      .default(viewerConfigDefault.auto_play),
    auto_pause: z
      .enum(MEDIA_ACTION_NEGATIVE_CONDITIONS)
      .default(viewerConfigDefault.auto_pause),
    auto_mute: z
      .enum(MEDIA_ACTION_NEGATIVE_CONDITIONS)
      .default(viewerConfigDefault.auto_mute),
    auto_unmute: z
      .enum(MEDIA_ACTION_POSITIVE_CONDITIONS)
      .default(viewerConfigDefault.auto_unmute),
    lazy_load: z.boolean().default(viewerConfigDefault.lazy_load),
    draggable: z.boolean().default(viewerConfigDefault.draggable),
    transition_effect: transitionEffectConfigSchema.default(
      viewerConfigDefault.transition_effect,
    ),
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
            show_details: thumbnailsControlSchema.shape.show_details.default(
              viewerConfigDefault.controls.thumbnails.show_details,
            ),
            show_favorite_control: thumbnailsControlSchema.shape.show_favorite_control.default(
              viewerConfigDefault.controls.thumbnails.show_favorite_control,
            ),
            show_timeline_control: thumbnailsControlSchema.shape.show_timeline_control.default(
              viewerConfigDefault.controls.thumbnails.show_timeline_control,
            ),
          })
          .default(viewerConfigDefault.controls.thumbnails),
        title: titleControlConfigSchema
          .extend({
            mode: titleControlConfigSchema.shape.mode.default(
              viewerConfigDefault.controls.title.mode,
            ),
            duration_seconds: titleControlConfigSchema.shape.duration_seconds.default(
              viewerConfigDefault.controls.title.duration_seconds,
            ),
          })
          .default(viewerConfigDefault.controls.title),
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
  controls: {
    thumbnails: {
      size: 100,
      show_details: false,
      show_favorite_control: true,
      show_timeline_control: true,
    },
  },
};

const galleryConfigSchema = z
  .object({
    controls: z
      .object({
        thumbnails: thumbnailsControlSchema
          // Gallery shows thumbnails "centrally" so no need for the mode.
          .omit({ mode: true })
          .extend({
            size: thumbnailsControlSchema.shape.size.default(
              galleryConfigDefault.controls.thumbnails.size,
            ),
            show_details: thumbnailsControlSchema.shape.show_details.default(
              galleryConfigDefault.controls.thumbnails.show_details,
            ),
            show_favorite_control: thumbnailsControlSchema.shape.show_favorite_control.default(
              galleryConfigDefault.controls.thumbnails.show_favorite_control,
            ),
            show_timeline_control: thumbnailsControlSchema.shape.show_timeline_control.default(
              galleryConfigDefault.controls.thumbnails.show_timeline_control,
            ),
          })
          .default(galleryConfigDefault.controls.thumbnails),
      })
      .default(galleryConfigDefault.controls),
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
 * Timeline configuration section.
 */
const timelineConfigDefault = {
  clustering_threshold: 3,
  media: 'all' as const,
  window_seconds: 60 * 60,
  show_recordings: true,
  controls: {
    thumbnails: {
      mode: 'left' as const,
      size: 100,
      show_details: true,
      show_favorite_control: true,
      show_timeline_control: true,
    },
  },
};
const timelineConfigSchema = z
  .object({
    clustering_threshold: z
      .number()
      .optional()
      .default(timelineConfigDefault.clustering_threshold),
    media: z
      .enum(['all', 'clips', 'snapshots'])
      .optional()
      .default(timelineConfigDefault.media),
    window_seconds: z
      .number()
      .min(1 * 60)
      .max(24 * 60 * 60)
      .optional()
      .default(timelineConfigDefault.window_seconds),
    show_recordings: z
      .boolean()
      .optional()
      .default(timelineConfigDefault.show_recordings),
    controls: z
      .object({
        thumbnails: thumbnailsControlSchema
          .extend({
            mode: thumbnailsControlSchema.shape.mode.default(
              timelineConfigDefault.controls.thumbnails.mode,
            ),
            size: thumbnailsControlSchema.shape.size.default(
              timelineConfigDefault.controls.thumbnails.size,
            ),
            show_details: thumbnailsControlSchema.shape.show_details.default(
              timelineConfigDefault.controls.thumbnails.show_details,
            ),
            show_favorite_control: thumbnailsControlSchema.shape.show_favorite_control.default(
              timelineConfigDefault.controls.thumbnails.show_favorite_control,
            ),
            show_timeline_control: thumbnailsControlSchema.shape.show_timeline_control.default(
              timelineConfigDefault.controls.thumbnails.show_timeline_control,
            ),
          })
          .default(timelineConfigDefault.controls.thumbnails),
      })
      .default(timelineConfigDefault.controls),
  })
  .default(timelineConfigDefault);
export type TimelineConfig = z.infer<typeof timelineConfigSchema>;

/**
 * Configuration overrides
 */
// Strip all defaults from the override schemas, to ensure values are only what
// the user has specified.
const overrideConfigurationSchema = z.object({
  live: deepRemoveDefaults(liveOverridableConfigSchema).optional(),
  menu: deepRemoveDefaults(menuConfigSchema).optional(),
  image: deepRemoveDefaults(imageConfigSchema).optional(),
  view: deepRemoveDefaults(viewConfigSchema).optional(),
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
  media_viewer: viewerConfigSchema,
  event_gallery: galleryConfigSchema,
  image: imageConfigSchema,
  elements: pictureElementsSchema,
  dimensions: dimensionsConfigSchema,
  timeline: timelineConfigSchema,

  // Configuration overrides.
  overrides: overridesSchema,

  // Support for card_mod (https://github.com/thomasloven/lovelace-card-mod).
  card_mod: z.unknown(),

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
  media_viewer: viewerConfigDefault,
  event_gallery: galleryConfigDefault,
  image: imageConfigDefault,
  timeline: timelineConfigDefault,
};

const menuButtonSchema = z.discriminatedUnion('type', [
  menuIconSchema,
  menuStateIconSchema,
  menuSubmenuSchema,
  menuSubmenuSelectSchema,
]);
export type MenuButton = z.infer<typeof menuButtonSchema>;
export interface ExtendedHomeAssistant extends HomeAssistant {
  hassUrl(path?): string;
  themes: Themes & {
    darkMode?: boolean;
  };
}

export interface BrowseMediaQueryParameters {
  // ========================================
  // Parameters used to construct media query
  // ========================================
  mediaType?: 'clips' | 'snapshots';
  clientId: string;
  cameraName: string;
  label?: string;
  zone?: string;
  before?: number;
  after?: number;
  unlimited?: boolean;

  // ========================================
  // Parameters used to differentiate results
  // ========================================
  // Optional title to be used for separating results when merging multiple
  // sets of results. See `mergeFrigateBrowseMediaSources()` .
  title?: string;

  // Optional camera-id to which this query is associated. May be used to map
  // results to a particular camera within the card.
  cameraID?: string;
}

export interface BrowseRecordingQueryParameters {
  clientId: string;
  cameraName: string;
  year: number;
  month: number;
  day: number;
  hour: number;
}

export interface BrowseMediaNeighbors {
  previous: FrigateBrowseMediaSource | null;
  previousIndex: number | null;

  next: FrigateBrowseMediaSource | null;
  nextIndex: number | null;
}

export interface MediaShowInfo {
  width: number;
  height: number;
}

export const MESSAGE_TYPE_PRIORITIES = {
  info: 10,
  error: 20,
  connection: 30,
  diagnostics: 40,
}

export type MessageType = 'info' | 'error' | 'connection' | 'diagnostics';

export interface Message {
  message: string;
  type: MessageType,
  icon?: string;
  context?: unknown;
  dotdotdot?: boolean;
}

export interface StateParameters {
  entity?: string;
  icon?: string;
  title?: string | null;
  state_color?: boolean;
  style?: StyleInfo;
  data_domain?: string;
  data_state?: string;
}

export interface FrigateCardMediaPlayer {
  play(): void;
  pause(): void;
  mute(): void;
  unmute(): void;
  seek(seconds: number): void;
}

export interface CardHelpers {
  createCardElement(config: LovelaceCardConfig): Promise<{
    constructor: {
      getConfigElement(): HTMLElement;
    };
  }>;
}

/**
 * Home Assistant API types.
 */

export const MEDIA_CLASS_PLAYLIST = 'playlist' as const;
export const MEDIA_CLASS_VIDEO = 'video' as const;
export const MEDIA_TYPE_PLAYLIST = 'playlist' as const;
export const MEDIA_TYPE_IMAGE = 'image' as const;
export const MEDIA_TYPE_VIDEO = 'video' as const;

// Recursive type, cannot use type interference:
// See: https://github.com/colinhacks/zod#recursive-types
//
// Server side data-type defined here: https://github.com/home-assistant/core/blob/dev/homeassistant/components/media_player/browse_media.py#L46
interface BrowseMediaSource {
  title: string;
  media_class: string;
  media_content_type: string;
  media_content_id: string;
  can_play: boolean;
  can_expand: boolean;
  children_media_class?: string | null;
  thumbnail: string | null;
  children?: BrowseMediaSource[] | null;
}

export interface FrigateEvent {
  camera: string;
  end_time?: number;
  false_positive: boolean;
  has_clip: boolean;
  has_snapshot: boolean;
  id: string;
  label: string;
  start_time: number;
  top_score: number;
  zones: string[];
  retain_indefinitely?: boolean;
  signed_thumbnail_url?: string;
}

export interface FrigateRecording {
  camera: string;
  start_time: number;
  end_time: number;
  events: number;

  // Specifies the point at which this recording should be played, the
  // seek_time is the date of the desired play point, and seek_seconds is the
  // number of seconds to seek to reach that point.
  seek_time?: number;
  seek_seconds?: number;
}

export interface FrigateBrowseMediaSource extends BrowseMediaSource {
  children?: FrigateBrowseMediaSource[] | null;
  frigate?: {
    event?: FrigateEvent;
    recording?: FrigateRecording;
  };
}

export const frigateBrowseMediaSourceSchema: z.ZodSchema<BrowseMediaSource> = z.lazy(
  () =>
    z.object({
      title: z.string(),
      media_class: z.string(),
      media_content_type: z.string(),
      media_content_id: z.string(),
      can_play: z.boolean(),
      can_expand: z.boolean(),
      children_media_class: z.string().nullable().optional(),
      thumbnail: z.string().nullable(),
      children: z.array(frigateBrowseMediaSourceSchema).nullable().optional(),
      frigate: z
        .object({
          event: z.object({
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
            signed_thumbnail_url: z.string().optional(),
          }),
        })
        .optional(),
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
  config_entry_id: z.string().nullable(),
  disabled_by: z.string().nullable(),
  entity_id: z.string(),
  platform: z.string(),
});
export type Entity = z.infer<typeof entitySchema>;

export const extendedEntitySchema = entitySchema.extend({
  // Extended entity results.
  unique_id: z.string().optional(),
});
export type ExtendedEntity = z.infer<typeof extendedEntitySchema>;

export const entityListSchema = entitySchema.array();
export type EntityList = z.infer<typeof entityListSchema>;
