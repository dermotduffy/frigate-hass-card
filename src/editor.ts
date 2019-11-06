import { LitElement, html, customElement, property, TemplateResult, CSSResult, css } from 'lit-element';
import { HomeAssistant, fireEvent, LovelaceCardEditor, ActionConfig } from 'custom-card-helpers';

import { BoilerplateCardConfig } from './types';

const options = [
  {
    icon: 'tune',
    name: 'Required',
    secondary: 'Required options for this card to function',
    show: true,
  },
  {
    icon: 'gesture-tap-hold',
    name: 'Actions',
    secondary: 'Perform actions based on tapping/clicking',
    show: false,
  },
  {
    icon: 'palette',
    name: 'Appearance',
    secondary: 'Customize the name, icon, etc',
    show: false,
  },
];

@customElement('boilerplate-card-editor')
export class BoilerplateCardEditor extends LitElement implements LovelaceCardEditor {
  @property() public hass?: HomeAssistant;
  @property() private _config?: BoilerplateCardConfig;
  @property() private _toggle?: boolean;

  public setConfig(config: BoilerplateCardConfig): void {
    this._config = config;
  }

  get _name(): string {
    if (this._config) {
      return this._config.name || '';
    }

    return '';
  }

  get _entity(): string {
    if (this._config) {
      return this._config.entity || '';
    }

    return '';
  }

  get _show_warning(): boolean {
    if (this._config) {
      return this._config.show_warning || false;
    }

    return false;
  }

  get _show_error(): boolean {
    if (this._config) {
      return this._config.show_error || false;
    }

    return false;
  }

  get _tap_action(): ActionConfig {
    if (this._config) {
      return this._config.tap_aciton || { action: 'more-info' };
    }

    return { action: 'more-info' };
  }

  get _hold_action(): ActionConfig {
    if (this._config) {
      return this._config.hold_action || { action: 'none' };
    }

    return { action: 'none' };
  }

  get _double_tap_action(): ActionConfig {
    if (this._config) {
      return this._config.double_tap_action || { action: 'none' };
    }

    return { action: 'none' };
  }

  protected render(): TemplateResult | void {
    if (!this.hass) {
      return html``;
    }

    // You can restrict on domain type
    const entities = Object.keys(this.hass.states).filter(eid => eid.substr(0, eid.indexOf('.')) === 'sun');

    return html`
      <div class="card-config">
        <div class="option" @click=${this._toggleOption} .index=${0}>
          <div class="row">
            <ha-icon .icon=${`mdi:${options[0].icon}`}></ha-icon>
            <div class="title">${options[0].name}</div>
          </div>
          <div class="secondary">${options[0].secondary}</div>
        </div>
        ${options[0].show
          ? html`
              <div class="values">
                <paper-dropdown-menu
                  label="Entity (Required)"
                  @value-changed=${this._valueChanged}
                  .configValue=${'entity'}
                >
                  <paper-listbox slot="dropdown-content" .selected=${entities.indexOf(this._entity)}>
                    ${entities.map(entity => {
                      return html`
                        <paper-item>${entity}</paper-item>
                      `;
                    })}
                  </paper-listbox>
                </paper-dropdown-menu>
              </div>
            `
          : ''}
        <div class="option" @click=${this._toggleOption} .index=${1}>
          <div class="row">
            <ha-icon .icon=${`mdi:${options[1].icon}`}></ha-icon>
            <div class="title">${options[1].name}</div>
          </div>
          <div class="secondary">${options[1].secondary}</div>
        </div>
        ${options[1].show
          ? html`
              <div class="values">
                <paper-item>Action Editors Coming Soon</paper-item>
              </div>
            `
          : ''}
        <div class="option" @click=${this._toggleOption} .index=${2}>
          <div class="row">
            <ha-icon .icon=${`mdi:${options[2].icon}`}></ha-icon>
            <div class="title">${options[2].name}</div>
          </div>
          <div class="secondary">${options[2].secondary}</div>
        </div>
        ${options[2].show
          ? html`
              <div class="values">
                <paper-input
                  label="Name (Optional)"
                  .value=${this._name}
                  .configValue=${'name'}
                  @value-changed=${this._valueChanged}
                ></paper-input>
                <br />
                <ha-switch
                  aria-label=${`Toggle warning ${this._show_warning ? 'off' : 'on'}`}
                  .checked=${this._show_warning !== false}
                  .configValue=${'show_warning'}
                  @change=${this._valueChanged}
                  >Show Warning?</ha-switch
                >
                <ha-switch
                  aria-label=${`Toggle error ${this._show_error ? 'off' : 'on'}`}
                  .checked=${this._show_error !== false}
                  .configValue=${'show_error'}
                  @change=${this._valueChanged}
                  >Show Error?</ha-switch
                >
              </div>
            `
          : ''}
      </div>
    `;
  }

  private _toggleOption(ev): void {
    console.log(options[ev.target.index]);
    const show = !options[ev.target.index].show;
    options.forEach(option => (option.show = false));
    options[ev.target.index].show = show;
    this._toggle = !this._toggle;
  }

  private _valueChanged(ev): void {
    if (!this._config || !this.hass) {
      return;
    }
    const target = ev.target;
    if (this[`_${target.configValue}`] === target.value) {
      return;
    }
    if (target.configValue) {
      if (target.value === '') {
        delete this._config[target.configValue];
      } else {
        this._config = {
          ...this._config,
          [target.configValue]: target.checked !== undefined ? target.checked : target.value,
        };
      }
    }
    fireEvent(this, 'config-changed', { config: this._config });
  }

  static get styles(): CSSResult {
    return css`
      .option {
        padding: 4px 0px;
        cursor: pointer;
      }
      .row {
        display: flex;
        margin-bottom: -14px;
        pointer-events: none;
      }
      .title {
        padding-left: 16px;
        margin-top: -6px;
        pointer-events: none;
      }
      .secondary {
        padding-left: 40px;
        color: var(--secondary-text-color);
        pointer-events: none;
      }
      .values {
        padding-left: 16px;
        background: var(--secondary-background-color);
      }
      ha-switch {
        padding-bottom: 8px;
      }
    `;
  }
}
