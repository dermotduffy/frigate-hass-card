export const CARD_VERSION = '2.1.0' as const;
export const REPO_URL = 'https://github.com/dermotduffy/frigate-hass-card' as const;
export const TROUBLESHOOTING_URL = `${REPO_URL}#troubleshooting` as const;

export const CONF_CAMERAS = 'cameras' as const;
export const CONF_CAMERAS_ARRAY_CAMERA_ENTITY =
  `${CONF_CAMERAS}.#.camera_entity` as const;
export const CONF_CAMERAS_ARRAY_CAMERA_NAME = `${CONF_CAMERAS}.#.camera_name` as const;
export const CONF_CAMERAS_ARRAY_CLIENT_ID = `${CONF_CAMERAS}.#.client_id` as const;
export const CONF_CAMERAS_ARRAY_LABEL = `${CONF_CAMERAS}.#.label` as const;
export const CONF_CAMERAS_ARRAY_URL = `${CONF_CAMERAS}.#.frigate_url` as const;
export const CONF_CAMERAS_ARRAY_ZONE = `${CONF_CAMERAS}.#.zone` as const;
export const CONF_CAMERAS_ARRAY_ID = `${CONF_CAMERAS}.#.id` as const;
export const CONF_CAMERAS_ARRAY_TITLE = `${CONF_CAMERAS}.#.title` as const;
export const CONF_CAMERAS_ARRAY_ICON = `${CONF_CAMERAS}.#.icon` as const;
export const CONF_CAMERAS_ARRAY_WEBRTC_ENTITY =
  `${CONF_CAMERAS}.#.webrtc.entity` as const;
export const CONF_CAMERAS_ARRAY_WEBRTC_URL = `${CONF_CAMERAS}.#.webrtc.url` as const;
export const CONF_CAMERAS_ARRAY_LIVE_PROVIDER = `${CONF_CAMERAS}.#.live_provider` as const;

export const CONF_VIEW = 'view' as const;
export const CONF_VIEW_DEFAULT = `${CONF_VIEW}.default` as const;
export const CONF_VIEW_TIMEOUT = `${CONF_VIEW}.timeout` as const;
export const CONF_VIEW_UPDATE_FORCE = `${CONF_VIEW}.update_force` as const;
export const CONF_VIEW_UPDATE_ENTITIES = `${CONF_VIEW}.update_entities` as const;

export const CONF_EVENT_VIEWER = 'event_viewer' as const;
export const CONF_EVENT_VIEWER_AUTOPLAY_CLIP =
  `${CONF_EVENT_VIEWER}.autoplay_clip` as const;
export const CONF_EVENT_VIEWER_DRAGGABLE = `${CONF_EVENT_VIEWER}.draggable` as const;
export const CONF_EVENT_VIEWER_LAZY_LOAD = `${CONF_EVENT_VIEWER}.lazy_load` as const;
export const CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE =
  `${CONF_EVENT_VIEWER}.controls.next_previous.style` as const;
export const CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_SIZE =
  `${CONF_EVENT_VIEWER}.controls.next_previous.size` as const;
export const CONF_EVENT_VIEWER_CONTROLS_THUMBNAILS_MODE =
  `${CONF_EVENT_VIEWER}.controls.thumbnails.mode` as const;
export const CONF_EVENT_VIEWER_CONTROLS_THUMBNAILS_SIZE =
  `${CONF_EVENT_VIEWER}.controls.thumbnails.size` as const;

export const CONF_LIVE = 'live' as const;
export const CONF_LIVE_CONTROLS_NEXT_PREVIOUS_STYLE =
  `${CONF_LIVE}.controls.next_previous.style` as const;
export const CONF_LIVE_CONTROLS_NEXT_PREVIOUS_SIZE =
  `${CONF_LIVE}.controls.next_previous.size` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_MEDIA =
  `${CONF_LIVE}.controls.thumbnails.media` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_MODE =
  `${CONF_LIVE}.controls.thumbnails.mode` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_SIZE =
  `${CONF_LIVE}.controls.thumbnails.size` as const;
export const CONF_LIVE_DRAGGABLE = `${CONF_LIVE}.draggable` as const;
export const CONF_LIVE_JSMPEG = `${CONF_LIVE}.jsmpeg` as const;
export const CONF_LIVE_LAZY_LOAD = `${CONF_LIVE}.lazy_load` as const;
export const CONF_LIVE_PRELOAD = `${CONF_LIVE}.preload` as const;
export const CONF_LIVE_WEBRTC = `${CONF_LIVE}.webrtc` as const;
export const CONF_LIVE_WEBRTC_ENTITY = `${CONF_LIVE_WEBRTC}.entity` as const;
export const CONF_LIVE_WEBRTC_URL = `${CONF_LIVE_WEBRTC}.url` as const;

export const CONF_IMAGE = 'image' as const;
export const CONF_IMAGE_SRC = `${CONF_IMAGE}.src` as const;

export const CONF_MENU = 'menu' as const;
export const CONF_MENU_BUTTONS_FRIGATE = `${CONF_MENU}.buttons.frigate` as const;
export const CONF_MENU_BUTTONS_FRIGATE_UI = `${CONF_MENU}.buttons.frigate_ui` as const;
export const CONF_MENU_BUTTONS_FRIGATE_FULLSCREEN =
  `${CONF_MENU}.buttons.fullscreen` as const;
export const CONF_MENU_BUTTONS_FRIGATE_DOWNLOAD =
  `${CONF_MENU}.buttons.download` as const;
export const CONF_MENU_BUTTONS_LIVE = `${CONF_MENU}.buttons.live` as const;
export const CONF_MENU_BUTTONS_CLIPS = `${CONF_MENU}.buttons.clips` as const;
export const CONF_MENU_BUTTONS_SNAPSHOTS = `${CONF_MENU}.buttons.snapshots` as const;
export const CONF_MENU_BUTTONS_IMAGE = `${CONF_MENU}.buttons.image` as const;
export const CONF_MENU_BUTTON_SIZE = `${CONF_MENU}.button_size` as const;
export const CONF_MENU_MODE = `${CONF_MENU}.mode` as const;

export const CONF_DIMENSIONS = 'dimensions' as const;
export const CONF_DIMENSIONS_ASPECT_RATIO = `${CONF_DIMENSIONS}.aspect_ratio` as const;
export const CONF_DIMENSIONS_ASPECT_RATIO_MODE =
  `${CONF_DIMENSIONS}.aspect_ratio_mode` as const;

export const CONF_OVERRIDES = 'overrides' as const;