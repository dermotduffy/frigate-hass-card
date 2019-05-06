import {
  LitElement,
  html,
  customElement,
  property,
  CSSResult,
  TemplateResult,
  css,
  PropertyValues
} from "lit-element";
import {
  HomeAssistant,
  handleClick,
  longPress,
  hasConfigOrEntityChanged
} from "custom-card-helpers";

import { BoilerplateConfig } from "./types";

// TODO Name your custom element
@customElement("boilerplate-card")
class BoilerplateCard extends LitElement {
  // TODO Add any properities that should cause your element to re-render here
  @property() public hass?: HomeAssistant;

  @property() private _config?: BoilerplateConfig;

  public setConfig(config: BoilerplateConfig): void {
    // TODO Check for required fields and that they are of the proper format
    if (!config || config.show_error) {
      throw new Error("Invalid configuration");
    }

    this._config = config;
  }

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    return hasConfigOrEntityChanged(this, changedProps);
  }

  protected render(): TemplateResult | void {
    if (!this._config || !this.hass) {
      return html``;
    }

    // TODO Check for stateObj or other necessary things and render a warning if missing
    if (this._config.show_warning) {
      return html`
        <ha-card>
          <div class="warning">Show Warning</div>
        </ha-card>
      `;
    }

    return html`
      <ha-card
        .header=${this._config.name ? this._config.name : "Boilerplate"}
        @ha-click="${this._handleTap}"
        @ha-hold="${this._handleHold}"
        .longpress="${longPress()}"
      ></ha-card>
    `;
  }

  private _handleTap(): void {
    handleClick(this, this.hass!, this._config!, false);
  }

  private _handleHold(): void {
    handleClick(this, this.hass!, this._config!, true);
  }

  static get styles(): CSSResult {
    return css`
      .warning {
        display: block;
        color: black;
        background-color: #fce588;
        padding: 8px;
      }
    `;
  }
}
