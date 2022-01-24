/* eslint-disable @typescript-eslint/no-explicit-any */
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import { HomeAssistant, LovelaceCardEditor, fireEvent } from 'custom-card-helpers';
import { localize } from './localize/localize.js';
import {
  frigateCardConfigDefaults,
  RawFrigateCardConfig,
  RawFrigateCardConfigArray,
} from './types.js';

import {
  CONF_CAMERAS,
  CONF_CAMERAS_ARRAY_CAMERA_ENTITY,
  CONF_CAMERAS_ARRAY_CAMERA_NAME,
  CONF_CAMERAS_ARRAY_CLIENT_ID,
  CONF_CAMERAS_ARRAY_ICON,
  CONF_CAMERAS_ARRAY_ID,
  CONF_CAMERAS_ARRAY_LABEL,
  CONF_CAMERAS_ARRAY_LIVE_PROVIDER,
  CONF_CAMERAS_ARRAY_TITLE,
  CONF_CAMERAS_ARRAY_URL,
  CONF_CAMERAS_ARRAY_WEBRTC_ENTITY,
  CONF_CAMERAS_ARRAY_WEBRTC_URL,
  CONF_CAMERAS_ARRAY_ZONE,
  CONF_DIMENSIONS_ASPECT_RATIO,
  CONF_DIMENSIONS_ASPECT_RATIO_MODE,
  CONF_EVENT_GALLERY_MIN_COLUMNS,
  CONF_EVENT_VIEWER_AUTOPLAY_CLIP,
  CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_SIZE,
  CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE,
  CONF_EVENT_VIEWER_CONTROLS_THUMBNAILS_MODE,
  CONF_EVENT_VIEWER_CONTROLS_THUMBNAILS_SIZE,
  CONF_EVENT_VIEWER_DRAGGABLE,
  CONF_EVENT_VIEWER_LAZY_LOAD,
  CONF_IMAGE_REFRESH_SECONDS,
  CONF_IMAGE_SRC,
  CONF_LIVE_CONTROLS_NEXT_PREVIOUS_SIZE,
  CONF_LIVE_CONTROLS_NEXT_PREVIOUS_STYLE,
  CONF_LIVE_CONTROLS_THUMBNAILS_MEDIA,
  CONF_LIVE_CONTROLS_THUMBNAILS_MODE,
  CONF_LIVE_CONTROLS_THUMBNAILS_SIZE,
  CONF_LIVE_DRAGGABLE,
  CONF_LIVE_LAZY_LOAD,
  CONF_LIVE_PRELOAD,
  CONF_MENU_BUTTONS_CLIPS,
  CONF_MENU_BUTTONS_FRIGATE,
  CONF_MENU_BUTTONS_FRIGATE_DOWNLOAD,
  CONF_MENU_BUTTONS_FRIGATE_FULLSCREEN,
  CONF_MENU_BUTTONS_FRIGATE_UI,
  CONF_MENU_BUTTONS_IMAGE,
  CONF_MENU_BUTTONS_LIVE,
  CONF_MENU_BUTTONS_SNAPSHOTS,
  CONF_MENU_BUTTON_SIZE,
  CONF_MENU_MODE,
  CONF_VIEW_DEFAULT,
  CONF_VIEW_TIMEOUT_SECONDS,
  CONF_VIEW_UPDATE_CYCLE_CAMERA,
  CONF_VIEW_UPDATE_FORCE,
  CONF_VIEW_UPDATE_SECONDS,
} from './const.js';
import { arrayMove, getEntityTitle, prettifyFrigateName } from './common.js';
import {
  copyConfig,
  deleteConfigValue,
  getArrayConfigPath,
  getConfigValue,
  isConfigUpgradeable,
  setConfigValue,
  upgradeConfig,
} from './config-mgmt.js';

import frigate_card_editor_style from './scss/editor.scss';

