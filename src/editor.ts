/* eslint-disable @typescript-eslint/no-explicit-any */
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import { HomeAssistant, LovelaceCardEditor, fireEvent } from 'custom-card-helpers';
import { localize } from './localize/localize.js';
import { frigateCardConfigDefaults, RawFrigateCardConfig } from './types.js';

import frigate_card_editor_style from './scss/editor.scss';
import {
  copyConfig,
  deleteConfigValue,
  getConfigValue,
  isConfigUpgradeable,
  setConfigValue,
  trimConfig,
  upgradeConfig,
} from './config-mgmt.js';
import {
  CONF_CAMERA_ENTITY,
  CONF_DIMENSIONS_ASPECT_RATIO,
  CONF_DIMENSIONS_ASPECT_RATIO_MODE,
  CONF_EVENT_VIEWER_AUTOPLAY_CLIP,
  CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_SIZE,
  CONF_EVENT_VIEWER_CONTROLS_NEXT_PREVIOUS_STYLE,
  CONF_EVENT_VIEWER_CONTROLS_THUMBNAILS_MODE,
  CONF_EVENT_VIEWER_CONTROLS_THUMBNAILS_SIZE,
  CONF_EVENT_VIEWER_DRAGGABLE,
  CONF_EVENT_VIEWER_LAZY_LOAD,
  CONF_FRIGATE_CAMERA_NAME,
  CONF_FRIGATE_CLIENT_ID,
  CONF_FRIGATE_LABEL,
  CONF_FRIGATE_URL,
  CONF_FRIGATE_ZONE,
  CONF_IMAGE_SRC,
  CONF_LIVE_CONTROLS_THUMBNAILS_MEDIA,
  CONF_LIVE_CONTROLS_THUMBNAILS_MODE,
  CONF_LIVE_CONTROLS_THUMBNAILS_SIZE,
  CONF_LIVE_PRELOAD,
  CONF_LIVE_PROVIDER,
  CONF_LIVE_WEBRTC_ENTITY,
  CONF_LIVE_WEBRTC_URL,
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
  CONF_VIEW_TIMEOUT,
} from './const.js';

interface EditorOptionsSet {
  icon: string;
  name: string;
  secondary: string;
  show: boolean;
}
interface EditorOptions {
  [setName: string]: EditorOptionsSet;
}

interface EditorOptionTarget {
  configValue: string;
  checked?: boolean;
  value?: string;
}

interface EditorOptionSetTarget {
  optionSetName: string;
}

const options: EditorOptions = {
  basic: {
    icon: 'cog',
    name: localize('editor.basic'),
    secondary: localize('editor.basic_secondary'),
    show: true,
  },
  frigate: {
    icon: 'alpha-f-box',
    name: localize('editor.frigate'),
    secondary: localize('editor.frigate_secondary'),
    show: false,
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
        .label=${localize(`config.${configPath}`)}
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

  /**
   * Render a string input field.
   * @param configPath The configuration path to set/read.
   * @param allowedPattern An allowed input pattern.
   * @returns A rendered template.
   */
  protected _renderStringInput(
    configPath: string,
    allowedPattern?: string,
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }
    return html` <paper-input
      label=${localize(`config.${configPath}`)}
      .value=${getConfigValue(this._config, configPath, '')}
      .configValue=${configPath}
      allowed-pattern=${ifDefined(allowedPattern ? allowedPattern : undefined)}
      prevent-invalid-input=${ifDefined(allowedPattern)}
      @value-changed=${this._valueChangedHandler}
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
    return html` <ha-formfield .label=${label || localize(`config.${configPath}`)}>
      <ha-switch
        .checked="${getConfigValue(this._config, configPath, valueDefault)}"
        .configValue=${configPath}
        @change=${this._valueChangedHandler}
      ></ha-switch>
    </ha-formfield>`;
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this._helpers || !this._config) {
      return html``;
    }

    // The climate more-info has ha-switch and paper-dropdown-menu elements that
    // are lazy loaded unless explicitly loaded via climate here.
    this._helpers.importMoreInfoControl('climate');

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

    const liveProviders = {
      '': '',
      frigate: localize('config.live.providers.frigate'),
      'frigate-jsmpeg': localize('config.live.providers.frigate-jsmpeg'),
      webrtc: localize('config.live.providers.webrtc'),
    };

    const eventViewerNextPreviousControlStyles = {
      '': '',
      thumbnails: localize(
        'config.event_viewer.controls.next_previous.styles.thumbnails',
      ),
      chevrons: localize('config.event_viewer.controls.next_previous.styles.chevrons'),
      none: localize('config.event_viewer.controls.next_previous.styles.none'),
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
                      this._config = upgradedConfig;

                      fireEvent(this, 'config-changed', { config: this._config });
                      this.requestUpdate();
                    }
                  }}
                >
                </mwc-button>
              </span>
            </div>
            <br />`
        : html``}
      <div class="card-config">
        ${this._renderOptionSetHeader('basic')}
        ${options.basic.show
          ? html`
              <div class="values">
                ${this._renderDropdown(CONF_CAMERA_ENTITY, cameraEntities)}
              </div>
            `
          : ''}
        ${this._renderOptionSetHeader('frigate')}
        ${options.frigate.show
          ? html`
              <div class="values">
                ${this._renderStringInput(CONF_FRIGATE_CAMERA_NAME)}
                ${this._renderStringInput(CONF_FRIGATE_URL)}
                ${this._renderStringInput(CONF_FRIGATE_LABEL)}
                ${this._renderStringInput(CONF_FRIGATE_ZONE)}
                ${this._renderStringInput(CONF_FRIGATE_CLIENT_ID)}
              </div>
            `
          : ''}
        ${this._renderOptionSetHeader('view')}
        ${options.view.show
          ? html`
              <div class="values">
                ${this._renderDropdown(CONF_VIEW_DEFAULT, viewModes)}
                ${this._renderStringInput(CONF_VIEW_TIMEOUT, '[0-9]')}
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
                ${this._renderDropdown(CONF_LIVE_PROVIDER, liveProviders)}
                ${this._renderDropdown(CONF_LIVE_WEBRTC_ENTITY, cameraEntities)}
                ${this._renderStringInput(CONF_LIVE_WEBRTC_URL)}
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
          ? html` <div class="values">${this._renderStringInput(CONF_IMAGE_SRC)}</div>`
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
    target: (EditorOptionTarget & HTMLElement) | null;
  }): void {
    const target = ev.target;
    if (!this._config || !this.hass || !target) {
      return;
    }

    let value;
    if ('checked' in target) {
      value = target.checked;
    } else {
      value = target.value?.trim();
    }
    const key: string = target.configValue;
    if (!key) {
      return;
    }

    const newConfig = copyConfig(this._config);
    if (value === '' || typeof value === 'undefined') {
      // Don't delete empty properties that are from a dropdown menu. An empty
      // property in that context may just be a user-entered value that is not
      // in the valid choices in the dropdown. This probably won't end well for
      // the user anyway, but having the whole property deleted the moment they
      // press a key is very jarring.
      if (target.tagName != 'PAPER-DROPDOWN-MENU') {
        deleteConfigValue(newConfig, key);
      }
    } else {
      setConfigValue(newConfig, key, value);
    }
    trimConfig(newConfig);
    this._config = newConfig;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  /**
   * Return compiled CSS styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(frigate_card_editor_style);
  }
}
