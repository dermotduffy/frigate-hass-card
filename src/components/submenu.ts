import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators';
import { hasAction, HomeAssistant } from 'custom-card-helpers';
import { styleMap } from 'lit/directives/style-map';

import { ExtendedHomeAssistant, MenuSubmenu, MenuSubmenuItem } from '../types.js';
import { actionHandler } from '../action-handler-directive.js';
import { refreshDynamicStateParameters } from '../common.js';

import submenuStyle from '../scss/submenu.scss';
import type { Corner } from "@material/mwc-menu";

@customElement('frigate-card-submenu')
export class FrigateCardSubmenu extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  public submenu?: MenuSubmenu;

  @property({ attribute: false })
  public corner?: Corner;

  protected _renderItem(item: MenuSubmenuItem): TemplateResult | void {
    if (!this.hass) {
      return;
    }
    const stateParameters = refreshDynamicStateParameters(this.hass, {...item});

    return html`
      <mwc-list-item
        style="${styleMap(stateParameters.style || {})}"
        graphic="icon"
        ?selected=${item.selected}
        ?activated=${item.selected}
        aria-label="${stateParameters.title || ''}"
        @action=${(ev) => {
          // Attach the action config so ascendants have access to it.
          ev.detail.config = item;
        }}
        .actionHandler=${actionHandler({
          hasHold: hasAction(item.hold_action),
          hasDoubleClick: hasAction(item.double_tap_action),
        })}
      >
        ${stateParameters.title || ''}
        ${stateParameters.icon
          ? html` <ha-icon
              style="${styleMap(stateParameters.style || {})}"
              slot="graphic"
              icon="${stateParameters.icon}"
            >
            </ha-icon>`
          : ``}
      </mwc-list-item>
    `;
  }

  protected render(): TemplateResult {
    if (!this.submenu) {
      return html``;
    }

    return html`
      <ha-button-menu
        corner=${this.corner || "BOTTOM_LEFT"}
      >
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
        ${this.submenu.items.map(this._renderItem.bind(this))}
      </ha-button-menu>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(submenuStyle);
  }
}
