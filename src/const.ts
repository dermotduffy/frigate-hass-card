export const REPO_URL = 'https://github.com/dermotduffy/frigate-hass-card' as const;
export const TROUBLESHOOTING_URL = `${REPO_URL}#troubleshooting` as const;

export const CONF_CAMERAS = 'cameras' as const;
export const CONF_CAMERAS_ARRAY_CAMERA_ENTITY =
  `${CONF_CAMERAS}.#.camera_entity` as const;
export const CONF_CAMERAS_ARRAY_FRIGATE_CAMERA_NAME =
  `${CONF_CAMERAS}.#.frigate.camera_name` as const;
export const CONF_CAMERAS_ARRAY_FRIGATE_CLIENT_ID =
  `${CONF_CAMERAS}.#.frigate.client_id` as const;
export const CONF_CAMERAS_ARRAY_FRIGATE_LABELS =
  `${CONF_CAMERAS}.#.frigate.labels` as const;
export const CONF_CAMERAS_ARRAY_FRIGATE_URL = `${CONF_CAMERAS}.#.frigate.url` as const;
export const CONF_CAMERAS_ARRAY_FRIGATE_ZONES =
  `${CONF_CAMERAS}.#.frigate.zones` as const;
export const CONF_CAMERAS_ARRAY_GO2RTC_MODES = `${CONF_CAMERAS}.#.go2rtc.modes` as const;
export const CONF_CAMERAS_ARRAY_GO2RTC_STREAM =
  `${CONF_CAMERAS}.#.go2rtc.stream` as const;
export const CONF_CAMERAS_ARRAY_HIDE = `${CONF_CAMERAS}.#.hide` as const;
export const CONF_CAMERAS_ARRAY_ICON = `${CONF_CAMERAS}.#.icon` as const;
export const CONF_CAMERAS_ARRAY_ID = `${CONF_CAMERAS}.#.id` as const;
export const CONF_CAMERAS_ARRAY_IMAGE_REFRESH_SECONDS =
  `${CONF_CAMERAS}.#.image.refresh_seconds` as const;
export const CONF_CAMERAS_ARRAY_IMAGE_URL = `${CONF_CAMERAS}.#.image.url` as const;
export const CONF_CAMERAS_ARRAY_MOTIONEYE_IMAGES_DIRECTORY_PATTERN =
  `${CONF_CAMERAS}.#.motioneye.images.directory_pattern` as const;
export const CONF_CAMERAS_ARRAY_MOTIONEYE_IMAGES_FILE_PATTERN =
  `${CONF_CAMERAS}.#.motioneye.images.file_pattern` as const;
export const CONF_CAMERAS_ARRAY_MOTIONEYE_MOVIES_DIRECTORY_PATTERN =
  `${CONF_CAMERAS}.#.motioneye.movies.directory_pattern` as const;
export const CONF_CAMERAS_ARRAY_MOTIONEYE_MOVIES_FILE_PATTERN =
  `${CONF_CAMERAS}.#.motioneye.movies.file_pattern` as const;
export const CONF_CAMERAS_ARRAY_MOTIONEYE_URL =
  `${CONF_CAMERAS}.#.motioneye.url` as const;
export const CONF_CAMERAS_ARRAY_TITLE = `${CONF_CAMERAS}.#.title` as const;
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

const CONF_CAMERAS_GLOBAL = 'cameras_global' as const;
export const CONF_CAMERAS_GLOBAL_IMAGE = `${CONF_CAMERAS_GLOBAL}.image` as const;
export const CONF_CAMERAS_GLOBAL_JSMPEG = `${CONF_CAMERAS_GLOBAL}.jsmpeg` as const;
export const CONF_CAMERAS_GLOBAL_WEBRTC_CARD =
  `${CONF_CAMERAS_GLOBAL}.webrtc_card` as const;
export const CONF_CAMERAS_GLOBAL_TRIGGERS_OCCUPANCY =
  `${CONF_CAMERAS_GLOBAL}.triggers.occupancy` as const;
export const CONF_CAMERAS_GLOBAL_IMAGE_REFRESH_SECONDS =
  `${CONF_CAMERAS_GLOBAL}.image.refresh_seconds` as const;

export const CONF_ELEMENTS = 'elements' as const;

