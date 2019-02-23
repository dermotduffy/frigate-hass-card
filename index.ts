import {
  LitElement,
  html,
  customElement,
  property,
  CSSResult,
  TemplateResult,
  css
} from "lit-element";

interface BoilerplateConfig {
  type: string;
}

@customElement("boilerplate-card")
class BoilerplateCard extends LitElement {
  @property() public hass?: any;
  @property() private _config?: BoilerplateConfig;

  public setConfig(config: BoilerplateConfig): void {
    if (!this._config) {
      // TODO Log error
    }

    this._config = config;
  }

  protected render(): TemplateResult | void {
    if (!this._config || !this.hass) {
      return html``;
    }

    return html`
      <div>boilerplate</div>
    `;
  }

  static get styles(): CSSResult {
    return css``;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "boilerplate-card": BoilerplateCard;
  }
}
