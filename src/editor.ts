/* eslint-disable @typescript-eslint/no-explicit-any */

// TODO Add editor for control sizes
// TODO reorganizse editor by section

import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { HomeAssistant, LovelaceCardEditor, fireEvent } from 'custom-card-helpers';
import { localize } from './localize/localize.js';
import {
  FrigateCardConfig,
  frigateCardConfigDefaults,
  frigateCardConfigSchema,
} from './types.js';

import frigate_card_editor_style from './scss/editor.scss';

const options = {
  basic: {
    icon: 'cog',
    name: localize('editor.basic'),
    secondary: localize('editor.basic_secondary'),
    show: true,
  },
  optional: {
    icon: 'tune',
    name: localize('editor.optional'),
    secondary: localize('editor.optional_secondary'),
    show: false,
  },
  appearance: {
    icon: 'palette',
    name: localize('editor.appearance'),
    secondary: localize('editor.appearance_secondary'),
    show: false,
  },
  webrtc: {
    icon: 'webrtc',
    name: localize('editor.webrtc'),
    secondary: localize('editor.webrtc_secondary'),
    show: false,
  },
  advanced: {
    icon: 'cogs',
    name: localize('editor.advanced'),
    secondary: localize('editor.advanced_secondary'),
    show: false,
  },
};

@customElement('frigate-card-editor')
export class FrigateCardEditor extends LitElement implements LovelaceCardEditor {
  @property({ attribute: false }) public hass?: HomeAssistant;
  @state() private _config?: FrigateCardConfig;
  @state() private _toggle?: boolean;
  @state() private _helpers?: any;
  private _initialized = false;