const CONF_VIEW = 'view' as const;
export const CONF_VIEW_CAMERA_SELECT = `${CONF_VIEW}.camera_select` as const;
export const CONF_VIEW_DARK_MODE = `${CONF_VIEW}.dark_mode` as const;
export const CONF_VIEW_DEFAULT = `${CONF_VIEW}.default` as const;
export const CONF_VIEW_TIMEOUT_SECONDS = `${CONF_VIEW}.timeout_seconds` as const;
export const CONF_VIEW_UPDATE_CYCLE_CAMERA = `${CONF_VIEW}.update_cycle_camera` as const;
export const CONF_VIEW_UPDATE_FORCE = `${CONF_VIEW}.update_force` as const;
export const CONF_VIEW_UPDATE_SECONDS = `${CONF_VIEW}.update_seconds` as const;
export const CONF_VIEW_SCAN = `${CONF_VIEW}.scan` as const;
export const CONF_VIEW_SCAN_ENABLED = `${CONF_VIEW_SCAN}.enabled` as const;
export const CONF_VIEW_SCAN_SHOW_TRIGGER_STATUS =
  `${CONF_VIEW_SCAN}.show_trigger_status` as const;
export const CONF_VIEW_SCAN_UNTRIGGER_RESET =
  `${CONF_VIEW_SCAN}.untrigger_reset` as const;
export const CONF_VIEW_SCAN_UNTRIGGER_SECONDS =
  `${CONF_VIEW_SCAN}.untrigger_seconds` as const;

export const CONF_MEDIA_GALLERY = 'media_gallery' as const;
export const CONF_MEDIA_GALLERY_CONTROLS_FILTER_MODE =
  `${CONF_MEDIA_GALLERY}.controls.filter.mode` as const;
export const CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_MEDIA_GALLERY}.controls.thumbnails.show_details` as const;
export const CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL =
  `${CONF_MEDIA_GALLERY}.controls.thumbnails.show_download_control` as const;
export const CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL =
  `${CONF_MEDIA_GALLERY}.controls.thumbnails.show_favorite_control` as const;
export const CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL =
  `${CONF_MEDIA_GALLERY}.controls.thumbnails.show_timeline_control` as const;
export const CONF_MEDIA_GALLERY_CONTROLS_THUMBNAILS_SIZE =
  `${CONF_MEDIA_GALLERY}.controls.thumbnails.size` as const;

export const CONF_MEDIA_VIEWER = 'media_viewer' as const;
export const CONF_MEDIA_VIEWER_AUTO_PLAY = `${CONF_MEDIA_VIEWER}.auto_play` as const;
export const CONF_MEDIA_VIEWER_AUTO_PAUSE = `${CONF_MEDIA_VIEWER}.auto_pause` as const;
export const CONF_MEDIA_VIEWER_AUTO_MUTE = `${CONF_MEDIA_VIEWER}.auto_mute` as const;
export const CONF_MEDIA_VIEWER_AUTO_UNMUTE = `${CONF_MEDIA_VIEWER}.auto_unmute` as const;
export const CONF_MEDIA_VIEWER_DRAGGABLE = `${CONF_MEDIA_VIEWER}.draggable` as const;
export const CONF_MEDIA_VIEWER_LAZY_LOAD = `${CONF_MEDIA_VIEWER}.lazy_load` as const;
export const CONF_MEDIA_VIEWER_SNAPSHOT_CLICK_PLAYS_CLIP =
  `${CONF_MEDIA_VIEWER}.snapshot_click_plays_clip` as const;
export const CONF_MEDIA_VIEWER_TRANSITION_EFFECT =
  `${CONF_MEDIA_VIEWER}.transition_effect` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_BUILTIN =
  `${CONF_MEDIA_VIEWER}.controls.builtin` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE =
  `${CONF_MEDIA_VIEWER}.controls.next_previous.style` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_SIZE =
  `${CONF_MEDIA_VIEWER}.controls.next_previous.size` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_MODE =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.mode` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.show_details` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.show_download_control` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.show_favorite_control` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.show_timeline_control` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SIZE =
  `${CONF_MEDIA_VIEWER}.controls.thumbnails.size` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_CLUSTERING_THRESHOLD =
  `${CONF_MEDIA_VIEWER}.controls.timeline.clustering_threshold` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_MEDIA =
  `${CONF_MEDIA_VIEWER}.controls.timeline.media` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_MODE =
  `${CONF_MEDIA_VIEWER}.controls.timeline.mode` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_SHOW_RECORDINGS =
  `${CONF_MEDIA_VIEWER}.controls.timeline.show_recordings` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_STYLE =
  `${CONF_MEDIA_VIEWER}.controls.timeline.style` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_WINDOW_SECONDS =
  `${CONF_MEDIA_VIEWER}.controls.timeline.window_seconds` as const;
export const CONF_MEDIA_VIEWER_ZOOMABLE = `${CONF_MEDIA_VIEWER}.zoomable` as const;

export const CONF_MEDIA_VIEWER_CONTROLS_TITLE_MODE =
  `${CONF_MEDIA_VIEWER}.controls.title.mode` as const;
export const CONF_MEDIA_VIEWER_CONTROLS_TITLE_DURATION_SECONDS =
  `${CONF_MEDIA_VIEWER}.controls.title.duration_seconds` as const;
