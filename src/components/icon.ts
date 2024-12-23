import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { IconController } from '../components-lib/icon-controller';
import iconStyle from '../scss/icon.scss';
import { Icon } from '../types';

@customElement('frigate-card-icon')
export class FrigateCardIcon extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public icon?: Icon;

  private _controller = new IconController();

  protected render(): TemplateResult {
    const customIconURL = this._controller.getCustomIcon(this.icon);
    if (customIconURL) {
      return html`<img src="${customIconURL}" />`;
    }
    if (this.icon?.icon) {
      return html`<ha-icon icon="${this.icon.icon}"></ha-icon>`;
    }
    if (this.hass && this.icon?.entity) {
      const stateObj = this._controller.createStateObjectForStateBadge(
        this.hass,
        this.icon.entity,
      );
      if (stateObj) {
        return html`<state-badge
          .stateColor=${this.icon.stateColor ?? true}
          .hass=${this.hass}
          .stateObj=${stateObj}
        ></state-badge>`;
      }
    }
    if (this.icon?.fallback) {
      return html`<ha-icon icon="${this.icon.fallback}"></ha-icon>`;
    }
    return html``;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(iconStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-icon': FrigateCardIcon;
  }
}