  public setConfig(config: FrigateCardConfig): void {
    // Note: This does not use Zod to parse the configuration, so it may be
    // partially or completely invalid. It's more useful to have a partially
    // valid configuration here, to allow the user to fix the broken parts.
    this._config = config;
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
    if (!this.hass || !this._helpers) {
      return html``;
    }

    // The climate more-info has ha-switch and paper-dropdown-menu elements that
    // are lazy loaded unless explicitly loaded via climate here.
    this._helpers.importMoreInfoControl('climate');

    const cameraEntities = this._getEntities('camera');

    const webrtcCameraEntity =
      this._config?.live?.webrtc && (this._config?.live.webrtc as any).entity
        ? (this._config?.live.webrtc as any).entity
        : '';

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
      <div class="card-config">
        <div class="option" @click=${this._toggleOption} .option=${'basic'}>
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
                  @value-changed=${this._valueChanged}
                  .configValue=${'camera_entity'}
                >
                  <paper-listbox
                    slot="dropdown-content"
                    .selected=${cameraEntities.indexOf(
                      this._config?.camera_entity || '',
                    )}
                  >
                    ${cameraEntities.map((entity) => {
                      return html` <paper-item>${entity}</paper-item> `;
                    })}
                  </paper-listbox>
                </paper-dropdown-menu>
                <paper-input
                  label=${localize('config.frigate.camera_name')}
                  .value=${this._config?.frigate?.camera_name || ''}
                  .configValue=${'frigate.camera_name'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
                <paper-dropdown-menu
                  label=${localize('config.view.default')}
                  @value-changed=${this._valueChanged}
                  .configValue=${'view.default'}
                >
                  <paper-listbox
                    slot="dropdown-content"
                    .selected=${Object.keys(viewModes).indexOf(
                      this._config?.view?.default || '',
                    )}
                  >
                    ${Object.keys(viewModes).map((key) => {
                      return html`
                        <paper-item .label="${key}"> ${viewModes[key]} </paper-item>
                      `;
                    })}
                  </paper-listbox>
                </paper-dropdown-menu>
              </div>
            `
          : ''}
        <div class="option" @click=${this._toggleOption} .option=${'optional'}>
          <div class="row">
            <ha-icon .icon=${`mdi:${options.optional.icon}`}></ha-icon>
            <div class="title">${options.optional.name}</div>
          </div>
          <div class="secondary">${options.optional.secondary}</div>
        </div>
        ${options.optional.show
          ? html` <div class="values">
              <paper-dropdown-menu
                .label=${localize('config.live.provider')}
                @value-changed=${this._valueChanged}
                .configValue=${'live.provider'}
              >
                <paper-listbox
                  slot="dropdown-content"
                  .selected=${Object.keys(liveProviders).indexOf(
                    this._config?.live?.provider || '',
                  )}
                >
                  ${Object.keys(liveProviders).map((key) => {
                    return html`
                      <paper-item .label="${key}">${liveProviders[key]} </paper-item>
                    `;
                  })}
                </paper-listbox>
              </paper-dropdown-menu>
              <paper-input
                label=${localize('config.frigate.client_id')}
                .value=${this._config?.frigate?.client_id || ''}
                .configValue=${'frigate.client_id'}
                @value-changed=${this._valueChanged}
              ></paper-input>
              <paper-input
                label=${localize('config.view.timeout')}
                prevent-invalid-input
                allowed-pattern="[0-9]"
                .value=${this._config?.view?.timeout
                  ? String(this._config?.view?.timeout)
                  : ''}
                .configValue=${'view.timeout'}
                @value-changed=${this._valueChanged}
              ></paper-input>
              <paper-input
                label=${localize('config.frigate.url')}
                .value=${this._config?.frigate?.url || ''}
                .configValue=${'frigate.url'}
                @value-changed=${this._valueChanged}
              ></paper-input>
              <ha-formfield .label=${localize('config.event_viewer.autoplay_clip')}>
                <ha-switch
                  .checked=${this._config?.event_viewer?.autoplay_clip ??
                  defaults.event_viewer.autoplay_clip}
                  .configValue=${'event_viewer.autoplay_clip'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <ha-formfield .label=${localize('config.live.preload')}>
                <ha-switch
                  .checked=${this._config?.live?.preload ?? defaults.live.preload}
                  .configValue=${'live.preload'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <ha-formfield .label=${localize('config.event_viewer.lazy_load')}>
                <ha-switch
                  .checked=${this._config?.event_viewer?.lazy_load ??
                  defaults.event_viewer.lazy_load}
                  .configValue=${'event_viewer.lazy_load'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
            </div>`
          : ''}
        <div class="option" @click=${this._toggleOption} .option=${'appearance'}>
          <div class="row">
            <ha-icon .icon=${`mdi:${options.appearance.icon}`}></ha-icon>
            <div class="title">${options.appearance.name}</div>
          </div>
          <div class="secondary">${options.appearance.secondary}</div>
        </div>
        ${options.appearance.show
          ? html`<paper-dropdown-menu
                .label=${localize('config.menu.mode')}
                @value-changed=${this._valueChanged}
                .configValue=${'menu.mode'}
              >
                <paper-listbox
                  slot="dropdown-content"
                  .selected=${Object.keys(menuModes).indexOf(
                    this._config?.menu?.mode || '',
                  )}
                >
                  ${Object.keys(menuModes).map((key) => {
                    return html`
                      <paper-item .label="${key}"> ${menuModes[key]} </paper-item>
                    `;
                  })}
                </paper-listbox>
              </paper-dropdown-menu>
              <br />
              <paper-dropdown-menu
                .label=${localize('config.event_viewer.controls.next_previous.style')}
                @value-changed=${this._valueChanged}
                .configValue=${'event_viewer.controls.next_previous.style'}
              >
                <paper-listbox
                  slot="dropdown-content"
                  .selected=${Object.keys(eventViewerNextPreviousControlStyles).indexOf(
                    this._config?.event_viewer?.controls?.next_previous?.style || '',
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
              <br />
              <paper-dropdown-menu
                .label=${localize('config.dimensions.aspect_ratio_mode')}
                @value-changed=${this._valueChanged}
                .configValue=${'dimensions.aspect_ratio_mode'}
              >
                <paper-listbox
                  slot="dropdown-content"
                  .selected=${Object.keys(aspectRatioModes).indexOf(
                    this._config?.dimensions?.aspect_ratio_mode || '',
                  )}
                >
                  ${Object.keys(aspectRatioModes).map((key) => {
                    return html`
                      <paper-item .label="${key}"> ${aspectRatioModes[key]} </paper-item>
                    `;
                  })}
                </paper-listbox>
              </paper-dropdown-menu>
              <br />
              <paper-input
                label=${localize('config.dimensions.aspect_ratio')}
                prevent-invalid-input
                .value=${this._config?.dimensions?.aspect_ratio
                  ? String(this._config?.dimensions?.aspect_ratio)
                  : ''}
                .configValue=${'dimensions.aspect_ratio'}
                @value-changed=${this._valueChanged}
              ></paper-input>
              <paper-input
                label=${localize('config.image.src')}
                prevent-invalid-input
                .value=${this._config?.image?.src
                  ? String(this._config?.image?.src)
                  : ''}
                .configValue=${'image.src'}
                @value-changed=${this._valueChanged}
              ></paper-input>
              <ha-formfield
                .label=${localize('editor.show_button') +
                ': ' +
                localize('config.menu.buttons.frigate')}
              >
                <ha-switch
                  .checked=${this._config?.menu?.buttons?.frigate ??
                  defaults.menu.buttons.frigate}
                  .configValue=${'menu.buttons.frigate'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <br />
              <ha-formfield
                .label=${localize('editor.show_button') +
                ': ' +
                localize('config.view.views.live')}
              >
                <ha-switch
                  .checked=${this._config?.menu?.buttons?.live ??
                  defaults.menu.buttons.live}
                  .configValue=${'menu.buttons.live'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <br />
              <ha-formfield
                .label=${localize('editor.show_button') +
                ': ' +
                localize('config.view.views.clips')}
              >
                <ha-switch
                  .checked=${this._config?.menu?.buttons?.clips ??
                  defaults.menu.buttons.clips}
                  .configValue=${'menu.buttons.clips'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <br />
              <ha-formfield
                .label=${localize('editor.show_button') +
                ': ' +
                localize('config.view.views.snapshots')}
              >
                <ha-switch
                  .checked=${this._config?.menu?.buttons?.snapshots ??
                  defaults.menu.buttons.snapshots}
                  .configValue=${'menu.buttons.snapshots'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <br />
              <ha-formfield
                .label=${localize('editor.show_button') +
                ': ' +
                localize('config.view.views.image')}
              >
                <ha-switch
                  .checked=${this._config?.menu?.buttons?.image ??
                  defaults.menu.buttons.image}
                  .configValue=${'menu.buttons.image'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <br />
              <ha-formfield
                .label=${localize('editor.show_button') +
                ': ' +
                localize('config.menu.buttons.download')}
              >
                <ha-switch
                  .checked=${this._config?.menu?.buttons?.download ??
                  defaults.menu.buttons.download}
                  .configValue=${'menu.buttons.download'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <br />
              <ha-formfield
                .label=${localize('editor.show_button') +
                ': ' +
                localize('config.menu.buttons.frigate_ui')}
              >
                <ha-switch
                  .checked=${this._config?.menu?.buttons?.frigate_ui ??
                  defaults.menu.buttons.frigate_ui}
                  .configValue=${'menu.buttons.frigate_ui'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <br />
              <ha-formfield
                .label=${localize('editor.show_button') +
                ': ' +
                localize('config.menu.buttons.fullscreen')}
              >
                <ha-switch
                  .checked=${this._config?.menu?.buttons?.fullscreen ??
                  defaults.menu.buttons.fullscreen}
                  .configValue=${'menu.buttons.fullscreen'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <br />`
          : ''}
        <div class="option" @click=${this._toggleOption} .option=${'advanced'}>
          <div class="row">
            <ha-icon .icon=${`mdi:${options.advanced.icon}`}></ha-icon>
            <div class="title">${options.advanced.name}</div>
          </div>
          <div class="secondary">${options.advanced.secondary}</div>
        </div>
        ${options.advanced.show
          ? html` <div class="values">
                <paper-input
                  .label=${localize('config.frigate.label')}
                  .value=${this._config?.frigate?.label || ''}
                  .configValue=${'frigate.label'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
              </div>
              <div class="values">
                <paper-input
                  .label=${localize('config.frigate.zone')}
                  .value=${this._config?.frigate?.zone || ''}
                  .configValue=${'frigate.zone'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
              </div>`
          : ''}
        <div class="option" @click=${this._toggleOption} .option=${'webrtc'}>
          <div class="row">
            <ha-icon .icon=${`mdi:${options.webrtc.icon}`}></ha-icon>
            <div class="title">${options.webrtc.name}</div>
          </div>
          <div class="secondary">${options.webrtc.secondary}</div>
        </div>
        ${options.webrtc.show
          ? html` <div class="values">
              <paper-dropdown-menu
                .label=${localize('config.live.webrtc.entity')}
                @value-changed=${this._valueChanged}
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
                .value=${this._config?.live?.webrtc?.url || ''}
                .configValue=${'live.webrtc.url'}
                @value-changed=${this._valueChanged}
              ></paper-input>
            </div>`
          : ''}
      </div>
    `;
  }

  private _initialize(): void {
    if (this.hass === undefined) return;
    if (this._config === undefined) return;
    if (this._helpers === undefined) return;
    this._initialized = true;
  }

  private async loadCardHelpers(): Promise<void> {
    this._helpers = await (window as any).loadCardHelpers();
  }

  private _toggleOption(ev): void {
    this._toggleThing(ev, options);
  }

  private _toggleThing(ev, optionList): void {
    const show = !optionList[ev.target.option].show;
    for (const [key] of Object.entries(optionList)) {
      optionList[key].show = false;
    }
    optionList[ev.target.option].show = show;
    this._toggle = !this._toggle;
  }

  private _valueChanged(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;
    const value = target.value?.trim();
    let key: string = target.configValue;

    if (!key) {
      return;
    }

    // Need to deep copy the config so cannot use Object.assign.
    const newConfig = JSON.parse(JSON.stringify(this._config));
    let objectTarget = newConfig;

    if (key.includes('.')) {
      const parts = key.split('.');
      objectTarget = parts.slice(0, -1).reduce((obj, key) => {
        if (!(key in obj)) {
          obj[key] = {};
        }
        return obj[key];
      }, newConfig);
      key = parts[parts.length-1];
    }

    if (value !== undefined && objectTarget[key] === value) {
      return;
    } else if (value === '') {
      delete objectTarget[key];
    } else {
      objectTarget[key] = target.checked !== undefined ? target.checked : value;
    }
    this._config = newConfig;
    fireEvent(this, 'config-changed', { config: this._config });
  }

  // Return compiled CSS styles (thus safe to use with unsafeCSS).
  static get styles(): CSSResultGroup {
    return unsafeCSS(frigate_card_editor_style);
  }
}