export const CONF_MEDIA_VIEWER_LAYOUT_FIT = `${CONF_MEDIA_VIEWER}.layout.fit` as const;
export const CONF_MEDIA_VIEWER_LAYOUT_POSITION_X =
  `${CONF_MEDIA_VIEWER}.layout.position.x` as const;
export const CONF_MEDIA_VIEWER_LAYOUT_POSITION_Y =
  `${CONF_MEDIA_VIEWER}.layout.position.y` as const;

const CONF_LIVE = 'live' as const;
export const CONF_LIVE_AUTO_PLAY = `${CONF_LIVE}.auto_play` as const;
export const CONF_LIVE_AUTO_PAUSE = `${CONF_LIVE}.auto_pause` as const;
export const CONF_LIVE_AUTO_MUTE = `${CONF_LIVE}.auto_mute` as const;
export const CONF_LIVE_AUTO_UNMUTE = `${CONF_LIVE}.auto_unmute` as const;
export const CONF_LIVE_CONTROLS_BUILTIN = `${CONF_LIVE}.controls.builtin` as const;
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
export const CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL =
  `${CONF_LIVE}.controls.thumbnails.show_download_control` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL =
  `${CONF_LIVE}.controls.thumbnails.show_favorite_control` as const;
export const CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL =
  `${CONF_LIVE}.controls.thumbnails.show_timeline_control` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_CLUSTERING_THRESHOLD =
  `${CONF_LIVE}.controls.timeline.clustering_threshold` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_MEDIA =
  `${CONF_LIVE}.controls.timeline.media` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_MODE =
  `${CONF_LIVE}.controls.timeline.mode` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_SHOW_RECORDINGS =
  `${CONF_LIVE}.controls.timeline.show_recordings` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_STYLE =
  `${CONF_LIVE}.controls.timeline.style` as const;
export const CONF_LIVE_CONTROLS_TIMELINE_WINDOW_SECONDS =
  `${CONF_LIVE}.controls.timeline.window_seconds` as const;
export const CONF_LIVE_CONTROLS_TITLE_MODE = `${CONF_LIVE}.controls.title.mode` as const;
export const CONF_LIVE_CONTROLS_TITLE_DURATION_SECONDS =
  `${CONF_LIVE}.controls.title.duration_seconds` as const;
export const CONF_LIVE_LAYOUT_FIT = `${CONF_LIVE}.layout.fit` as const;
export const CONF_LIVE_LAYOUT_POSITION_X = `${CONF_LIVE}.layout.position.x` as const;
export const CONF_LIVE_LAYOUT_POSITION_Y = `${CONF_LIVE}.layout.position.y` as const;
export const CONF_LIVE_DRAGGABLE = `${CONF_LIVE}.draggable` as const;
export const CONF_LIVE_LAZY_LOAD = `${CONF_LIVE}.lazy_load` as const;
export const CONF_LIVE_LAZY_UNLOAD = `${CONF_LIVE}.lazy_unload` as const;
export const CONF_LIVE_PRELOAD = `${CONF_LIVE}.preload` as const;
export const CONF_LIVE_TRANSITION_EFFECT = `${CONF_LIVE}.transition_effect` as const;
export const CONF_LIVE_SHOW_IMAGE_DURING_LOAD =
  `${CONF_LIVE}.show_image_during_load` as const;
export const CONF_LIVE_MICROPHONE_DISCONNECT_SECONDS =
  `${CONF_LIVE}.microphone.disconnect_seconds` as const;
export const CONF_LIVE_MICROPHONE_ALWAYS_CONNECTED =
  `${CONF_LIVE}.microphone.always_connected` as const;
export const CONF_LIVE_ZOOMABLE = `${CONF_LIVE}.zoomable` as const;

const CONF_IMAGE = 'image' as const;
export const CONF_IMAGE_LAYOUT_FIT = `${CONF_IMAGE}.layout.fit` as const;
export const CONF_IMAGE_LAYOUT_POSITION_X = `${CONF_IMAGE}.layout.position.x` as const;
export const CONF_IMAGE_LAYOUT_POSITION_Y = `${CONF_IMAGE}.layout.position.y` as const;
export const CONF_IMAGE_MODE = `${CONF_IMAGE}.mode` as const;
export const CONF_IMAGE_REFRESH_SECONDS = `${CONF_IMAGE}.refresh_seconds` as const;
export const CONF_IMAGE_URL = `${CONF_IMAGE}.url` as const;
export const CONF_IMAGE_ZOOMABLE = `${CONF_IMAGE}.zoomable` as const;

const CONF_TIMELINE = 'timeline' as const;
export const CONF_TIMELINE_WINDOW_SECONDS = `${CONF_TIMELINE}.window_seconds` as const;
export const CONF_TIMELINE_CLUSTERING_THRESHOLD =
  `${CONF_TIMELINE}.clustering_threshold` as const;
