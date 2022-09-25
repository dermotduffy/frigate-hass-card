import { fireEvent, HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import {
  copyConfig,
  deleteConfigValue,
  getArrayConfigPath,
  getConfigValue,
  isConfigUpgradeable,
  setConfigValue,
  upgradeConfig,
} from './config-mgmt.js';
import {
  CONF_CAMERAS,
  CONF_CAMERAS_ARRAY_CAMERA_ENTITY,
  CONF_CAMERAS_ARRAY_DEPENDENCIES_ALL_CAMERAS,
  CONF_CAMERAS_ARRAY_DEPENDENCIES_CAMERAS,
  CONF_CAMERAS_ARRAY_FRIGATE_CAMERA_NAME,
  CONF_CAMERAS_ARRAY_FRIGATE_CLIENT_ID,
  CONF_CAMERAS_ARRAY_FRIGATE_LABEL,
  CONF_CAMERAS_ARRAY_FRIGATE_URL,
  CONF_CAMERAS_ARRAY_FRIGATE_ZONE,
  CONF_CAMERAS_ARRAY_ICON,
  CONF_CAMERAS_ARRAY_ID,
  CONF_CAMERAS_ARRAY_LIVE_PROVIDER,
  CONF_CAMERAS_ARRAY_TITLE,
  CONF_CAMERAS_ARRAY_TRIGGERS_ENTITIES,
  CONF_CAMERAS_ARRAY_TRIGGERS_MOTION,
  CONF_CAMERAS_ARRAY_TRIGGERS_OCCUPANCY,
  CONF_CAMERAS_ARRAY_WEBRTC_CARD_ENTITY,
  CONF_CAMERAS_ARRAY_WEBRTC_CARD_URL,
  CONF_DIMENSIONS_ASPECT_RATIO,
  CONF_DIMENSIONS_ASPECT_RATIO_MODE,
  CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SHOW_DETAILS,
  CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
  CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
  CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SIZE,
  CONF_IMAGE_LAYOUT_FIT,
  CONF_IMAGE_LAYOUT_POSITION_X,
  CONF_IMAGE_LAYOUT_POSITION_Y,
  CONF_IMAGE_MODE,
  CONF_IMAGE_REFRESH_SECONDS,
  CONF_IMAGE_URL,
  CONF_LIVE_AUTO_MUTE,
  CONF_LIVE_AUTO_PAUSE,
  CONF_LIVE_AUTO_PLAY,
  CONF_LIVE_AUTO_UNMUTE,
  CONF_LIVE_CONTROLS_NEXT_PREVIOUS_SIZE,
  CONF_LIVE_CONTROLS_NEXT_PREVIOUS_STYLE,
  CONF_LIVE_CONTROLS_THUMBNAILS_MEDIA,
  CONF_LIVE_CONTROLS_THUMBNAILS_MODE,
  CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_DETAILS,
  CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
  CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
  CONF_LIVE_CONTROLS_THUMBNAILS_SIZE,
  CONF_LIVE_CONTROLS_TIMELINE_CLUSTERING_THRESHOLD,
  CONF_LIVE_CONTROLS_TIMELINE_MEDIA,
  CONF_LIVE_CONTROLS_TIMELINE_MODE,
  CONF_LIVE_CONTROLS_TIMELINE_SHOW_RECORDINGS,
  CONF_LIVE_CONTROLS_TIMELINE_WINDOW_SECONDS,
  CONF_LIVE_CONTROLS_TITLE_DURATION_SECONDS,
  CONF_LIVE_CONTROLS_TITLE_MODE,
  CONF_LIVE_DRAGGABLE,
  CONF_LIVE_LAYOUT_FIT,
  CONF_LIVE_LAYOUT_POSITION_X,
  CONF_LIVE_LAYOUT_POSITION_Y,
  CONF_LIVE_LAZY_LOAD,
  CONF_LIVE_LAZY_UNLOAD,
  CONF_LIVE_PRELOAD,
  CONF_LIVE_SHOW_IMAGE_DURING_LOAD,
  CONF_LIVE_TRANSITION_EFFECT,
  CONF_MEDIA_VIEWER_AUTO_MUTE,
  CONF_MEDIA_VIEWER_AUTO_PAUSE,
  CONF_MEDIA_VIEWER_AUTO_PLAY,
  CONF_MEDIA_VIEWER_AUTO_UNMUTE,
  CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_SIZE,
  CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE,
  CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_MODE,
  CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_DETAILS,
  CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
  CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
  CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SIZE,
  CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_CLUSTERING_THRESHOLD,
  CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_MEDIA,
  CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_MODE,
  CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_SHOW_RECORDINGS,
  CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_WINDOW_SECONDS,
  CONF_MEDIA_VIEWER_CONTROLS_TITLE_DURATION_SECONDS,
  CONF_MEDIA_VIEWER_CONTROLS_TITLE_MODE,
  CONF_MEDIA_VIEWER_DRAGGABLE,
  CONF_MEDIA_VIEWER_LAYOUT_FIT,
  CONF_MEDIA_VIEWER_LAYOUT_POSITION_X,
  CONF_MEDIA_VIEWER_LAYOUT_POSITION_Y,
  CONF_MEDIA_VIEWER_LAZY_LOAD,
  CONF_MEDIA_VIEWER_TRANSITION_EFFECT,
  CONF_MENU_ALIGNMENT,
  CONF_MENU_BUTTONS,
  CONF_MENU_BUTTON_SIZE,
  CONF_MENU_POSITION,
  CONF_MENU_STYLE,
  CONF_TIMELINE_CLUSTERING_THRESHOLD,
  CONF_TIMELINE_CONTROLS_THUMBNAILS_MODE,
  CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_DETAILS,
  CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
  CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
  CONF_TIMELINE_CONTROLS_THUMBNAILS_SIZE,
  CONF_TIMELINE_MEDIA,
  CONF_TIMELINE_SHOW_RECORDINGS,
  CONF_TIMELINE_WINDOW_SECONDS,
  CONF_VIEW_CAMERA_SELECT,
  CONF_VIEW_DARK_MODE,
  CONF_VIEW_DEFAULT,
  CONF_VIEW_SCAN,
  CONF_VIEW_SCAN_ENABLED,
  CONF_VIEW_SCAN_SHOW_TRIGGER_STATUS,
  CONF_VIEW_SCAN_UNTRIGGER_RESET,
  CONF_VIEW_SCAN_UNTRIGGER_SECONDS,
  CONF_VIEW_TIMEOUT_SECONDS,
  CONF_VIEW_UPDATE_CYCLE_CAMERA,
  CONF_VIEW_UPDATE_FORCE,
  CONF_VIEW_UPDATE_SECONDS,
} from './const.js';
import { localize } from './localize/localize.js';
import frigate_card_editor_style from './scss/editor.scss';
import {
  BUTTON_SIZE_MIN,
  frigateCardConfigDefaults,
  FRIGATE_MENU_PRIORITY_MAX,
  RawFrigateCardConfig,
  RawFrigateCardConfigArray,
  THUMBNAIL_WIDTH_MAX,
  THUMBNAIL_WIDTH_MIN,
} from './types.js';
import { arrayMove } from './utils/basic.js';
import { getCameraID, getCameraTitle } from './utils/camera.js';
import { FRIGATE_ICON_SVG_PATH } from './utils/frigate.js';
import { getEntitiesFromHASS, sideLoadHomeAssistantElements } from './utils/ha';

const MENU_BUTTONS = 'buttons';
const MENU_CAMERAS = 'cameras';
const MENU_CAMERAS_DEPENDENCIES = 'cameras.dependencies';
const MENU_CAMERAS_FRIGATE = 'cameras.frigate';
const MENU_CAMERAS_TRIGGERS = 'cameras.triggers';
const MENU_CAMERAS_WEBRTC = 'cameras.webrtc';
const MENU_EVENT_GALLERY_CONTROLS = 'event_gallery.controls';
const MENU_IMAGE_LAYOUT = 'image.layout';
const MENU_LIVE_CONTROLS = 'live.controls';
const MENU_LIVE_CONTROLS_TIMELINE = 'live.controls.timeline';
const MENU_LIVE_LAYOUT = 'live.layout';
const MENU_MEDIA_VIEWER_CONTROLS = 'media_viewer.controls';
const MENU_MEDIA_VIEWER_CONTROLS_TIMELINE = 'media_viewer.controls.timeline';
const MENU_MEDIA_VIEWER_LAYOUT = 'media_viewer.layout';
const MENU_TIMELINE_CONTROLS = 'timeline.controls';
const MENU_OPTIONS = 'options';
const MENU_VIEW_SCAN = 'scan';

interface EditorOptionsSet {
  icon: string;
  name: string;
  secondary: string;
}
interface EditorOptions {
  [setName: string]: EditorOptionsSet;
}

interface EditorSelectOption {
  value: string;
  label: string;
}

interface EditorMenuTarget {
  domain: string;
  key: string | number;
}

const options: EditorOptions = {
  cameras: {
    icon: 'video',
    name: localize('editor.cameras'),
    secondary: localize('editor.cameras_secondary'),
  },
  view: {
    icon: 'eye',
    name: localize('editor.view'),
    secondary: localize('editor.view_secondary'),
  },
  menu: {
    icon: 'menu',
    name: localize('editor.menu'),
    secondary: localize('editor.menu_secondary'),
  },
  live: {
    icon: 'cctv',
    name: localize('editor.live'),
    secondary: localize('editor.live_secondary'),
  },
  media_viewer: {
    icon: 'filmstrip',
    name: localize('editor.media_viewer'),
    secondary: localize('editor.media_viewer_secondary'),
  },
  event_gallery: {
    icon: 'grid',
    name: localize('editor.event_gallery'),
    secondary: localize('editor.event_gallery_secondary'),
  },
  image: {
    icon: 'image',
    name: localize('editor.image'),
    secondary: localize('editor.image_secondary'),
  },
  timeline: {
    icon: 'chart-gantt',
    name: localize('editor.timeline'),
    secondary: localize('editor.timeline_secondary'),
  },
  dimensions: {
    icon: 'aspect-ratio',
    name: localize('editor.dimensions'),
    secondary: localize('editor.dimensions_secondary'),
  },
  overrides: {
    icon: 'file-replace',
    name: localize('editor.overrides'),
    secondary: localize('editor.overrides_secondary'),
  },
};

@customElement('frigate-card-editor')
export class FrigateCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() protected _config?: RawFrigateCardConfig;
  protected _initialized = false;
  protected _configUpgradeable = false;

  @state()
  protected _expandedMenus: Record<string, string | number> = {};

  protected _viewModes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'live', label: localize('config.view.views.live') },
    { value: 'clips', label: localize('config.view.views.clips') },
    { value: 'snapshots', label: localize('config.view.views.snapshots') },
    { value: 'clip', label: localize('config.view.views.clip') },
    { value: 'snapshot', label: localize('config.view.views.snapshot') },
    { value: 'image', label: localize('config.view.views.image') },
    { value: 'timeline', label: localize('config.view.views.timeline') },
  ];

  protected _cameraSelectViewModes: EditorSelectOption[] = [
    ...this._viewModes,
    { value: 'current', label: localize('config.view.views.current') },
  ];

  protected _menuStyles: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'none', label: localize('config.menu.styles.none') },
    { value: 'hidden', label: localize('config.menu.styles.hidden') },
    { value: 'overlay', label: localize('config.menu.styles.overlay') },
    { value: 'hover', label: localize('config.menu.styles.hover') },
    { value: 'outside', label: localize('config.menu.styles.outside') },
  ];

  protected _menuPositions: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'left', label: localize('config.menu.positions.left') },
    { value: 'right', label: localize('config.menu.positions.right') },
    { value: 'top', label: localize('config.menu.positions.top') },
    { value: 'bottom', label: localize('config.menu.positions.bottom') },
  ];

  protected _menuAlignments: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'left', label: localize('config.menu.alignments.left') },
    { value: 'right', label: localize('config.menu.alignments.right') },
    { value: 'top', label: localize('config.menu.alignments.top') },
    { value: 'bottom', label: localize('config.menu.alignments.bottom') },
  ];

  protected _eventViewerNextPreviousControlStyles: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'thumbnails',
      label: localize('config.media_viewer.controls.next_previous.styles.thumbnails'),
    },
    {
      value: 'chevrons',
      label: localize('config.media_viewer.controls.next_previous.styles.chevrons'),
    },
    {
      value: 'none',
      label: localize('config.media_viewer.controls.next_previous.styles.none'),
    },
  ];

  protected _liveNextPreviousControlStyles: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'chevrons',
      label: localize('config.live.controls.next_previous.styles.chevrons'),
    },
    {
      value: 'icons',
      label: localize('config.live.controls.next_previous.styles.icons'),
    },
    { value: 'none', label: localize('config.live.controls.next_previous.styles.none') },
  ];

  protected _aspectRatioModes: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'dynamic',
      label: localize('config.dimensions.aspect_ratio_modes.dynamic'),
    },
    { value: 'static', label: localize('config.dimensions.aspect_ratio_modes.static') },
    {
      value: 'unconstrained',
      label: localize('config.dimensions.aspect_ratio_modes.unconstrained'),
    },
  ];

  protected _thumbnailModes: EditorSelectOption[] = [
    { value: '', label: '' },
    {
      value: 'none',
      label: localize('config.media_viewer.controls.thumbnails.modes.none'),
    },
    {
      value: 'above',
      label: localize('config.media_viewer.controls.thumbnails.modes.above'),
    },
    {
      value: 'below',
      label: localize('config.media_viewer.controls.thumbnails.modes.below'),
    },
    {
      value: 'left',
      label: localize('config.media_viewer.controls.thumbnails.modes.left'),
    },
    {
      value: 'right',
      label: localize('config.media_viewer.controls.thumbnails.modes.right'),
    },
  ];

  protected _thumbnailMedias: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'clips', label: localize('config.live.controls.thumbnails.medias.clips') },
    {
      value: 'snapshots',
      label: localize('config.live.controls.thumbnails.medias.snapshots'),
    },
  ];

  protected _titleModes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'none', label: localize('config.media_viewer.controls.title.modes.none') },
    {
      value: 'popup-top-left',
      label: localize('config.media_viewer.controls.title.modes.popup-top-left'),
    },
    {
      value: 'popup-top-right',
      label: localize('config.media_viewer.controls.title.modes.popup-top-right'),
    },
    {
      value: 'popup-bottom-left',
      label: localize('config.media_viewer.controls.title.modes.popup-bottom-left'),
    },
    {
      value: 'popup-bottom-right',
      label: localize('config.media_viewer.controls.title.modes.popup-bottom-right'),
    },
  ];

  protected _transitionEffects: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'none', label: localize('config.media_viewer.transition_effects.none') },
    { value: 'slide', label: localize('config.media_viewer.transition_effects.slide') },
  ];

  protected _imageModes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'camera', label: localize('config.image.modes.camera') },
    { value: 'screensaver', label: localize('config.image.modes.screensaver') },
    { value: 'url', label: localize('config.image.modes.url') },
  ];

  protected _timelineMediaTypes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'all', label: localize('config.timeline.medias.all') },
    { value: 'clips', label: localize('config.timeline.medias.clips') },
    { value: 'snapshots', label: localize('config.timeline.medias.snapshots') },
  ];

  protected _darkModes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'on', label: localize('config.view.dark_modes.on') },
    { value: 'off', label: localize('config.view.dark_modes.off') },
    { value: 'auto', label: localize('config.view.dark_modes.auto') },
  ];

  protected _mediaActionNegativeConditions: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'all', label: localize('config.common.media_action_conditions.all') },
    {
      value: 'unselected',
      label: localize('config.common.media_action_conditions.unselected'),
    },
    { value: 'hidden', label: localize('config.common.media_action_conditions.hidden') },
    { value: 'never', label: localize('config.common.media_action_conditions.never') },
  ];

  protected _mediaActionPositiveConditions: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'all', label: localize('config.common.media_action_conditions.all') },
    {
      value: 'selected',
      label: localize('config.common.media_action_conditions.selected'),
    },
    {
      value: 'visible',
      label: localize('config.common.media_action_conditions.visible'),
    },
    { value: 'never', label: localize('config.common.media_action_conditions.never') },
  ];

  protected _layoutFits: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'contain', label: localize('config.common.layout.fits.contain') },
    { value: 'cover', label: localize('config.common.layout.fits.cover') },
    { value: 'fill', label: localize('config.common.layout.fits.fill') },
  ];

  protected _miniTimelineModes: EditorSelectOption[] = [
    { value: '', label: '' },
    { value: 'none', label: localize('config.timeline.mini.modes.none') },
    { value: 'above', label: localize('config.timeline.mini.modes.above') },
    { value: 'below', label: localize('config.timeline.mini.modes.below') },
  ];

  public setConfig(config: RawFrigateCardConfig): void {
    // Note: This does not use Zod to parse the configuration, so it may be
    // partially or completely invalid. It's more useful to have a partially
    // valid configuration here, to allow the user to fix the broken parts. As
    // such, RawFrigateCardConfig is used as the type.
    this._config = config;
    this._configUpgradeable = isConfigUpgradeable(config);
  }

  /**
   * Called before each update.
   */
  protected willUpdate(): void {
    if (!this._initialized) {
      sideLoadHomeAssistantElements().then((success) => {
        if (success) {
          this._initialized = true;
        }
      });
    }
  }

  /**
   * Render an option set header
   * @param optionSetName The name of the EditorOptionsSet.
   * @returns A rendered template.
   */
  protected _renderOptionSetHeader(optionSetName: string): TemplateResult {
    const optionSet = options[optionSetName];

    return html`
      <div
        class="option option-${optionSetName}"
        @click=${this._toggleMenu}
        .domain=${'options'}
        .key=${optionSetName}
      >
        <div class="row">
          <ha-icon .icon=${`mdi:${optionSet.icon}`}></ha-icon>
          <div class="title">${optionSet.name}</div>
        </div>
        <div class="secondary">${optionSet.secondary}</div>
      </div>
    `;
  }

  /**
   * Get a localized help label for a given config path.
   * @param configPath The config path.
   * @returns A localized label.
   */
  protected _getLabel(configPath: string): string {
    // Strip out array indices from the path.
    const path = configPath
      .split('.')
      .filter((e) => !e.match(/^\[[0-9]+\]$/))
      .join('.');
    return localize(`config.${path}`);
  }

  /**
   * Render an entity selector.
   * @param configPath The configuration path to set/read.
   * @param domain Only entities from this domain will be shown.
   * @returns A rendered template.
   */
  protected _renderEntitySelector(
    configPath: string,
    domain: string,
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }

    return html`
      <ha-selector
        .hass=${this.hass}
        .selector=${{ entity: { domain: domain } }}
        .label=${this._getLabel(configPath)}
        .value=${getConfigValue(this._config, configPath, '')}
        .required=${false}
        @value-changed=${(ev) => this._valueChangedHandler(configPath, ev)}
      >
      </ha-selector>
    `;
  }

  /**
   * Render an option/"select" selector.
   * @param configPath The configuration path to set/read.
   * @param options The options to show in the selector.
   * @param params Option parameters to control the selector.
   * @returns A rendered template.
   */
  protected _renderOptionSelector(
    configPath: string,
    options: string[] | { value: string; label: string }[],
    params?: {
      multiple?: boolean;
      label?: string;
    },
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }

    return html`
      <ha-selector
        .hass=${this.hass}
        .selector=${{
          select: { mode: 'dropdown', multiple: !!params?.multiple, options: options },
        }}
        .label=${params?.label || this._getLabel(configPath)}
        .value=${getConfigValue(this._config, configPath, '')}
        .required=${false}
        @value-changed=${(ev) => this._valueChangedHandler(configPath, ev)}
      >
      </ha-selector>
    `;
  }

  /**
   * Render an icon selector.
   * @param configPath The configuration path to set/read.
   * @param params Optional parameters to control the selector.
   * @returns A rendered template.
   */
  protected _renderIconSelector(
    configPath: string,
    params?: {
      label?: string;
    },
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }

    return html`
      <ha-selector
        .hass=${this.hass}
        .selector=${{
          icon: {},
        }}
        .label=${params?.label || this._getLabel(configPath)}
        .value=${getConfigValue(this._config, configPath, '')}
        .required=${false}
        @value-changed=${(ev) => this._valueChangedHandler(configPath, ev)}
      >
      </ha-selector>
    `;
  }

  /**
   * Render a number slider.
   * @param configPath Configuration path of the variable.
   * @param params Optional parameters to control the selector.
   * @returns A rendered template.
   */
  protected _renderNumberInput(
    configPath: string,
    params?: {
      min?: number;
      max?: number;
      label?: string;
      default?: number;
    },
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }
    const value = getConfigValue(this._config, configPath);
    const mode = params?.max === undefined ? 'box' : 'slider';

    return html`
      <ha-selector
        .hass=${this.hass}
        .selector=${{ number: { min: params?.min || 0, max: params?.max, mode: mode } }}
        .label=${params?.label || this._getLabel(configPath)}
        .value=${value ?? params?.default}
        .required=${false}
        @value-changed=${(ev) => this._valueChangedHandler(configPath, ev)}
      >
      </ha-selector>
    `;
  }

  /**
   * Render a simple text info box.
   * @param info The string to display.
   * @returns A rendered template.
   */
  protected _renderInfo(info: string): TemplateResult {
    return html` <span class="info">${info}</span>`;
  }

  /**
   * Get an editor title for the camera.
   * @param cameraIndex The index of the camera in the cameras array.
   * @param cameraConfig The raw camera configuration object.
   * @returns A string title.
   */
  protected _getEditorCameraTitle(
    cameraIndex: number,
    cameraConfig: RawFrigateCardConfig,
  ): string {
    return (
      getCameraTitle(this.hass, cameraConfig) ||
      localize('editor.camera') + ' #' + cameraIndex
    );
  }

  protected _renderViewScanMenu(): TemplateResult {
    const submenuClasses = {
      submenu: true,
      selected: !!this._expandedMenus[MENU_VIEW_SCAN],
    };
    return html`
      <div class="${classMap(submenuClasses)}">
        <div
          class="submenu-header"
          @click=${this._toggleMenu}
          .domain=${MENU_VIEW_SCAN}
          .key=${true}
        >
          <ha-icon .icon=${'mdi:target-account'}></ha-icon>
          <span>${localize(`config.${CONF_VIEW_SCAN}.scan_mode`)}</span>
        </div>
        ${this._expandedMenus[MENU_VIEW_SCAN]
          ? html` <div class="values">
              ${this._renderSwitch(
                CONF_VIEW_SCAN_ENABLED,
                frigateCardConfigDefaults.view.scan.enabled,
                {
                  label: localize(`config.${CONF_VIEW_SCAN_ENABLED}`),
                },
              )}
              ${this._renderSwitch(
                CONF_VIEW_SCAN_SHOW_TRIGGER_STATUS,
                frigateCardConfigDefaults.view.scan.show_trigger_status,
                {
                  label: localize(`config.${CONF_VIEW_SCAN_SHOW_TRIGGER_STATUS}`),
                },
              )}
              ${this._renderSwitch(
                CONF_VIEW_SCAN_UNTRIGGER_RESET,
                frigateCardConfigDefaults.view.scan.untrigger_reset,
              )}
              ${this._renderNumberInput(CONF_VIEW_SCAN_UNTRIGGER_SECONDS, {
                default: frigateCardConfigDefaults.view.scan.untrigger_seconds,
              })}
            </div>`
          : ''}
      </div>
    `;
  }

  /**
   * Render an editor menu for the card menu buttons.
   * @param button The name of the button.
   * @returns A rendered template.
   */
  protected _renderMenuButton(button: string): TemplateResult {
    const menuButtonAlignments: EditorSelectOption[] = [
      { value: '', label: '' },
      { value: 'matching', label: localize('config.menu.buttons.alignments.matching') },
      { value: 'opposing', label: localize('config.menu.buttons.alignments.opposing') },
    ];
    const submenuClasses = {
      submenu: true,
      selected: this._expandedMenus[MENU_BUTTONS] === button,
    };

    return html`
      <div class="${classMap(submenuClasses)}">
        <div
          class="submenu-header"
          @click=${this._toggleMenu}
          .domain=${MENU_BUTTONS}
          .key=${button}
        >
          <ha-icon .icon=${'mdi:gesture-tap-button'}></ha-icon>
          <span
            >${localize('editor.button') +
            ': ' +
            localize(`config.${CONF_MENU_BUTTONS}.${button}`)}</span
          >
        </div>

        ${this._expandedMenus[MENU_BUTTONS] === button
          ? html` <div class="values">
              ${this._renderSwitch(
                `${CONF_MENU_BUTTONS}.${button}.enabled`,
                frigateCardConfigDefaults.menu.buttons[button]?.enabled ?? true,
                {
                  label: localize('config.menu.buttons.enabled'),
                },
              )}
              ${this._renderOptionSelector(
                `${CONF_MENU_BUTTONS}.${button}.alignment`,
                menuButtonAlignments,
                {
                  label: localize('config.menu.buttons.alignment'),
                },
              )}
              ${this._renderNumberInput(`${CONF_MENU_BUTTONS}.${button}.priority`, {
                max: FRIGATE_MENU_PRIORITY_MAX,
                default: frigateCardConfigDefaults.menu.buttons[button]?.priority,
                label: localize('config.menu.buttons.priority'),
              })}
              ${this._renderIconSelector(`${CONF_MENU_BUTTONS}.${button}.icon`, {
                label: localize('config.menu.buttons.icon'),
              })}
            </div>`
          : ''}
      </div>
    `;
  }

  /**
   * Put a given rendered template into a submenu.
   * @param domain The submenu domain.
   * @param key The submenu key.
   * @param icon The icon for the submenu.
   * @param labelPath The path to the label to localize.
   * @param template The template to put in the submenu.
   * @returns
   */
  protected _putInSubmenu(
    domain: string,
    key: unknown,
    labelPath: string,
    icon: {
      name?: string;
      path?: string;
    },
    template: TemplateResult,
  ): TemplateResult {
    const selected = this._expandedMenus[domain] === key;
    const submenuClasses = {
      submenu: true,
      selected: selected,
    };

    return html` <div class="${classMap(submenuClasses)}">
      <div
        class="submenu-header"
        @click=${this._toggleMenu}
        .domain=${domain}
        .key=${key}
      >
        ${icon.name
          ? html` <ha-icon .icon=${icon.name}></ha-icon> `
          : icon.path
          ? html` <ha-svg-icon .path="${icon.path}"></ha-svg-icon> `
          : ``}
        <span>${localize(labelPath)}</span>
      </div>
      ${selected ? html`<div class="values">${template}</div>` : ''}
    </div>`;
  }

  /**
   * Render a media layout section.
   * @param domain The submenu domain.
   * @param labelPath The path to the label.
   * @param configPathFit The path to the fit config.
   * @param configPathPositionX The path to the position.x config.
   * @param configPathPositionY The path to the position.y config.
   * @returns A rendered template.
   */
  protected _renderMediaLayout(
    domain: string,
    labelPath: string,
    configPathFit: string,
    configPathPositionX: string,
    configPathPositionY: string,
  ): TemplateResult | void {
    return this._putInSubmenu(
      domain,
      true,
      labelPath,
      { name: 'mdi:page-layout-body' },
      html`
        ${this._renderOptionSelector(configPathFit, this._layoutFits)}
        ${this._renderNumberInput(configPathPositionX, {
          min: 0,
          max: 100,
          label: localize('config.common.layout.position.x'),
        })}
        ${this._renderNumberInput(configPathPositionY, {
          min: 0,
          max: 100,
          label: localize('config.common.layout.position.y'),
        })}
      `,
    );
  }

  /**
   * Render the core timeline controls (mini or full timeline),
   * @param configPathWindowSeconds Timeline window config path.
   * @param configPathClusteringThreshold Clustering threshold config path.
   * @param configPathTimelineMedia Timeline media config path.
   * @param configPathShowRecordings Show recordings config path.
   * @param defaultShowRecordings Default value of show_recordings.
   * @returns A rendered template.
   */
  protected _renderTimelineCoreControls(
    configPathWindowSeconds: string,
    configPathClusteringThreshold: string,
    configPathTimelineMedia: string,
    configPathShowRecordings: string,
    defaultShowRecordings: boolean,
  ): TemplateResult {
    return html` ${this._renderNumberInput(configPathWindowSeconds, {
      label: localize(`config.${CONF_TIMELINE_WINDOW_SECONDS}`),
    })}
    ${this._renderNumberInput(configPathClusteringThreshold, {
      label: localize(`config.${CONF_TIMELINE_CLUSTERING_THRESHOLD}`),
    })}
    ${this._renderOptionSelector(configPathTimelineMedia, this._timelineMediaTypes, {
      label: localize(`config.${CONF_TIMELINE_MEDIA}`),
    })}
    ${this._renderSwitch(configPathShowRecordings, defaultShowRecordings, {
      label: localize(`config.${CONF_TIMELINE_SHOW_RECORDINGS}`),
    })}`;
  }

  /**
   * Render the mini timeline controls.
   * @param domain The submenu domain.
   * @param configPathWindowSeconds Timeline window config path.
   * @param configPathClusteringThreshold Clustering threshold config path.
   * @param configPathTimelineMedia Timeline media config path.
   * @param configPathShowRecordings Show recordings config path.
   * @returns A rendered template.
   */
  protected _renderMiniTimeline(
    domain: string,
    configPathMode: string,
    configPathWindowSeconds: string,
    configPathClusteringThreshold: string,
    configPathTimelineMedia: string,
    configPathShowRecordings: string,
  ): TemplateResult | void {
    return this._putInSubmenu(
      domain,
      true,
      'config.timeline.mini.options',
      { name: 'mdi:chart-gantt' },
      html` ${this._renderOptionSelector(configPathMode, this._miniTimelineModes, {
        label: localize('config.timeline.mini.mode'),
      })}
      ${this._renderTimelineCoreControls(
        configPathWindowSeconds,
        configPathClusteringThreshold,
        configPathTimelineMedia,
        configPathShowRecordings,
        frigateCardConfigDefaults.mini_timeline.show_recordings,
      )}`,
    );
  }

  /**
   * Render a camera section.
   * @param cameras The full array of cameras.
   * @param cameraIndex The index (in the array) to render.
   * @param addNewCamera Whether or not this is a section to add a new non-existent camera.
   * @returns A rendered template.
   */
  protected _renderCamera(
    cameras: RawFrigateCardConfigArray,
    cameraIndex: number,
    entities: string[],
    addNewCamera?: boolean,
  ): TemplateResult | void {
    const liveProviders: EditorSelectOption[] = [
      { value: '', label: '' },
      { value: 'auto', label: localize('config.cameras.live_providers.auto') },
      { value: 'ha', label: localize('config.cameras.live_providers.ha') },
      {
        value: 'frigate-jsmpeg',
        label: localize('config.cameras.live_providers.frigate-jsmpeg'),
      },
      {
        value: 'webrtc-card',
        label: localize('config.cameras.live_providers.webrtc-card'),
      },
    ];

    const dependentCameras: EditorSelectOption[] = [];
    cameras.forEach((camera, index) => {
      if (index !== cameraIndex) {
        dependentCameras.push({
          value: getCameraID(camera),
          label: this._getEditorCameraTitle(index, camera),
        });
      }
    });

    // Make a new config and update the editor with changes on it,
    const modifyConfig = (func: (config: RawFrigateCardConfig) => boolean): void => {
      if (this._config) {
        const newConfig = copyConfig(this._config);
        if (func(newConfig)) {
          this._updateConfig(newConfig);
        }
      }
    };

    const submenuClasses = {
      submenu: true,
      selected: this._expandedMenus[MENU_CAMERAS] === cameraIndex,
    };

    return html`
      <div class="${classMap(submenuClasses)}">
        <div
          class="submenu-header"
          @click=${this._toggleMenu}
          .domain=${MENU_CAMERAS}
          .key=${cameraIndex}
        >
          <ha-icon .icon=${addNewCamera ? 'mdi:video-plus' : 'mdi:video'}></ha-icon>
          <span>
            ${addNewCamera
              ? html` <span class="new-camera">
                  [${localize('editor.add_new_camera')}...]
                </span>`
              : html`<span
                  >${this._getEditorCameraTitle(
                    cameraIndex,
                    cameras[cameraIndex] || {},
                  )}</span
                >`}
          </span>
        </div>
        ${this._expandedMenus[MENU_CAMERAS] === cameraIndex
          ? html` <div class="values">
              <div class="controls">
                <ha-icon-button
                  class="button"
                  .label=${localize('editor.move_up')}
                  .disabled=${addNewCamera ||
                  !this._config ||
                  !Array.isArray(this._config.cameras) ||
                  cameraIndex <= 0}
                  @click=${() =>
                    !addNewCamera &&
                    modifyConfig((config: RawFrigateCardConfig): boolean => {
                      if (Array.isArray(config.cameras) && cameraIndex > 0) {
                        arrayMove(config.cameras, cameraIndex, cameraIndex - 1);
                        this._openMenu(MENU_CAMERAS, cameraIndex - 1);
                        return true;
                      }
                      return false;
                    })}
                >
                  <ha-icon icon="mdi:arrow-up"></ha-icon>
                </ha-icon-button>
                <ha-icon-button
                  class="button"
                  .label=${localize('editor.move_down')}
                  .disabled=${addNewCamera ||
                  !this._config ||
                  !Array.isArray(this._config.cameras) ||
                  cameraIndex >= this._config.cameras.length - 1}
                  @click=${() =>
                    !addNewCamera &&
                    modifyConfig((config: RawFrigateCardConfig): boolean => {
                      if (
                        Array.isArray(config.cameras) &&
                        cameraIndex < config.cameras.length - 1
                      ) {
                        arrayMove(config.cameras, cameraIndex, cameraIndex + 1);
                        this._openMenu(MENU_CAMERAS, cameraIndex + 1);
                        return true;
                      }
                      return false;
                    })}
                >
                  <ha-icon icon="mdi:arrow-down"></ha-icon>
                </ha-icon-button>
                <ha-icon-button
                  class="button"
                  .label=${localize('editor.delete')}
                  .disabled=${addNewCamera}
                  @click=${() => {
                    modifyConfig((config: RawFrigateCardConfig): boolean => {
                      if (Array.isArray(config.cameras)) {
                        config.cameras.splice(cameraIndex, 1);
                        this._closeMenu(MENU_CAMERAS);
                        return true;
                      }
                      return false;
                    });
                  }}
                >
                  <ha-icon icon="mdi:delete"></ha-icon>
                </ha-icon-button>
              </div>
              ${this._renderEntitySelector(
                getArrayConfigPath(CONF_CAMERAS_ARRAY_CAMERA_ENTITY, cameraIndex),
                'camera',
              )}
              ${this._renderOptionSelector(
                getArrayConfigPath(CONF_CAMERAS_ARRAY_LIVE_PROVIDER, cameraIndex),
                liveProviders,
              )}
              ${this._renderStringInput(
                getArrayConfigPath(CONF_CAMERAS_ARRAY_TITLE, cameraIndex),
              )}
              ${this._renderIconSelector(
                getArrayConfigPath(CONF_CAMERAS_ARRAY_ICON, cameraIndex),
                {
                  label: localize('config.cameras.icon'),
                },
              )}
              ${this._renderStringInput(
                getArrayConfigPath(CONF_CAMERAS_ARRAY_ID, cameraIndex),
              )}
              ${this._putInSubmenu(
                MENU_CAMERAS_FRIGATE,
                cameraIndex,
                'config.cameras.frigate.options',
                { path: FRIGATE_ICON_SVG_PATH },
                html`
                  ${this._renderStringInput(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_FRIGATE_CAMERA_NAME,
                      cameraIndex,
                    ),
                  )}
                  ${this._renderStringInput(
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_FRIGATE_URL, cameraIndex),
                  )}
                  ${this._renderStringInput(
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_FRIGATE_LABEL, cameraIndex),
                  )}
                  ${this._renderStringInput(
                    getArrayConfigPath(CONF_CAMERAS_ARRAY_FRIGATE_ZONE, cameraIndex),
                  )}
                  ${this._renderStringInput(
                    getArrayConfigPath(
                      CONF_CAMERAS_ARRAY_FRIGATE_CLIENT_ID,
                      cameraIndex,
                    ),
                  )}
                `,
              )}
              ${this._putInSubmenu(
                MENU_CAMERAS_DEPENDENCIES,
                cameraIndex,
                'config.cameras.dependencies.options',
                { name: 'mdi:graph' },
                html` ${this._renderSwitch(
                  getArrayConfigPath(
                    CONF_CAMERAS_ARRAY_DEPENDENCIES_ALL_CAMERAS,
                    cameraIndex,
                  ),
                  frigateCardConfigDefaults.cameras.dependencies.all_cameras,
                )}
                ${this._renderOptionSelector(
                  getArrayConfigPath(
                    CONF_CAMERAS_ARRAY_DEPENDENCIES_CAMERAS,
                    cameraIndex,
                  ),
                  dependentCameras,
                  {
                    multiple: true,
                  },
                )}`,
              )}
              ${this._putInSubmenu(
                MENU_CAMERAS_TRIGGERS,
                cameraIndex,
                'config.cameras.triggers.options',
                { name: 'mdi:magnify-scan' },
                html` ${this._renderSwitch(
                  getArrayConfigPath(CONF_CAMERAS_ARRAY_TRIGGERS_OCCUPANCY, cameraIndex),
                  frigateCardConfigDefaults.cameras.triggers.occupancy,
                )}
                ${this._renderSwitch(
                  getArrayConfigPath(CONF_CAMERAS_ARRAY_TRIGGERS_MOTION, cameraIndex),
                  frigateCardConfigDefaults.cameras.triggers.motion,
                )}
                ${this._renderOptionSelector(
                  getArrayConfigPath(CONF_CAMERAS_ARRAY_TRIGGERS_ENTITIES, cameraIndex),
                  entities,
                  {
                    multiple: true,
                  },
                )}`,
              )}
              ${this._putInSubmenu(
                MENU_CAMERAS_WEBRTC,
                cameraIndex,
                'config.cameras.webrtc_card.options',
                { name: 'mdi:webrtc' },
                html`${this._renderEntitySelector(
                  getArrayConfigPath(CONF_CAMERAS_ARRAY_WEBRTC_CARD_ENTITY, cameraIndex),
                  'camera',
                )}
                ${this._renderStringInput(
                  getArrayConfigPath(CONF_CAMERAS_ARRAY_WEBRTC_CARD_URL, cameraIndex),
                )}`,
              )}
            </div>`
          : ``}
      </div>
    `;
  }

  /**
   * Render a string input field.
   * @param configPath The configuration path to set/read.
   * @param type The allowable input
   * @returns A rendered template.
   */
  protected _renderStringInput(
    configPath: string,
    type?:
      | 'number'
      | 'text'
      | 'search'
      | 'tel'
      | 'url'
      | 'email'
      | 'password'
      | 'date'
      | 'month'
      | 'week'
      | 'time'
      | 'datetime-local'
      | 'color',
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }

    return html`
      <ha-selector
        .hass=${this.hass}
        .selector=${{ text: { type: type || 'text' } }}
        .label=${this._getLabel(configPath)}
        .value=${getConfigValue(this._config, configPath, '')}
        .required=${false}
        @value-changed=${(ev) => this._valueChangedHandler(configPath, ev)}
      >
      </ha-selector>
    `;
  }

  /**
   * Render a boolean selector.
   * @param configPath The configuration path to set/read.
   * @param valueDefault The default switch value if unset.
   * @param params Optional parameters to control the selector.
   * @returns A rendered template.
   */
  protected _renderSwitch(
    configPath: string,
    valueDefault: boolean,
    params?: {
      label?: string;
    },
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }

    return html`
      <ha-selector
        .hass=${this.hass}
        .selector=${{ boolean: {} }}
        .label=${params?.label || this._getLabel(configPath)}
        .value=${getConfigValue(this._config, configPath, valueDefault)}
        .required=${false}
        @value-changed=${(ev) => this._valueChangedHandler(configPath, ev)}
      >
      </ha-selector>
    `;
  }

  protected _updateConfig(config: RawFrigateCardConfig): void {
    this._config = config;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this._config) {
      return html``;
    }

    const defaults = frigateCardConfigDefaults;
    const entities = getEntitiesFromHASS(this.hass);
    const cameras = (getConfigValue(this._config, CONF_CAMERAS) ||
      []) as RawFrigateCardConfigArray;

    return html`
      ${this._configUpgradeable
        ? html` <div class="upgrade">
              <span>${localize('editor.upgrade_available')}</span>
              <span>
                <mwc-button
                  raised
                  label="${localize('editor.upgrade')}"
                  @click=${() => {
                    if (this._config) {
                      const upgradedConfig = copyConfig(this._config);
                      upgradeConfig(upgradedConfig);
                      this._updateConfig(upgradedConfig);
                    }
                  }}
                >
                </mwc-button>
              </span>
            </div>
            <br />`
        : html``}
      <div class="card-config">
        ${this._renderOptionSetHeader('cameras')}
        ${this._expandedMenus[MENU_OPTIONS] === 'cameras'
          ? html`
              ${cameras.map((_, index) => this._renderCamera(cameras, index, entities))}
              ${this._renderCamera(cameras, cameras.length, entities, true)}
            `
          : ''}
        ${this._renderOptionSetHeader('view')}
        ${this._expandedMenus[MENU_OPTIONS] === 'view'
          ? html`
              <div class="values">
                ${this._renderOptionSelector(CONF_VIEW_DEFAULT, this._viewModes)}
                ${this._renderOptionSelector(
                  CONF_VIEW_CAMERA_SELECT,
                  this._cameraSelectViewModes,
                )}
                ${this._renderOptionSelector(CONF_VIEW_DARK_MODE, this._darkModes)}
                ${this._renderNumberInput(CONF_VIEW_TIMEOUT_SECONDS)}
                ${this._renderNumberInput(CONF_VIEW_UPDATE_SECONDS)}
                ${this._renderSwitch(CONF_VIEW_UPDATE_FORCE, defaults.view.update_force)}
                ${this._renderSwitch(
                  CONF_VIEW_UPDATE_CYCLE_CAMERA,
                  defaults.view.update_cycle_camera,
                )}
                ${this._renderViewScanMenu()}
              </div>
            `
          : ''}
        ${this._renderOptionSetHeader('menu')}
        ${this._expandedMenus[MENU_OPTIONS] === 'menu'
          ? html`
              <div class="values">
                ${this._renderOptionSelector(CONF_MENU_STYLE, this._menuStyles)}
                ${this._renderOptionSelector(CONF_MENU_POSITION, this._menuPositions)}
                ${this._renderOptionSelector(CONF_MENU_ALIGNMENT, this._menuAlignments)}
                ${this._renderNumberInput(CONF_MENU_BUTTON_SIZE, {
                  min: BUTTON_SIZE_MIN,
                })}
              </div>
              ${this._renderMenuButton('frigate') /* */}
              ${this._renderMenuButton('cameras') /* */}
              ${this._renderMenuButton('live') /* */}
              ${this._renderMenuButton('clips') /* */}
              ${this._renderMenuButton('snapshots')}
              ${this._renderMenuButton('image') /* */}
              ${this._renderMenuButton('download')}
              ${this._renderMenuButton('frigate_ui')}
              ${this._renderMenuButton('fullscreen')}
              ${this._renderMenuButton('timeline')}
              ${this._renderMenuButton('media_player')}
            `
          : ''}
        ${this._renderOptionSetHeader('live')}
        ${this._expandedMenus[MENU_OPTIONS] === 'live'
          ? html`
              <div class="values">
                ${this._renderSwitch(CONF_LIVE_PRELOAD, defaults.live.preload)}
                ${this._renderSwitch(CONF_LIVE_DRAGGABLE, defaults.live.draggable)}
                ${this._renderSwitch(CONF_LIVE_LAZY_LOAD, defaults.live.lazy_load)}
                ${this._renderOptionSelector(
                  CONF_LIVE_LAZY_UNLOAD,
                  this._mediaActionNegativeConditions,
                )}
                ${this._renderOptionSelector(
                  CONF_LIVE_AUTO_PLAY,
                  this._mediaActionPositiveConditions,
                )}
                ${this._renderOptionSelector(
                  CONF_LIVE_AUTO_PAUSE,
                  this._mediaActionNegativeConditions,
                )}
                ${this._renderOptionSelector(
                  CONF_LIVE_AUTO_MUTE,
                  this._mediaActionNegativeConditions,
                )}
                ${this._renderOptionSelector(
                  CONF_LIVE_AUTO_UNMUTE,
                  this._mediaActionPositiveConditions,
                )}
                ${this._renderOptionSelector(
                  CONF_LIVE_TRANSITION_EFFECT,
                  this._transitionEffects,
                )}
                ${this._renderSwitch(
                  CONF_LIVE_SHOW_IMAGE_DURING_LOAD,
                  defaults.live.show_image_during_load,
                )}
                ${this._putInSubmenu(
                  MENU_LIVE_CONTROLS,
                  true,
                  'config.live.controls.options',
                  { name: 'mdi:gamepad' },
                  html`
                    ${this._renderOptionSelector(
                      CONF_LIVE_CONTROLS_NEXT_PREVIOUS_STYLE,
                      this._liveNextPreviousControlStyles,
                    )}
                    ${this._renderNumberInput(CONF_LIVE_CONTROLS_NEXT_PREVIOUS_SIZE, {
                      min: BUTTON_SIZE_MIN,
                    })}
                    ${this._renderOptionSelector(
                      CONF_LIVE_CONTROLS_THUMBNAILS_MODE,
                      this._thumbnailModes,
                    )}
                    ${this._renderOptionSelector(
                      CONF_LIVE_CONTROLS_THUMBNAILS_MEDIA,
                      this._thumbnailMedias,
                    )}
                    ${this._renderNumberInput(CONF_LIVE_CONTROLS_THUMBNAILS_SIZE, {
                      min: THUMBNAIL_WIDTH_MIN,
                      max: THUMBNAIL_WIDTH_MAX,
                    })}
                    ${this._renderOptionSelector(
                      CONF_LIVE_CONTROLS_TITLE_MODE,
                      this._titleModes,
                    )}
                    ${this._renderSwitch(
                      CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_DETAILS,
                      defaults.live.controls.thumbnails.show_details,
                    )}
                    ${this._renderSwitch(
                      CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
                      defaults.live.controls.thumbnails.show_favorite_control,
                    )}
                    ${this._renderSwitch(
                      CONF_LIVE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
                      defaults.live.controls.thumbnails.show_timeline_control,
                    )}
                    ${this._renderNumberInput(
                      CONF_LIVE_CONTROLS_TITLE_DURATION_SECONDS,
                      {
                        min: 0,
                        max: 60,
                      },
                    )}
                    ${this._renderMiniTimeline(
                      MENU_LIVE_CONTROLS_TIMELINE,
                      CONF_LIVE_CONTROLS_TIMELINE_MODE,
                      CONF_LIVE_CONTROLS_TIMELINE_WINDOW_SECONDS,
                      CONF_LIVE_CONTROLS_TIMELINE_CLUSTERING_THRESHOLD,
                      CONF_LIVE_CONTROLS_TIMELINE_MEDIA,
                      CONF_LIVE_CONTROLS_TIMELINE_SHOW_RECORDINGS,
                    )}
                  `,
                )}
                ${this._renderMediaLayout(
                  MENU_LIVE_LAYOUT,
                  'config.live.layout',
                  CONF_LIVE_LAYOUT_FIT,
                  CONF_LIVE_LAYOUT_POSITION_X,
                  CONF_LIVE_LAYOUT_POSITION_Y,
                )}
              </div>
            `
          : ''}
        ${this._renderOptionSetHeader('event_gallery')}
        ${this._expandedMenus[MENU_OPTIONS] === 'event_gallery'
          ? html` <div class="values">
              ${this._putInSubmenu(
                MENU_EVENT_GALLERY_CONTROLS,
                true,
                'config.event_gallery.controls.options',
                { name: 'mdi:gamepad' },
                html` ${this._renderNumberInput(
                  CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SIZE,
                  {
                    min: THUMBNAIL_WIDTH_MIN,
                    max: THUMBNAIL_WIDTH_MAX,
                  },
                )}
                ${this._renderSwitch(
                  CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SHOW_DETAILS,
                  defaults.media_viewer.controls.thumbnails.show_details,
                )}
                ${this._renderSwitch(
                  CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
                  defaults.media_viewer.controls.thumbnails.show_favorite_control,
                )}
                ${this._renderSwitch(
                  CONF_EVENT_GALLERY_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
                  defaults.media_viewer.controls.thumbnails.show_timeline_control,
                )}`,
              )}
            </div>`
          : ''}
        ${this._renderOptionSetHeader('media_viewer')}
        ${this._expandedMenus[MENU_OPTIONS] === 'media_viewer'
          ? html` <div class="values">
              ${this._renderOptionSelector(
                CONF_MEDIA_VIEWER_AUTO_PLAY,
                this._mediaActionPositiveConditions,
              )}
              ${this._renderOptionSelector(
                CONF_MEDIA_VIEWER_AUTO_PAUSE,
                this._mediaActionNegativeConditions,
              )}
              ${this._renderOptionSelector(
                CONF_MEDIA_VIEWER_AUTO_MUTE,
                this._mediaActionNegativeConditions,
              )}
              ${this._renderOptionSelector(
                CONF_MEDIA_VIEWER_AUTO_UNMUTE,
                this._mediaActionPositiveConditions,
              )}
              ${this._renderSwitch(
                CONF_MEDIA_VIEWER_DRAGGABLE,
                defaults.media_viewer.draggable,
              )}
              ${this._renderSwitch(
                CONF_MEDIA_VIEWER_LAZY_LOAD,
                defaults.media_viewer.lazy_load,
              )}
              ${this._renderOptionSelector(
                CONF_MEDIA_VIEWER_TRANSITION_EFFECT,
                this._transitionEffects,
              )}
              ${this._putInSubmenu(
                MENU_MEDIA_VIEWER_CONTROLS,
                true,
                'config.media_viewer.controls.options',
                { name: 'mdi:gamepad' },
                html`
                  ${this._renderOptionSelector(
                    CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE,
                    this._eventViewerNextPreviousControlStyles,
                  )}
                  ${this._renderNumberInput(
                    CONF_MEDIA_VIEWER_CONTROLS_NEXT_PREVIOUS_SIZE,
                    {
                      min: BUTTON_SIZE_MIN,
                    },
                  )}
                  ${this._renderOptionSelector(
                    CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_MODE,
                    this._thumbnailModes,
                  )}
                  ${this._renderNumberInput(CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SIZE, {
                    min: THUMBNAIL_WIDTH_MIN,
                    max: THUMBNAIL_WIDTH_MAX,
                  })}
                  ${this._renderSwitch(
                    CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_DETAILS,
                    defaults.media_viewer.controls.thumbnails.show_details,
                  )}
                  ${this._renderSwitch(
                    CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
                    defaults.media_viewer.controls.thumbnails.show_favorite_control,
                  )}
                  ${this._renderSwitch(
                    CONF_MEDIA_VIEWER_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
                    defaults.media_viewer.controls.thumbnails.show_timeline_control,
                  )}
                  ${this._renderOptionSelector(
                    CONF_MEDIA_VIEWER_CONTROLS_TITLE_MODE,
                    this._titleModes,
                  )}
                  ${this._renderNumberInput(
                    CONF_MEDIA_VIEWER_CONTROLS_TITLE_DURATION_SECONDS,
                    { min: 0, max: 60 },
                  )}
                  ${this._renderMiniTimeline(
                    MENU_MEDIA_VIEWER_CONTROLS_TIMELINE,
                    CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_MODE,
                    CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_WINDOW_SECONDS,
                    CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_CLUSTERING_THRESHOLD,
                    CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_MEDIA,
                    CONF_MEDIA_VIEWER_CONTROLS_TIMELINE_SHOW_RECORDINGS,
                  )}
                `,
              )}
              ${this._renderMediaLayout(
                MENU_MEDIA_VIEWER_LAYOUT,
                'config.media_viewer.layout',
                CONF_MEDIA_VIEWER_LAYOUT_FIT,
                CONF_MEDIA_VIEWER_LAYOUT_POSITION_X,
                CONF_MEDIA_VIEWER_LAYOUT_POSITION_Y,
              )}
            </div>`
          : ''}
        ${this._renderOptionSetHeader('image')}
        ${this._expandedMenus[MENU_OPTIONS] === 'image'
          ? html` <div class="values">
              ${this._renderOptionSelector(CONF_IMAGE_MODE, this._imageModes)}
              ${this._renderStringInput(CONF_IMAGE_URL)}
              ${this._renderNumberInput(CONF_IMAGE_REFRESH_SECONDS)}
              ${this._renderMediaLayout(
                MENU_IMAGE_LAYOUT,
                'config.image.layout',
                CONF_IMAGE_LAYOUT_FIT,
                CONF_IMAGE_LAYOUT_POSITION_X,
                CONF_IMAGE_LAYOUT_POSITION_Y,
              )}
            </div>`
          : ''}
        ${this._renderOptionSetHeader('timeline')}
        ${this._expandedMenus[MENU_OPTIONS] === 'timeline'
          ? html` <div class="values">
              ${this._renderTimelineCoreControls(
                CONF_TIMELINE_WINDOW_SECONDS,
                CONF_TIMELINE_CLUSTERING_THRESHOLD,
                CONF_TIMELINE_MEDIA,
                CONF_TIMELINE_SHOW_RECORDINGS,
                defaults.timeline.show_recordings,
              )}
              ${this._putInSubmenu(
                MENU_TIMELINE_CONTROLS,
                true,
                'config.timeline.controls.options',
                { name: 'mdi:gamepad' },
                html` ${this._renderOptionSelector(
                  CONF_TIMELINE_CONTROLS_THUMBNAILS_MODE,
                  this._thumbnailModes,
                )}
                ${this._renderNumberInput(CONF_TIMELINE_CONTROLS_THUMBNAILS_SIZE, {
                  min: THUMBNAIL_WIDTH_MIN,
                  max: THUMBNAIL_WIDTH_MAX,
                })}
                ${this._renderSwitch(
                  CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_DETAILS,
                  defaults.timeline.controls.thumbnails.show_details,
                )}
                ${this._renderSwitch(
                  CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_FAVORITE_CONTROL,
                  defaults.timeline.controls.thumbnails.show_favorite_control,
                )}
                ${this._renderSwitch(
                  CONF_TIMELINE_CONTROLS_THUMBNAILS_SHOW_TIMELINE_CONTROL,
                  defaults.timeline.controls.thumbnails.show_timeline_control,
                )}`,
              )}
            </div>`
          : ''}
        ${this._renderOptionSetHeader('dimensions')}
        ${this._expandedMenus[MENU_OPTIONS] === 'dimensions'
          ? html` <div class="values">
              ${this._renderOptionSelector(
                CONF_DIMENSIONS_ASPECT_RATIO_MODE,
                this._aspectRatioModes,
              )}
              ${this._renderStringInput(CONF_DIMENSIONS_ASPECT_RATIO)}
            </div>`
          : ''}
        ${this._config['overrides'] !== undefined
          ? html` ${this._renderOptionSetHeader('overrides')}
            ${this._expandedMenus[MENU_OPTIONS] === 'overrides'
              ? html` <div class="values">
                  ${this._renderInfo(localize('config.overrides.info'))}
                </div>`
              : ''}`
          : html``}
      </div>
    `;
  }

  /**
   * Close the editor menu with the given domain.
   * @param targetDomain The menu domain to close.
   */
  protected _closeMenu(targetDomain: string) {
    delete this._expandedMenus[targetDomain];
    this.requestUpdate();
  }

  /**
   * Open an editor menu.
   * @param targetDomain The menu domain to open.
   * @param key The menu object key to open.
   */
  protected _openMenu(targetDomain: string, key: number | string) {
    this._expandedMenus[targetDomain] = key;
    this.requestUpdate();
  }

  /**
   * Toggle an editor menu.
   * @param ev An event.
   */
  protected _toggleMenu(ev: { target: EditorMenuTarget | null }): void {
    if (ev && ev.target) {
      const domain = ev.target.domain;
      const key = ev.target.key;

      if (this._expandedMenus[domain] === key) {
        this._closeMenu(domain);
      } else {
        this._openMenu(domain, key);
      }
    }
  }

  /**
   * Handle a changed option value.
   * @param ev Event triggering the change.
   */
  protected _valueChangedHandler(
    key: string,
    ev: CustomEvent<{ value: unknown }>,
  ): void {
    if (!this._config || !this.hass) {
      return;
    }

    let value;
    if (ev.detail && ev.detail.value !== undefined) {
      value = ev.detail.value;
      if (typeof value === 'string') {
        value = value.trim();
      }
    }
    if (getConfigValue(this._config, key) === value) {
      return;
    }

    const newConfig = copyConfig(this._config);
    if (value === '' || value === undefined) {
      deleteConfigValue(newConfig, key);
    } else {
      setConfigValue(newConfig, key, value);
    }
    this._updateConfig(newConfig);
  }

  /**
   * Return compiled CSS styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(frigate_card_editor_style);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-editor': FrigateCardEditor;
  }
}
