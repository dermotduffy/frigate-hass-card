export const CARD_VERSION = '4.0.0-rc.1' as const;

export const CAMERA_BIRDSEYE = 'birdseye' as const;
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
export const CONF_CAMERAS_ARRAY_WEBRTC_CARD_ENTITY =
  `${CONF_CAMERAS}.#.webrtc_card.entity` as const;
export const CONF_CAMERAS_ARRAY_WEBRTC_CARD_URL =
  `${CONF_CAMERAS}.#.webrtc_card.url` as const;
export const CONF_CAMERAS_ARRAY_LIVE_PROVIDER =
  `${CONF_CAMERAS}.#.live_provider` as const;
export const CONF_CAMERAS_ARRAY_DEPENDENCIES_CAMERAS =
  `${CONF_CAMERAS}.#.dependencies.cameras` as const;
  export const CONF_CAMERAS_ARRAY_DEPENDENCIES_ALL_CAMERAS =
  `${CONF_CAMERAS}.#.dependencies.all_cameras` as const;
export const CONF_CAMERAS_ARRAY_TRIGGERS_MOTION =
  `${CONF_CAMERAS}.#.triggers.motion` as const;
export const CONF_CAMERAS_ARRAY_TRIGGERS_OCCUPANCY =
  `${CONF_CAMERAS}.#.triggers.occupancy` as const;
export const CONF_CAMERAS_ARRAY_TRIGGERS_ENTITIES =
  `${CONF_CAMERAS}.#.triggers.entities` as const;

export const CONF_VIEW = 'view' as const;
export const CONF_VIEW_CAMERA_SELECT = `${CONF_VIEW}.camera_select` as const;
export const CONF_VIEW_DARK_MODE = `${CONF_VIEW}.dark_mode` as const;
export const CONF_VIEW_DEFAULT = `${CONF_VIEW}.default` as const;
export const CONF_VIEW_TIMEOUT_SECONDS = `${CONF_VIEW}.timeout_seconds` as const;
export const CONF_VIEW_UPDATE_CYCLE_CAMERA = `${CONF_VIEW}.update_cycle_camera` as const;
export const CONF_VIEW_UPDATE_FORCE = `${CONF_VIEW}.update_force` as const;
export const CONF_VIEW_UPDATE_ENTITIES = `${CONF_VIEW}.update_entities` as const;
export const CONF_VIEW_UPDATE_SECONDS = `${CONF_VIEW}.update_seconds` as const;
export const CONF_VIEW_SCAN = `${CONF_VIEW}.scan` as const;
export const CONF_VIEW_SCAN_ENABLED = `${CONF_VIEW_SCAN}.enabled` as const;
export const CONF_VIEW_SCAN_SHOW_TRIGGER_STATUS =
  `${CONF_VIEW_SCAN}.show_trigger_status` as const;
export const CONF_VIEW_SCAN_UNTRIGGER_RESET =
  `${CONF_VIEW_SCAN}.untrigger_reset` as const;
export const CONF_VIEW_SCAN_UNTRIGGER_SECONDS =
  `${CONF_VIEW_SCAN}.untrigger_seconds` as const;

export const CONF_EVENT_GALLERY = 'event_gallery' as const;
export const CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_EVENT_GALLERY}.controls.thumbnails.show_details` as const;
export const CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SHOW_CONTROLS =
  `${CONF_EVENT_GALLERY}.controls.thumbnails.show_controls` as const;
export const CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SIZE =
  `${CONF_EVENT_GALLERY}.controls.thumbnails.size` as const;

export const CONF_MEDIA_VIEWER = 'media_viewer' as const;
export const CONF_MEDIA_VIEWER_AUTO_PLAY = `${CONF_MEDIA_VIEWER}.auto_play` as const;
export const CONF_MEDIA_VIEWER_AUTO_PAUSE = `${CONF_MEDIA_VIEWER}.auto_pause` as const;
export const CONF_MEDIA_VIEWER_AUTO_MUTE = `${CONF_MEDIA_VIEWER}.auto_mute` as const;
export const CONF_MEDIA_VIEWER_AUTO_UNMUTE = `${CONF_MEDIA_VIEWER}.auto_unmute` as const;
export const CONF_MEDIA_VIEWER_DRAGGABLE = `${CONF_MEDIA_VIEWER}.draggable` as const;
export const CONF_MEDIA_VIEWER_LAZY_LOAD = `${CONF_MEDIA_VIEWER}.lazy_load` as const;
export const CONF_MEDIA_VIEWER_TRANSITION_EFFECT =
  `${CONF_MEDIA_VIEWER}.transition_effect` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE =
  `${CONF_MEDIA_VIEWER}.controls.next_previous.style` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_SIZE =
  `${CONF_MEDIA_VIEWER}.controls.next_previous.size` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_MODE =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.mode` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.show_details` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_CONTROLS =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.show_controls` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SIZE =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.size` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TITLE_MODE =
  `${CONF_MEDIA_VIEWER}.controls.title.mode` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TITLE_DURATION_SECONDS =
  `${CONF_MEDIA_VIEWER}.controls.title.duration_seconds` as const;

export const CONF_LIVE = 'live' as const;
export const CONF_LIVE_AUTO_PLAY = `${CONF_LIVE}.auto_play` as const;
export const CONF_LIVE_AUTO_PAUSE = `${CONF_LIVE}.auto_pause` as const;
export const CONF_LIVE_AUTO_MUTE = `${CONF_LIVE}.auto_mute` as const;
export const CONF_LIVE_AUTO_UNMUTE = `${CONF_LIVE}.auto_unmute` as const;
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
export const CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_LIVE}.controls.thumbnails.show_details` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_CONTROLS =
  `${CONF_LIVE}.controls.thumbnails.show_controls` as const;