export const CONF_TIMELINE_MEDIA = `${CONF_TIMELINE}.media` as const;
export const CONF_TIMELINE_SHOW_RECORDINGS = `${CONF_TIMELINE}.show_recordings` as const;
export const CONF_TIMELINE_STYLE = `${CONF_TIMELINE}.style` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_MODE =
  `${CONF_TIMELINE}.controls.thumbnails.mode` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_SIZE =
  `${CONF_TIMELINE}.controls.thumbnails.size` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_DETAILS =
  `${CONF_TIMELINE}.controls.thumbnails.show_details` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_DOWNLOAD_CONTROL =
  `${CONF_TIMELINE}.controls.thumbnails.show_download_control` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL =
  `${CONF_TIMELINE}.controls.thumbnails.show_favorite_control` as const;
export const CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL =
  `${CONF_TIMELINE}.controls.thumbnails.show_timeline_control` as const;

const CONF_MENU = 'menu' as const;
export const CONF_MENU_ALIGNMENT = `${CONF_MENU}.alignment` as const;
export const CONF_MENU_POSITION = `${CONF_MENU}.position` as const;
export const CONF_MENU_STYLE = `${CONF_MENU}.style` as const;
export const CONF_MENU_BUTTON_SIZE = `${CONF_MENU}.button_size` as const;
export const CONF_MENU_BUTTONS = `${CONF_MENU}.buttons` as const;

export const CONF_MENU_BUTTONS_CAMERAS = `${CONF_MENU}.buttons.cameras` as const;
export const CONF_MENU_BUTTONS_CLIPS = `${CONF_MENU}.buttons.clips` as const;
export const CONF_MENU_BUTTONS_DOWNLOAD = `${CONF_MENU}.buttons.download` as const;
export const CONF_MENU_BUTTONS_FRIGATE = `${CONF_MENU}.buttons.frigate` as const;
export const CONF_MENU_BUTTONS_CAMERA_UI = `${CONF_MENU}.buttons.camera_ui` as const;
export const CONF_MENU_BUTTONS_FULLSCREEN = `${CONF_MENU}.buttons.fullscreen` as const;
export const CONF_MENU_BUTTONS_IMAGE = `${CONF_MENU}.buttons.image` as const;
export const CONF_MENU_BUTTONS_LIVE = `${CONF_MENU}.buttons.live` as const;
export const CONF_MENU_BUTTONS_MEDIA_PLAYER =
  `${CONF_MENU}.buttons.media_player` as const;
export const CONF_MENU_BUTTONS_SNAPSHOTS = `${CONF_MENU}.buttons.snapshots` as const;
export const CONF_MENU_BUTTONS_TIMELINE = `${CONF_MENU}.buttons.timeline` as const;

const CONF_DIMENSIONS = 'dimensions' as const;
export const CONF_DIMENSIONS_ASPECT_RATIO = `${CONF_DIMENSIONS}.aspect_ratio` as const;
export const CONF_DIMENSIONS_ASPECT_RATIO_MODE =
  `${CONF_DIMENSIONS}.aspect_ratio_mode` as const;
export const CONF_DIMENSIONS_MAX_HEIGHT = `${CONF_DIMENSIONS}.max_height` as const;
export const CONF_DIMENSIONS_MIN_HEIGHT = `${CONF_DIMENSIONS}.min_height` as const;

export const CONF_OVERRIDES = 'overrides' as const;

const CONF_PERFORMANCE = 'performance' as const;
export const CONF_PERFORMANCE_FEATURES_ANIMATED_PROGRESS_INDICATOR = `${CONF_PERFORMANCE}.features.animated_progress_indicator`;
export const CONF_PERFORMANCE_FEATURES_MEDIA_CHUNK_SIZE = `${CONF_PERFORMANCE}.features.media_chunk_size`;
export const CONF_PERFORMANCE_PROFILE = `${CONF_PERFORMANCE}.profile`;
export const CONF_PERFORMANCE_STYLE_BOX_SHADOW = `${CONF_PERFORMANCE}.style.box_shadow`;
export const CONF_PERFORMANCE_STYLE_BORDER_RADIUS = `${CONF_PERFORMANCE}.style.border_radius`;

// Taken from https://github.dev/home-assistant/frontend/blob/b5861869e39290fd2e15737e89571dfc543b3ad3/src/data/media-player.ts#L93
export const MEDIA_PLAYER_SUPPORT_BROWSE_MEDIA = 131072;

// The number of media items to fetch at a time (for clips/snapshot views, and
// gallery chunks). Smaller values will cause more frequent smaller fetches, but
// improved rendering performance.
export const MEDIA_CHUNK_SIZE_DEFAULT = 50;
export const MEDIA_CHUNK_SIZE_MAX = 1000;

export const FRIGATE_BUTTON_MENU_ICON = 'frigate';