interface EditorOptionsSet {
  icon: string;
  name: string;
  secondary: string;
  show: boolean;
}
interface EditorOptions {
  [setName: string]: EditorOptionsSet;
}

interface ConfigValueTarget {
  configValue: string;
  checked?: boolean;
  value?: string;
}

interface EditorCameraTarget {
  cameraIndex: number;
}

interface EditorOptionSetTarget {
  optionSetName: string;
}

const options: EditorOptions = {
  cameras: {
    icon: 'video',
    name: localize('editor.cameras'),
    secondary: localize('editor.cameras_secondary'),
    show: true,
  },
  view: {
    icon: 'eye',
    name: localize('editor.view'),
    secondary: localize('editor.view_secondary'),
    show: false,
  },
  menu: {
    icon: 'menu',
    name: localize('editor.menu'),
    secondary: localize('editor.menu_secondary'),
    show: false,
  },
  live: {
    icon: 'cctv',
    name: localize('editor.live'),
    secondary: localize('editor.live_secondary'),
    show: false,
  },
  event_viewer: {
    icon: 'filmstrip',
    name: localize('editor.event_viewer'),
    secondary: localize('editor.event_viewer_secondary'),
    show: false,
  },
  event_gallery: {
    icon: 'grid',
    name: localize('editor.event_gallery'),
    secondary: localize('editor.event_gallery_secondary'),
    show: false,
  },
  image: {
    icon: 'image',
    name: localize('editor.image'),
    secondary: localize('editor.image_secondary'),
    show: false,
  },
  dimensions: {
    icon: 'aspect-ratio',
    name: localize('editor.dimensions'),
    secondary: localize('editor.dimensions_secondary'),
    show: false,
  },
};

