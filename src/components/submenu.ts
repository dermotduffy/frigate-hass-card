import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators';

import { actionHandler } from '../action-handler-directive.js';
import { MenuSubmenu } from '../types.js';

import submenuStyle from '../scss/submenu.scss';
import { hasAction } from 'custom-card-helpers';
import { styleMap } from 'lit/directives/style-map';

@customElement('frigate-card-submenu')
export class FrigateCardSubmenu extends LitElement {
  @property({ attribute: false })
  public submenu?: MenuSubmenu;

  protected render(): TemplateResult {
    if (!this.submenu) {
      return html``;
    }
    return html`
      <ha-button-menu corner="BOTTOM_LEFT">
        <ha-icon-button
          style="${styleMap(this.submenu.style || {})}"
          class="button"
          slot="trigger"
          .label=${this.submenu.title || ''}
          .actionHandler=${actionHandler({
            hasHold: hasAction(this.submenu.hold_action),
            hasDoubleClick: hasAction(this.submenu.double_tap_action),
          })}
        >
          <ha-icon icon="${this.submenu.icon}"></ha-icon>
        </ha-icon-button>
        ${this.submenu.items.map(
          (item) => html`
            <mwc-list-item
              style="${styleMap(item.style || {})}"
              graphic="icon"
              aria-label="${item.title || ''}"
              @action=${(ev) => {
                // Attach the action config so ascendants have access to it.
                ev.detail.config = item;
              }}
              .actionHandler=${actionHandler({
                hasHold: hasAction(item.hold_action),
                hasDoubleClick: hasAction(item.double_tap_action),
              })}
            >
              ${item.title || ''}
              ${item.icon
                ? html` <ha-icon
                    style="${styleMap(item.style || {})}"
                    slot="graphic"
                    icon="${item.icon}"
                  >
                  </ha-icon>`
                : ``}
            </mwc-list-item>
          `,
        )}
      </ha-button-menu>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(submenuStyle);
  }
}