export const CONF_LIVE_CONTROLS_TITLE_MODE = `${CONF_LIVE}.controls.title.mode` as const;
export const CONF_LIVE_CONTROLS_TITLE_DURATION_SECONDS =
  `${CONF_LIVE}.controls.title.duration_seconds` as const;
export const CONF_LIVE_DRAGGABLE = `${CONF_LIVE}.draggable` as const;
export const CONF_LIVE_JSMPEG = `${CONF_LIVE}.jsmpeg` as const;
export const CONF_LIVE_LAZY_LOAD = `${CONF_LIVE}.lazy_load` as const;
export const CONF_LIVE_LAZY_UNLOAD = `${CONF_LIVE}.lazy_unload` as const;
export const CONF_LIVE_PRELOAD = `${CONF_LIVE}.preload` as const;
export const CONF_LIVE_TRANSITION_EFFECT = `${CONF_LIVE}.transition_effect` as const;
export const CONF_LIVE_WEBRTC_CARD = `${CONF_LIVE}.webrtc_card` as const;

export const CONF_IMAGE = 'image' as const;
export const CONF_IMAGE_MODE = `${CONF_IMAGE}.mode` as const;
export const CONF_IMAGE_REFRESH_SECONDS = `${CONF_IMAGE}.refresh_seconds` as const;
export const CONF_IMAGE_URL = `${CONF_IMAGE}.url` as const;

export const CONF_TIMELINE = 'timeline' as const;
export const CONF_TIMELINE_WINDOW_SECONDS = `${CONF_TIMELINE}.window_seconds` as const;
export const CONF_TIMELINE_CLUSTERING_THRESHOLD =
  `${CONF_TIMELINE}.clustering_threshold` as const;
export const CONF_TIMELINE_MEDIA = `${CONF_TIMELINE}.media` as const;
export const CONF_TIMELINE_SHOW_RECORDINGS = `${CONF_TIMELINE}.show_recordings` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_MODE =
  `${CONF_TIMELINE}.controls.thumbnails.mode` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_SIZE =
  `${CONF_TIMELINE}.controls.thumbnails.size` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_TIMELINE}.controls.thumbnails.show_details` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_CONTROLS =
  `${CONF_TIMELINE}.controls.thumbnails.show_controls` as const;

export const CONF_MENU = 'menu' as const;
export const CONF_MENU_ALIGNMENT = `${CONF_MENU}.alignment` as const;
export const CONF_MENU_POSITION = `${CONF_MENU}.position` as const;
export const CONF_MENU_STYLE = `${CONF_MENU}.style` as const;
export const CONF_MENU_BUTTON_SIZE = `${CONF_MENU}.button_size` as const;
export const CONF_MENU_BUTTONS = `${CONF_MENU}.buttons` as const;

export const CONF_MENU_BUTTONS_CAMERAS = `${CONF_MENU}.buttons.cameras` as const;
export const CONF_MENU_BUTTONS_CLIPS = `${CONF_MENU}.buttons.clips` as const;
export const CONF_MENU_BUTTONS_DOWNLOAD = `${CONF_MENU}.buttons.download` as const;
export const CONF_MENU_BUTTONS_FRIGATE = `${CONF_MENU}.buttons.frigate` as const;
export const CONF_MENU_BUTTONS_FRIGATE_UI = `${CONF_MENU}.buttons.frigate_ui` as const;
export const CONF_MENU_BUTTONS_FULLSCREEN = `${CONF_MENU}.buttons.fullscreen` as const;
export const CONF_MENU_BUTTONS_IMAGE = `${CONF_MENU}.buttons.image` as const;
export const CONF_MENU_BUTTONS_LIVE = `${CONF_MENU}.buttons.live` as const;
export const CONF_MENU_BUTTONS_SNAPSHOTS = `${CONF_MENU}.buttons.snapshots` as const;

export const CONF_DIMENSIONS = 'dimensions' as const;
export const CONF_DIMENSIONS_ASPECT_RATIO = `${CONF_DIMENSIONS}.aspect_ratio` as const;
export const CONF_DIMENSIONS_ASPECT_RATIO_MODE =
  `${CONF_DIMENSIONS}.aspect_ratio_mode` as const;

export const CONF_OVERRIDES = 'overrides' as const;

// Taken from https://github.dev/home-assistant/frontend/blob/b5861869e39290fd2e15737e89571dfc543b3ad3/src/data/media-player.ts#L93
export const MEDIA_PLAYER_SUPPORT_BROWSE_MEDIA = 131072;