@customElement('frigate-card-editor')
export class FrigateCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() protected _config?: RawFrigateCardConfig;
  @state() protected _helpers?: any;
  protected _initialized = false;
  protected _configUpgradeable = false;

  @property({ attribute: false })
  protected _expandedCameraIndex: number | null = null;

  public setConfig(config: RawFrigateCardConfig): void {
    // Note: This does not use Zod to parse the configuration, so it may be
    // partially or completely invalid. It's more useful to have a partially
    // valid configuration here, to allow the user to fix the broken parts. As
    // such, RawFrigateCardConfig is used as the type.
    this._config = config;
    this._configUpgradeable = isConfigUpgradeable(config);
    this.loadCardHelpers();
  }

  protected shouldUpdate(): boolean {
    if (!this._initialized) {
      this._initialize();
    }

    return true;
  }

  protected _getEntities(domain: string): string[] {
    if (!this.hass) {
      return [];
    }
    const entities = Object.keys(this.hass.states).filter(
      (eid) => eid.substr(0, eid.indexOf('.')) === domain,
    );
    entities.sort();

    // Add a blank entry to unset a selection.
    entities.unshift('');
    return entities;
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
        class="option"
        @click=${this._toggleOptionHandler}
        .optionSetName=${optionSetName}
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
   * Render a dropdown menu.
   * @param configPath The configuration path to set/read.
   * @param dropdown The downdown in an array or key/value dictionary.
   * @returns A rendered template.
   */
  protected _renderDropdown(
    configPath: string,
    dropdown: string[] | Record<string, string>,
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }
    const keys = Array.isArray(dropdown) ? dropdown : Object.keys(dropdown);

    return html`
      <paper-dropdown-menu
        .label=${this._getLabel(configPath)}
        @value-changed=${this._valueChangedHandler}
        .configValue=${configPath}
      >
        <paper-listbox
          slot="dropdown-content"
          .selected=${keys.indexOf(String(getConfigValue(this._config, configPath, '')))}
        >
          ${keys.map(
            (key) => html` <paper-item .label="${key}">
              ${Array.isArray(dropdown) ? key : dropdown[key]}
            </paper-item>`,
          )}
        </paper-listbox>
      </paper-dropdown-menu>
    `;
  }

  protected _renderSlider(
    configPath: string,
    valueDefault: number,
    icon: string,
    min: number,
    max: number,
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }
    const value = Number(getConfigValue(this._config, configPath, valueDefault));
    return html`<ha-labeled-slider
      caption=${this._getLabel(configPath)}
      icon=${icon}
      max=${max}
      min=${min}
      ?pin=${true}
      value=${isNaN(value) ? valueDefault : value}
      @value-changed=${this._valueChangedHandler.bind(this)}
      .configValue=${configPath}
    >
    </ha-labeled-slider>`;
  }

  /**
   * Render a camera header.
   * @param cameraIndex The index of the camera to edit/add.
   * @param cameraConfig The configuration of the camera in question.
   * @param addNewCamera Whether or not this is a header to add a new camera.
   * @returns A rendered template.
   */
  protected _renderCameraHeader(
    cameraIndex: number,
    cameraConfig?: RawFrigateCardConfig,
    addNewCamera?: boolean,
  ): TemplateResult {
    return html`
      <div
        class="camera-header"
        @click=${this._toggleCameraHandler}
        .cameraIndex=${cameraIndex}
      >
        <ha-icon .icon=${addNewCamera ? 'mdi:video-plus' : 'mdi:video'}></ha-icon>
        <span>
          ${addNewCamera
            ? html` <span class="new-camera">
                [${localize('editor.add_new_camera')}...]
              </span>`
            : // Attempt to render a recognizable name for the camera,
              // starting with the most likely to be useful and working our
              // ways towards the least useful.
              html` <span>
                ${cameraConfig?.title ||
                cameraConfig?.id ||
                [
                  cameraConfig?.camera_entity
                    ? getEntityTitle(this.hass, String(cameraConfig.camera_entity))
                    : '',
                  cameraConfig?.client_id,
                  cameraConfig?.camera_name
                    ? prettifyFrigateName(String(cameraConfig.camera_name))
                    : '',
                  cameraConfig?.label
                    ? prettifyFrigateName(String(cameraConfig.label))
                    : '',
                  cameraConfig?.zone
                    ? prettifyFrigateName(String(cameraConfig.zone))
                    : '',
                ]
                  .filter(Boolean)
                  .join(' / ') ||
                localize('editor.camera') + ' #' + cameraIndex}
              </span>`}
        </span>
      </div>
    `;
  }

  /**
   * Render a camera section.
   * @param cameras The full array of cameras.
   * @param cameraIndex The index (in the array) to render.
   * @param cameraEntities The full list of camera entities.
   * @param addNewCamera Whether or not this is a section to add a new non-existent camera.
   * @returns A rendered template.
   */
  protected _renderCamera(
    cameras: RawFrigateCardConfigArray,
    cameraIndex: number,
    cameraEntities: string[],
    addNewCamera?: boolean,
  ): TemplateResult | void {
    const liveProviders = {
      '': '',
      auto: localize('config.cameras.live_providers.auto'),
      frigate: localize('config.cameras.live_providers.frigate'),
      'frigate-jsmpeg': localize('config.cameras.live_providers.frigate-jsmpeg'),
      webrtc: localize('config.cameras.live_providers.webrtc'),
    } as const;

    // Make a new config and update the editor with changes on it,
    const modifyConfig = (func: (config: RawFrigateCardConfig) => boolean): void => {
      if (this._config) {
        const newConfig = copyConfig(this._config);
        if (func(newConfig)) {
          this._updateConfig(newConfig);
        }
      }
    };

    return html`
      ${this._renderCameraHeader(cameraIndex, cameras[cameraIndex], addNewCamera)}
      ${this._expandedCameraIndex === cameraIndex
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
                      this._expandedCameraIndex = cameraIndex - 1;
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
                      this._expandedCameraIndex = cameraIndex + 1;
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
                      this._expandedCameraIndex = null;
                      return true;
                    }
                    return false;
                  });
                }}
              >
                <ha-icon icon="mdi:delete"></ha-icon>
              </ha-icon-button>
            </div>
            ${this._renderDropdown(
              getArrayConfigPath(CONF_CAMERAS_ARRAY_CAMERA_ENTITY, cameraIndex),
              cameraEntities,
            )}
            ${this._renderStringInput(
              getArrayConfigPath(CONF_CAMERAS_ARRAY_CAMERA_NAME, cameraIndex),
            )}
            ${this._renderDropdown(
              getArrayConfigPath(CONF_CAMERAS_ARRAY_LIVE_PROVIDER, cameraIndex),
              liveProviders)}
            ${this._renderStringInput(
              getArrayConfigPath(CONF_CAMERAS_ARRAY_URL, cameraIndex),
            )}
            ${this._renderStringInput(
              getArrayConfigPath(CONF_CAMERAS_ARRAY_LABEL, cameraIndex),
            )}
            ${this._renderStringInput(
              getArrayConfigPath(CONF_CAMERAS_ARRAY_ZONE, cameraIndex),
            )}
            ${this._renderStringInput(
              getArrayConfigPath(CONF_CAMERAS_ARRAY_CLIENT_ID, cameraIndex),
            )}
            ${this._renderStringInput(
              getArrayConfigPath(CONF_CAMERAS_ARRAY_TITLE, cameraIndex),
            )}
            ${this._renderStringInput(
              getArrayConfigPath(CONF_CAMERAS_ARRAY_ICON, cameraIndex),
            )}
            ${this._renderStringInput(
              getArrayConfigPath(CONF_CAMERAS_ARRAY_ID, cameraIndex),
            )}
            ${this._renderDropdown(
              getArrayConfigPath(CONF_CAMERAS_ARRAY_WEBRTC_ENTITY, cameraIndex),
              cameraEntities,
            )}
            ${this._renderStringInput(
              getArrayConfigPath(CONF_CAMERAS_ARRAY_WEBRTC_URL, cameraIndex),
            )}
          </div>`
        : ``}
    `;
  }

  /**
   * Render a string input field.
   * @param configPath The configuration path to set/read.
   * @param allowedPattern An allowed input pattern.
   * @returns A rendered template.
   */
  protected _renderStringInput(
    configPath: string,
    type?: 'text' | 'number',
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }
    const allowedPattern = type == 'number' ? '[0-9]' : undefined
    return html` <paper-input
      label=${this._getLabel(configPath)}
      .value=${getConfigValue(this._config, configPath, '')}
      .configValue=${configPath}
      type=${type || 'text'}
      allowed-pattern=${ifDefined(allowedPattern)}
      prevent-invalid-input=${ifDefined(allowedPattern)}
      @change=${this._valueChangedHandler}
    ></paper-input>`;
  }

  /**
   * Render a switch.
   * @param configPath The configuration path to set/read.
   * @param valueDefault The default switch value if unset.
   * @param label An optional switch label.
   * @returns A rendered template.
   */
  protected _renderSwitch(
    configPath: string,
    valueDefault: boolean,
    label?: string,
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }
    return html` <ha-formfield .label=${label || this._getLabel(configPath)}>
      <ha-switch
        .checked="${getConfigValue(this._config, configPath, valueDefault)}"
        .configValue=${configPath}
        @change=${this._valueChangedHandler}
      ></ha-switch>
    </ha-formfield>`;
  }

  protected _updateConfig(config: RawFrigateCardConfig): void {
    this._config = config;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this._helpers || !this._config) {
      return html``;
    }

    // The climate more-info loads ha-switch and paper-dropdown-menu.
    this._helpers.importMoreInfoControl('climate');

    // The light more-info loads ha-labeled-slider.
    this._helpers.importMoreInfoControl('light');

    const cameraEntities = this._getEntities('camera');

    const viewModes = {
      '': '',
      live: localize('config.view.views.live'),
      clips: localize('config.view.views.clips'),
      snapshots: localize('config.view.views.snapshots'),
      clip: localize('config.view.views.clip'),
      snapshot: localize('config.view.views.snapshot'),
      image: localize('config.view.views.image'),
    };

    const menuModes = {
      '': '',
      none: localize('config.menu.modes.none'),
      'hidden-top': localize('config.menu.modes.hidden-top'),
      'hidden-left': localize('config.menu.modes.hidden-left'),
      'hidden-bottom': localize('config.menu.modes.hidden-bottom'),
      'hidden-right': localize('config.menu.modes.hidden-right'),
      'overlay-top': localize('config.menu.modes.overlay-top'),
      'overlay-left': localize('config.menu.modes.overlay-left'),
      'overlay-bottom': localize('config.menu.modes.overlay-bottom'),
      'overlay-right': localize('config.menu.modes.overlay-right'),
      'hover-top': localize('config.menu.modes.hover-top'),
      'hover-left': localize('config.menu.modes.hover-left'),
      'hover-bottom': localize('config.menu.modes.hover-bottom'),
      'hover-right': localize('config.menu.modes.hover-right'),
      above: localize('config.menu.modes.above'),
      below: localize('config.menu.modes.below'),
    };

    const eventViewerNextPreviousControlStyles = {
      '': '',
      thumbnails: localize(
        'config.event_viewer.controls.next_previous.styles.thumbnails',
      ),
      chevrons: localize('config.event_viewer.controls.next_previous.styles.chevrons'),
      none: localize('config.event_viewer.controls.next_previous.styles.none'),
    };

    const liveNextPreviousControlStyles = {
      '': '',
      chevrons: localize('config.live.controls.next_previous.styles.chevrons'),
      icons: localize('config.live.controls.next_previous.styles.icons'),
      none: localize('config.live.controls.next_previous.styles.none'),
    };

    const aspectRatioModes = {
      '': '',
      dynamic: localize('config.dimensions.aspect_ratio_modes.dynamic'),
      static: localize('config.dimensions.aspect_ratio_modes.static'),
      unconstrained: localize('config.dimensions.aspect_ratio_modes.unconstrained'),
    };

    const thumbnailModes = {
      '': '',
      none: localize('config.event_viewer.controls.thumbnails.modes.none'),
      above: localize('config.event_viewer.controls.thumbnails.modes.above'),
      below: localize('config.event_viewer.controls.thumbnails.modes.below'),
    };

    const thumbnailMedias = {
      '': '',
      clips: localize('config.live.controls.thumbnails.medias.clips'),
      snapshots: localize('config.live.controls.thumbnails.medias.snapshots'),
    };

    const defaults = frigateCardConfigDefaults;

    const getShowButtonLabel = (configPath: string) =>
      localize('editor.show_button') + ': ' + localize(`config.${configPath}`);

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
        ${options.cameras.show
          ? html` <div class="cameras">
              ${cameras.map((_, index) =>
                this._renderCamera(cameras, index, cameraEntities),
              )}
              ${this._renderCamera(cameras, cameras.length, cameraEntities, true)}
            </div>`
          : ''}
        ${this._renderOptionSetHeader('view')}
        ${options.view.show
          ? html`
              <div class="values">
                ${this._renderDropdown(CONF_VIEW_DEFAULT, viewModes)}
                ${this._renderStringInput(CONF_VIEW_TIMEOUT_SECONDS, 'number')}
                ${this._renderStringInput(CONF_VIEW_UPDATE_SECONDS, 'number')}
                ${this._renderSwitch(CONF_VIEW_UPDATE_FORCE, defaults.view.update_force)}
                ${this._renderSwitch(CONF_VIEW_UPDATE_CYCLE_CAMERA, defaults.view.update_cycle_camera)}
              </div>
            `
          : ''}
        ${this._renderOptionSetHeader('menu')}
        ${options.menu.show
          ? html`
              <div class="values">
                ${this._renderDropdown(CONF_MENU_MODE, menuModes)}
                ${this._renderStringInput(CONF_MENU_BUTTON_SIZE)}
                ${this._renderSwitch(
                  CONF_MENU_BUTTONS_FRIGATE,
                  defaults.menu.buttons.frigate,
                  getShowButtonLabel(CONF_MENU_BUTTONS_FRIGATE),
                )}
                ${this._renderSwitch(
                  CONF_MENU_BUTTONS_LIVE,
                  defaults.menu.buttons.live,
                  getShowButtonLabel('view.views.live'),
                )}
                ${this._renderSwitch(
                  CONF_MENU_BUTTONS_CLIPS,
                  defaults.menu.buttons.clips,
                  getShowButtonLabel('view.views.clips'),
                )}
                ${this._renderSwitch(
                  CONF_MENU_BUTTONS_SNAPSHOTS,
                  defaults.menu.buttons.snapshots,
                  getShowButtonLabel('view.views.snapshots'),
                )}
                ${this._renderSwitch(
                  CONF_MENU_BUTTONS_IMAGE,
                  defaults.menu.buttons.image,
                  getShowButtonLabel('view.views.image'),
                )}
                ${this._renderSwitch(
                  CONF_MENU_BUTTONS_FRIGATE_DOWNLOAD,
                  defaults.menu.buttons.download,
                  getShowButtonLabel(CONF_MENU_BUTTONS_FRIGATE_DOWNLOAD),
                )}
                ${this._renderSwitch(
                  CONF_MENU_BUTTONS_FRIGATE_UI,
                  defaults.menu.buttons.frigate_ui,
                  getShowButtonLabel(CONF_MENU_BUTTONS_FRIGATE_UI),
                )}
                ${this._renderSwitch(
                  CONF_MENU_BUTTONS_FRIGATE_FULLSCREEN,
                  defaults.menu.buttons.fullscreen,
                  getShowButtonLabel(CONF_MENU_BUTTONS_FRIGATE_FULLSCREEN),
                )}
              </div>
            `
          : ''}
        ${this._renderOptionSetHeader('live')}
        ${options.live.show
          ? html`
              <div class="values">
                ${this._renderSwitch(CONF_LIVE_PRELOAD, defaults.live.preload)}
                ${this._renderSwitch(
                  CONF_LIVE_DRAGGABLE,
                  defaults.live.draggable,
                )}
                ${this._renderSwitch(
                  CONF_LIVE_LAZY_LOAD,
                  defaults.live.lazy_load,
                )}
                ${this._renderDropdown(
                  CONF_LIVE_CONTROLS_NEXT_PREVIOUS_STYLE,
                  liveNextPreviousControlStyles,
                )}
                ${this._renderStringInput(CONF_LIVE_CONTROLS_NEXT_PREVIOUS_SIZE)}
                ${this._renderDropdown(
                  CONF_LIVE_CONTROLS_THUMBNAILS_MODE,
                  thumbnailModes,
                )}
                ${this._renderDropdown(
                  CONF_LIVE_CONTROLS_THUMBNAILS_MEDIA,
                  thumbnailMedias,
                )}
                ${this._renderStringInput(CONF_LIVE_CONTROLS_THUMBNAILS_SIZE)}
              </div>
            `
          : ''}
        ${this._renderOptionSetHeader('event_gallery')}
        ${options.event_gallery.show
          ? html` <div class="values">
              ${this._renderSlider(
                CONF_EVENT_GALLERY_MIN_COLUMNS,
                defaults.event_gallery.min_columns,
                "mdi:view-column",
                1,
                10,
              )}
            </div>`
          : ''}
        ${this._renderOptionSetHeader('event_viewer')}
        ${options.event_viewer.show
          ? html` <div class="values">
              ${this._renderSwitch(
                CONF_EVENT_VIEWER_AUTOPLAY_CLIP,
                defaults.event_viewer.autoplay_clip,
              )}
              ${this._renderSwitch(
                CONF_EVENT_VIEWER_DRAGGABLE,
                defaults.event_viewer.draggable,
              )}
              ${this._renderSwitch(
                CONF_EVENT_VIEWER_LAZY_LOAD,
                defaults.event_viewer.lazy_load,
              )}
              ${this._renderDropdown(
                CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE,
                eventViewerNextPreviousControlStyles,
              )}
              ${this._renderStringInput(CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_SIZE)}
              ${this._renderDropdown(
                CONF_EVENT_VIEWER_CONTROLS_THUMBNAILS_MODE,
                thumbnailModes,
              )}
              ${this._renderStringInput(CONF_EVENT_VIEWER_CONTROLS_THUMBNAILS_SIZE)}
            </div>`
          : ''}
        ${this._renderOptionSetHeader('image')}
        ${options.image.show
          ? html` <div class="values">
              ${this._renderStringInput(CONF_IMAGE_SRC)}
              ${this._renderStringInput(CONF_IMAGE_REFRESH_SECONDS, 'number')}
            </div>`
          : ''}
        ${this._renderOptionSetHeader('dimensions')}
        ${options.dimensions.show
          ? html` <div class="values">
              ${this._renderDropdown(
                CONF_DIMENSIONS_ASPECT_RATIO_MODE,
                aspectRatioModes,
              )}
              ${this._renderStringInput(CONF_DIMENSIONS_ASPECT_RATIO)}
            </div>`
          : ''}
      </div>
    `;
  }

  /**
   * Verify editor is initialized.
   */
  protected _initialize(): void {
    if (this.hass === undefined) return;
    if (this._config === undefined) return;
    if (this._helpers === undefined) return;
    this._initialized = true;
  }

  /**
   * Load card helpers.
   */
  protected async loadCardHelpers(): Promise<void> {
    this._helpers = await (window as any).loadCardHelpers();
  }

  /**
   * Display/hide a camera section.
   * @param ev The event triggering the change.
   */
  protected _toggleCameraHandler(ev: { target: EditorCameraTarget | null }): void {
    if (ev && ev.target) {
      this._expandedCameraIndex =
        this._expandedCameraIndex == ev.target.cameraIndex
          ? null
          : ev.target.cameraIndex;
    }
  }

  /**
   * Handle a toggled set of options.
   * @param ev The event triggering the change.
   */
  protected _toggleOptionHandler(ev: { target: EditorOptionSetTarget | null }): void {
    this._toggleOptionSet(ev, options);
  }

  /**
   * Toggle display of a set of options (e.g. 'Live')
   * @param ev The event triggering the change.
   * @param options The EditorOptions object.
   */
  protected _toggleOptionSet(
    ev: { target: EditorOptionSetTarget | null },
    options: EditorOptions,
  ): void {
    if (ev && ev.target) {
      const show = !options[ev.target.optionSetName].show;
      for (const [key] of Object.entries(options)) {
        options[key].show = false;
      }
      options[ev.target.optionSetName].show = show;
      this.requestUpdate();
    }
  }

  /**
   * Handle a changed option value.
   * @param ev Event triggering the change.
   */
  protected _valueChangedHandler(ev: {
    target: (ConfigValueTarget & HTMLElement) | null;
  }): void {
    const target = ev.target;
    if (!this._config || !this.hass || !target) {
      return;
    }

    let value;
    if ('checked' in target) {
      value = target.checked;
    } else if (typeof target.value === 'string') {
      value = target.value?.trim();
      if (target['type'] === 'number') {
        value = Number(value);
      }
    } else {
      value = target.value;
    }
    const key: string = target.configValue;
    if (!key) {
      return;
    }

    if (getConfigValue(this._config, key) === value) {
      return;
    }

    const newConfig = copyConfig(this._config);
    if (value === '' || typeof value === 'undefined') {
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
