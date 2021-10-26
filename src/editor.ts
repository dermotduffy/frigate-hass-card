/* eslint-disable @typescript-eslint/no-explicit-any */
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { HomeAssistant, LovelaceCardEditor, fireEvent } from 'custom-card-helpers';
import { localize } from './localize/localize.js';
import type { FrigateCardConfig } from './types.js';

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

    // The climate more-info has ha-switch and paper-dropdown-menu elements that are lazy loaded unless explicitly done here
    this._helpers.importMoreInfoControl('climate');

    // You can restrict on domain type
    const cameraEntities = this._getEntities('camera');

    const webrtcCameraEntity =
      this._config?.webrtc && (this._config?.webrtc as any).entity
        ? (this._config?.webrtc as any).entity
        : '';

    const viewModes = {
      '': '',
      live: localize('menu.live'),
      clips: localize('menu.clips'),
      snapshots: localize('menu.snapshots'),
      clip: localize('menu.clip'),
      snapshot: localize('menu.snapshot'),
      image: localize('menu.image'),
    };

    const menuModes = {
      '': '',
      none: localize('menu_mode.none'),
      'hidden-top': localize('menu_mode.hidden-top'),
      'hidden-left': localize('menu_mode.hidden-left'),
      'hidden-bottom': localize('menu_mode.hidden-bottom'),
      'hidden-right': localize('menu_mode.hidden-right'),
      'overlay-top': localize('menu_mode.overlay-top'),
      'overlay-left': localize('menu_mode.overlay-left'),
      'overlay-bottom': localize('menu_mode.overlay-bottom'),
      'overlay-right': localize('menu_mode.overlay-right'),
      'hover-top': localize('menu_mode.hover-top'),
      'hover-left': localize('menu_mode.hover-left'),
      'hover-bottom': localize('menu_mode.hover-bottom'),
      'hover-right': localize('menu_mode.hover-right'),
      above: localize('menu_mode.above'),
      below: localize('menu_mode.below'),
    };

    const liveProvider = {
      '': '',
      frigate: localize('live_provider.frigate'),
      'frigate-jsmpeg': localize('live_provider.frigate-jsmpeg'),
      webrtc: localize('live_provider.webrtc'),
    };

    const controlsNextPrev = {
      '': '',
      thumbnails: localize('control.thumbnails'),
      chevrons: localize('control.chevrons'),
      none: localize('control.none'),
    };

    const aspectRatioModes = {
      '': '',
      dynamic: localize('aspect_ratio_mode.dynamic'),
      static: localize('aspect_ratio_mode.static'),
      unconstrained: localize('aspect_ratio_mode.unconstrained'),
    }

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
                  label=${localize('editor.camera_entity')}
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
                  label=${localize('editor.frigate_camera_name')}
                  .value=${this._config?.frigate_camera_name || ''}
                  .configValue=${'frigate_camera_name'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
                <paper-dropdown-menu
                  label=${localize('editor.default_view')}
                  @value-changed=${this._valueChanged}
                  .configValue=${'view_default'}
                >
                <paper-listbox
                  slot="dropdown-content"
                  .selected=${Object.keys(viewModes).indexOf(
                    this._config?.view_default || '',
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
                .label=${localize('editor.live_provider')}
                @value-changed=${this._valueChanged}
                .configValue=${'live_provider'}
              >
                <paper-listbox
                  slot="dropdown-content"
                  .selected=${Object.keys(liveProvider).indexOf(
                    this._config?.live_provider || '',
                  )}
                >
                  ${Object.keys(liveProvider).map((key) => {
                    return html`
                      <paper-item .label="${key}">${liveProvider[key]} </paper-item>
                    `;
                  })}
                </paper-listbox>
              </paper-dropdown-menu>
              <paper-input
                label=${localize('editor.frigate_client_id')}
                .value=${this._config?.frigate_client_id || ''}
                .configValue=${'frigate_client_id'}
                @value-changed=${this._valueChanged}
              ></paper-input>
              <paper-input
                label=${localize('editor.view_timeout')}
                prevent-invalid-input
                allowed-pattern="[0-9]"
                .value=${this._config?.view_timeout
                  ? String(this._config.view_timeout)
                  : ''}
                .configValue=${'view_timeout'}
                @value-changed=${this._valueChanged}
              ></paper-input>
              <paper-input
                label=${localize('editor.frigate_url')}
                .value=${this._config?.frigate_url || ''}
                .configValue=${'frigate_url'}
                @value-changed=${this._valueChanged}
              ></paper-input>
              <ha-formfield .label=${localize('editor.autoplay_clip')}>
                <ha-switch
                  .checked=${this._config?.autoplay_clip === true}
                  .configValue=${'autoplay_clip'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <ha-formfield .label=${localize('editor.live_preload')}>
                <ha-switch
                  .checked=${this._config?.live_preload === true}
                  .configValue=${'live_preload'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <ha-formfield .label=${localize('editor.lazy_load')}>
                <ha-switch
                  .checked=${this._config?.event_viewer?.lazy_load !== false}
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
                .label=${localize('editor.menu_mode')}
                @value-changed=${this._valueChanged}
                .configValue=${'menu_mode'}
              >
                <paper-listbox
                  slot="dropdown-content"
                  .selected=${Object.keys(menuModes).indexOf(
                    this._config?.menu_mode || '',
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
                .label=${localize('control.nextprev')}
                @value-changed=${this._valueChanged}
                .configValue=${'controls.nextprev'}
              >
                <paper-listbox
                  slot="dropdown-content"
                  .selected=${Object.keys(controlsNextPrev).indexOf(
                    this._config?.controls?.nextprev || '',
                  )}
                >
                  ${Object.keys(controlsNextPrev).map((key) => {
                    return html`
                      <paper-item .label="${key}"> ${controlsNextPrev[key]} </paper-item>
                    `;
                  })}
                </paper-listbox>
              </paper-dropdown-menu>
              <br />
              <paper-dropdown-menu
                .label=${localize('dimensions.aspect_ratio_mode')}
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
                label=${localize('dimensions.aspect_ratio')}
                prevent-invalid-input
                .value=${this._config?.dimensions?.aspect_ratio
                  ? String(this._config?.dimensions?.aspect_ratio)
                  : ''}
                .configValue=${'dimensions.aspect_ratio'}
                @value-changed=${this._valueChanged}
              ></paper-input>
              <paper-input
                label=${localize('editor.image')}
                prevent-invalid-input
                .value=${this._config?.image
                  ? String(this._config?.image)
                  : ''}
                .configValue=${'image'}
                @value-changed=${this._valueChanged}
              ></paper-input>
              <ha-formfield
                .label=${localize('editor.show_button') +
                ': ' +
                localize('menu.frigate')}
              >
                <ha-switch
                  .checked=${this._config?.menu_buttons?.frigate ?? true}
                  .configValue=${'menu_buttons.frigate'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <br />
              <ha-formfield
                .label=${localize('editor.show_button') + ': ' + localize('menu.live')}
              >
                <ha-switch
                  .checked=${this._config?.menu_buttons?.live ?? true}
                  .configValue=${'menu_buttons.live'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <br />
              <ha-formfield
                .label=${localize('editor.show_button') + ': ' + localize('menu.clips')}
              >
                <ha-switch
                  .checked=${this._config?.menu_buttons?.clips ?? true}
                  .configValue=${'menu_buttons.clips'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <br />
              <ha-formfield
                .label=${localize('editor.show_button') +
                ': ' +
                localize('menu.snapshots')}
              >
                <ha-switch
                  .checked=${this._config?.menu_buttons?.snapshots ?? true}
                  .configValue=${'menu_buttons.snapshots'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <br />
              <ha-formfield
                .label=${localize('editor.show_button') +
                ': ' +
                localize('menu.image')}
              >
                <ha-switch
                  .checked=${this._config?.menu_buttons?.image ?? false}
                  .configValue=${'menu_buttons.image'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <br />
              <ha-formfield
                .label=${localize('editor.show_button') +
                ': ' +
                localize('menu.frigate_ui')}
              >
                <ha-switch
                  .checked=${this._config?.menu_buttons?.frigate_ui ?? true}
                  .configValue=${'menu_buttons.frigate_ui'}
                  @change=${this._valueChanged}
                ></ha-switch>
              </ha-formfield>
              <br />
              <ha-formfield
                .label=${localize('editor.show_button') +
                ': ' +
                localize('menu.fullscreen')}
              >
                <ha-switch
                  .checked=${this._config?.menu_buttons?.frigate_ui ?? true}
                  .configValue=${'menu_buttons.fullscreen'}
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
                  .label=${localize('editor.zone')}
                  .value=${this._config?.zone || ''}
                  .configValue=${'zone'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
              </div>
              <div class="values">
                <paper-input
                  .label=${localize('editor.label')}
                  .value=${this._config?.label || ''}
                  .configValue=${'label'}
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
                .label=${localize('webrtc.entity')}
                @value-changed=${this._valueChanged}
                .configValue=${'webrtc.entity'}
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
                  label=${localize('webrtc.url')}
                  .value=${this._config?.webrtc?.url || ''}
                  .configValue=${'webrtc.url'}
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
      const parts = key.split('.', 2);
      const configName = parts[0];
      if (!(configName in newConfig)) {
        newConfig[configName] = {};
      }
      objectTarget = newConfig[configName];
      key = parts[1];
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
