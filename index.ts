import {
  LitElement,
  html,
  customElement,
  property,
  CSSResult,
  TemplateResult,
  css
} from "lit-element";

interface BOILERPLATEConfig {
  type: string;
}

@customElement("BOILERPLATE-card")
class BOILERPLATECard extends LitElement {
  @property() public hass?: any;
  @property() private _config?: BOILERPLATEConfig;

  public setConfig(config: BOILERPLATEConfig): void {
    if (!this._config) {
      // TODO Log error
    }

    this._config = config;
  }

  protected render(): TemplateResult {
    return html`
      <div>BOILERPLATE</div>
    `;
  }

  static get styles(): CSSResult {
    return css``;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    "BOILERPLATE-card": BOILERPLATECard;
  }
}
