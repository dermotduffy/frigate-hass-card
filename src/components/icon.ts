import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
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
    const style = styleMap(this.icon?.style || {});

    if (customIconURL) {
      return html`<img style="${style}" src="${customIconURL}" />`;
    }
    if (this.icon?.icon) {
      return html`<ha-icon style="${style}" icon="${this.icon.icon}"></ha-icon>`;
    }
    if (this.hass && this.icon?.entity) {
      const stateObj = this._controller.createStateObjectForStateBadge(
        this.hass,
        this.icon.entity,
      );
      if (stateObj) {
        // As a special case, need to pass in a color in order for the state
        // color to be overridden.
        return html`<state-badge
          style="${style}"
          .color="${this.icon.style?.color ?? undefined}"
          .stateColor=${this.icon.stateColor ?? true}
          .hass=${this.hass}
          .stateObj=${stateObj}
        ></state-badge>`;
      }
    }
    if (this.icon?.fallback) {
      return html`<ha-icon style="${style}" icon="${this.icon.fallback}"></ha-icon>`;
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
