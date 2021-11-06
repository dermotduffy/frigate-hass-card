/* eslint-disable @typescript-eslint/no-explicit-any */
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

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

  protected render(): TemplateResult | void {
    if (!this.hass || !this._helpers || !this._config) {
      return html``;
    }

    // The climate more-info has ha-switch and paper-dropdown-menu elements that
    // are lazy loaded unless explicitly loaded via climate here.
    this._helpers.importMoreInfoControl('climate');

    const cameraEntities = this._getEntities('camera');
    const webrtcCameraEntity = String(
      getConfigValue(this._config, 'live.webrtc.entity', ''),
    );

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

    const defaults = frigateCardConfigDefaults;

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
        <div
          class="option"
          @click=${this._toggleOptionHandler}
          .optionSetName=${'basic'}
        >
          <div class="row">
            <ha-icon .icon=${`mdi:${options.basic.icon}`}></ha-icon>
            <div class="title">${options.basic.name}</div>
          </div>
          <div class="secondary">${options.basic.secondary}</div>
        </div>
        ${options.basic.show
          ? html`
              <div class="values">
                <paper-dropdown-menu
                  label=${localize('config.camera_entity')}
                  @value-changed=${this._valueChangedHandler}
                  .configValue=${'camera_entity'}
                >
                  <paper-listbox
                    slot="dropdown-content"
                    .selected=${cameraEntities.indexOf(
                      String(getConfigValue(this._config, 'camera_entity', '')),
                    )}
                  >
                    ${cameraEntities.map((entity) => {
                      return html` <paper-item>${entity}</paper-item> `;
                    })}
                  </paper-listbox>
                </paper-dropdown-menu>
              </div>
            `
          : ''}
        <div
          class="option"
          @click=${this._toggleOptionHandler}
          .optionSetName=${'frigate'}
        >
          <div class="row">
            <ha-icon .icon=${`mdi:${options.frigate.icon}`}></ha-icon>
            <div class="title">${options.frigate.name}</div>
          </div>
          <div class="secondary">${options.frigate.secondary}</div>
        </div>
        ${options.frigate.show
          ? html`
              <div class="values">
                <paper-input
                  label=${localize('config.frigate.camera_name')}
                  .value=${getConfigValue(this._config, 'frigate.camera_name', '')}
                  .configValue=${'frigate.camera_name'}
                  @value-changed=${this._valueChangedHandler}
                ></paper-input>
                <paper-input
                  label=${localize('config.frigate.url')}
                  .value=${getConfigValue(this._config, 'frigate.url', '')}
                  .configValue=${'frigate.url'}
                  @value-changed=${this._valueChangedHandler}
                ></paper-input>
                <paper-input
                  .label=${localize('config.frigate.label')}
                  .value=${getConfigValue(this._config, 'frigate.label', '')}
                  .configValue=${'frigate.label'}
                  @value-changed=${this._valueChangedHandler}
                ></paper-input>
                <paper-input
                  .label=${localize('config.frigate.zone')}
                  .value=${getConfigValue(this._config, 'frigate.zone', '')}
                  .configValue=${'frigate.zone'}
                  @value-changed=${this._valueChangedHandler}
                ></paper-input>
                <paper-input
                  label=${localize('config.frigate.client_id')}
                  .value=${getConfigValue(this._config, 'frigate.client_id', '')}
                  .configValue=${'frigate.client_id'}
                  @value-changed=${this._valueChangedHandler}
                ></paper-input>
              </div>
            `
          : ''}
        <div class="option" @click=${this._toggleOptionHandler} .optionSetName=${'view'}>
          <div class="row">
            <ha-icon .icon=${`mdi:${options.view.icon}`}></ha-icon>
            <div class="title">${options.view.name}</div>
          </div>
          <div class="secondary">${options.view.secondary}</div>
        </div>
        ${options.view.show
          ? html`
              <div class="values">
                <paper-dropdown-menu
                  label=${localize('config.view.default')}
                  @value-changed=${this._valueChangedHandler}
                  .configValue=${'view.default'}
                >
                  <paper-listbox
                    slot="dropdown-content"
                    .selected=${Object.keys(viewModes).indexOf(
                      String(getConfigValue(this._config, 'view.default', '')),
                    )}
                  >
                    ${Object.keys(viewModes).map((key) => {
                      return html`
                        <paper-item .label="${key}"> ${viewModes[key]} </paper-item>
                      `;
                    })}
                  </paper-listbox>
                </paper-dropdown-menu>
                <paper-input
                  label=${localize('config.view.timeout')}
                  prevent-invalid-input
                  allowed-pattern="[0-9]"
                  .value=${getConfigValue(this._config, 'view.timeout', '')}
                  .configValue=${'view.timeout'}
                  @value-changed=${this._valueChangedHandler}
                ></paper-input>
              </div>
            `
          : ''}
        <div class="option" @click=${this._toggleOptionHandler} .optionSetName=${'menu'}>
          <div class="row">
            <ha-icon .icon=${`mdi:${options.menu.icon}`}></ha-icon>
            <div class="title">${options.menu.name}</div>
          </div>
          <div class="secondary">${options.menu.secondary}</div>
        </div>
        ${options.menu.show
          ? html`
              <div class="values">
                <paper-dropdown-menu
                  .label=${localize('config.menu.mode')}
                  @value-changed=${this._valueChangedHandler}
                  .configValue=${'menu.mode'}
                >
                  <paper-listbox
                    slot="dropdown-content"
                    .selected=${Object.keys(menuModes).indexOf(
                      String(getConfigValue(this._config, 'menu.mode', '')),
                    )}
                  >
                    ${Object.keys(menuModes).map((key) => {
                      return html`
                        <paper-item .label="${key}"> ${menuModes[key]} </paper-item>
                      `;
                    })}
                  </paper-listbox>
                </paper-dropdown-menu>
                <paper-input
                  label=${localize('config.menu.button_size')}
                  .value=${getConfigValue(this._config, 'menu.button_size', '')}
                  .configValue=${'menu.button_size'}
                  @value-changed=${this._valueChangedHandler}
                ></paper-input>
                <ha-formfield
                  .label=${localize('editor.show_button') +
                  ': ' +
                  localize('config.menu.buttons.frigate')}
                >
                  <ha-switch
                    .checked="${getConfigValue(
                      this._config,
                      'menu.buttons.frigate',
                      defaults.menu.buttons.frigate,
                    )},"
                    .configValue=${'menu.buttons.frigate'}
                    @change=${this._valueChangedHandler}
                  ></ha-switch>
                </ha-formfield>
                <ha-formfield
                  .label=${localize('editor.show_button') +
                  ': ' +
                  localize('config.view.views.live')}
                >
                  <ha-switch
                    .checked=${getConfigValue(
                      this._config,
                      'menu.buttons.live',
                      defaults.menu.buttons.live,
                    )}
                    .configValue=${'menu.buttons.live'}
                    @change=${this._valueChangedHandler}
                  ></ha-switch>
                </ha-formfield>
                <ha-formfield
                  .label=${localize('editor.show_button') +
                  ': ' +
                  localize('config.view.views.clips')}
                >
                  <ha-switch
                    .checked=${getConfigValue(
                      this._config,
                      'menu.buttons.clips',
                      defaults.menu.buttons.clips,
                    )}
                    .configValue=${'menu.buttons.clips'}
                    @change=${this._valueChangedHandler}
                  ></ha-switch>
                </ha-formfield>
                <ha-formfield
                  .label=${localize('editor.show_button') +
                  ': ' +
                  localize('config.view.views.snapshots')}
                >
                  <ha-switch
                    .checked=${getConfigValue(
                      this._config,
                      'menu.buttons.snapshots',
                      defaults.menu.buttons.snapshots,
                    )}
                    .configValue=${'menu.buttons.snapshots'}
                    @change=${this._valueChangedHandler}
                  ></ha-switch>
                </ha-formfield>
                <ha-formfield
                  .label=${localize('editor.show_button') +
                  ': ' +
                  localize('config.view.views.image')}
                >
                  <ha-switch
                    .checked=${getConfigValue(
                      this._config,
                      'menu.buttons.image',
                      defaults.menu.buttons.image,
                    )}
                    .configValue=${'menu.buttons.image'}
                    @change=${this._valueChangedHandler}
                  ></ha-switch>
                </ha-formfield>
                <ha-formfield
                  .label=${localize('editor.show_button') +
                  ': ' +
                  localize('config.menu.buttons.download')}
                >
                  <ha-switch
                    .checked=${getConfigValue(
                      this._config,
                      'menu.buttons.download',
                      defaults.menu.buttons.download,
                    )}
                    .configValue=${'menu.buttons.download'}
                    @change=${this._valueChangedHandler}
                  ></ha-switch>
                </ha-formfield>
                <ha-formfield
                  .label=${localize('editor.show_button') +
                  ': ' +
                  localize('config.menu.buttons.frigate_ui')}
                >
                  <ha-switch
                    .checked=${getConfigValue(
                      this._config,
                      'menu.buttons.frigate_ui',
                      defaults.menu.buttons.frigate_ui,
                    )}
                    .configValue=${'menu.buttons.frigate_ui'}
                    @change=${this._valueChangedHandler}
                  ></ha-switch>
                </ha-formfield>
                <ha-formfield
                  .label=${localize('editor.show_button') +
                  ': ' +
                  localize('config.menu.buttons.fullscreen')}
                >
                  <ha-switch
                    .checked=${getConfigValue(
                      this._config,
                      'menu.buttons.fullscreen',
                      defaults.menu.buttons.fullscreen,
                    )}
                    .configValue=${'menu.buttons.fullscreen'}
                    @change=${this._valueChangedHandler}
                  ></ha-switch>
                </ha-formfield>
              </div>
            `
          : ''}
        <div class="option" @click=${this._toggleOptionHandler} .optionSetName=${'live'}>
          <div class="row">
            <ha-icon .icon=${`mdi:${options.live.icon}`}></ha-icon>
            <div class="title">${options.live.name}</div>
          </div>
          <div class="secondary">${options.live.secondary}</div>
        </div>
        ${options.live.show
          ? html`
              <div class="values">
                <br />
                <ha-formfield .label=${localize('config.live.preload')}>
                  <ha-switch
                    .checked=${getConfigValue(
                      this._config,
                      'live.preload',
                      defaults.live.preload,
                    )}
                    .configValue=${'live.preload'}
                    @change=${this._valueChangedHandler}
                  ></ha-switch>
                </ha-formfield>
                <paper-dropdown-menu
                  .label=${localize('config.live.provider')}
                  @value-changed=${this._valueChangedHandler}
                  .configValue=${'live.provider'}
                >
                  <paper-listbox
                    slot="dropdown-content"
                    .selected=${Object.keys(liveProviders).indexOf(
                      String(getConfigValue(this._config, 'live.provider', '')),
                    )}
                  >
                    ${Object.keys(liveProviders).map((key) => {
                      return html`
                        <paper-item .label="${key}">${liveProviders[key]} </paper-item>
                      `;
                    })}
                  </paper-listbox>
                </paper-dropdown-menu>
                <paper-dropdown-menu
                  .label=${localize('config.live.webrtc.entity')}
                  @value-changed=${this._valueChangedHandler}
                  .configValue=${'live.webrtc.entity'}
                >
                  <paper-listbox
                    slot="dropdown-content"
                    .selected=${cameraEntities.indexOf(webrtcCameraEntity)}
                  >
                    ${cameraEntities.map((entity) => {
                      return html` <paper-item>${entity}</paper-item> `;
                    })}
                  </paper-listbox>
                </paper-dropdown-menu>
                <paper-input
                  label=${localize('config.live.webrtc.url')}
                  .value=${getConfigValue(this._config, 'live.webrtc.url', '')}
                  .configValue=${'live.webrtc.url'}
                  @value-changed=${this._valueChangedHandler}
                ></paper-input>
              </div>
            `
          : ''}
        <div
          class="option"
          @click=${this._toggleOptionHandler}
          .optionSetName=${'event_viewer'}
        >
          <div class="row">
            <ha-icon .icon=${`mdi:${options.event_viewer.icon}`}></ha-icon>
            <div class="title">${options.event_viewer.name}</div>
          </div>
          <div class="secondary">${options.event_viewer.secondary}</div>
        </div>
        ${options.event_viewer.show
          ? html` <div class="values">
              <br />
              <ha-formfield .label=${localize('config.event_viewer.autoplay_clip')}>
                <ha-switch
                  .checked=${getConfigValue(
                    this._config,
                    'event_viewer.autoplay_clip',
                    defaults.event_viewer.autoplay_clip,
                  )}
                  .configValue=${'event_viewer.autoplay_clip'}
                  @change=${this._valueChangedHandler}
                ></ha-switch>
              </ha-formfield>
              <ha-formfield .label=${localize('config.event_viewer.lazy_load')}>
                <ha-switch
                  .checked=${getConfigValue(
                    this._config,
                    'event_viewer.lazy_load',
                    defaults.event_viewer.lazy_load,
                  )}
                  .configValue=${'event_viewer.lazy_load'}
                  @change=${this._valueChangedHandler}
                ></ha-switch>
              </ha-formfield>
              <paper-dropdown-menu
                .label=${localize('config.event_viewer.controls.next_previous.style')}
                @value-changed=${this._valueChangedHandler}
                .configValue=${'event_viewer.controls.next_previous.style'}
              >
                <paper-listbox
                  slot="dropdown-content"
                  .selected=${Object.keys(eventViewerNextPreviousControlStyles).indexOf(
                    String(
                      getConfigValue(
                        this._config,
                        'event_viewer.controls.next_previous.style',
                        '',
                      ),
                    ),
                  )}
                >
                  ${Object.keys(eventViewerNextPreviousControlStyles).map((key) => {
                    return html`
                      <paper-item .label="${key}">
                        ${eventViewerNextPreviousControlStyles[key]}
                      </paper-item>
                    `;
                  })}
                </paper-listbox>
              </paper-dropdown-menu>
              <paper-input
                label=${localize('config.event_viewer.controls.next_previous.size')}
                .value=${getConfigValue(
                  this._config,
                  'event_viewer.controls.next_previous.size',
                  '',
                )}
                .configValue=${'event_viewer.controls.next_previous.size'}
                @value-changed=${this._valueChangedHandler}
              ></paper-input>
            </div>`
          : ''}
        <div
          class="option"
          @click=${this._toggleOptionHandler}
          .optionSetName=${'image'}
        >
          <div class="row">
            <ha-icon .icon=${`mdi:${options.image.icon}`}></ha-icon>
            <div class="title">${options.image.name}</div>
          </div>
          <div class="secondary">${options.image.secondary}</div>
        </div>
        ${options.image.show
          ? html` <div class="values">
              <paper-input
                label=${localize('config.image.src')}
                prevent-invalid-input
                .value=${getConfigValue(this._config, 'image.src', '')}
                .configValue=${'image.src'}
                @value-changed=${this._valueChangedHandler}
              ></paper-input>
            </div>`
          : ''}
        <div
          class="option"
          @click=${this._toggleOptionHandler}
          .optionSetName=${'dimensions'}
        >
          <div class="row">
            <ha-icon .icon=${`mdi:${options.dimensions.icon}`}></ha-icon>
            <div class="title">${options.dimensions.name}</div>
          </div>
          <div class="secondary">${options.dimensions.secondary}</div>
        </div>
        ${options.dimensions.show
          ? html` <div class="values">
              <paper-dropdown-menu
                .label=${localize('config.dimensions.aspect_ratio_mode')}
                @value-changed=${this._valueChangedHandler}
                .configValue=${'dimensions.aspect_ratio_mode'}
              >
                <paper-listbox
                  slot="dropdown-content"
                  .selected=${Object.keys(aspectRatioModes).indexOf(
                    String(
                      getConfigValue(this._config, 'dimensions.aspect_ratio_mode', ''),
                    ),
                  )}
                >
                  ${Object.keys(aspectRatioModes).map((key) => {
                    return html`
                      <paper-item .label="${key}"> ${aspectRatioModes[key]} </paper-item>
                    `;
                  })}
                </paper-listbox>
              </paper-dropdown-menu>
              <paper-input
                label=${localize('config.dimensions.aspect_ratio')}
                prevent-invalid-input
                .value=${getConfigValue(this._config, 'dimensions.aspect_ratio', '')}
                .configValue=${'dimensions.aspect_ratio'}
                @value-changed=${this._valueChangedHandler}
              ></paper-input>
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
   * @returns 
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
