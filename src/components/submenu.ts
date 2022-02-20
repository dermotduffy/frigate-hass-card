import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { customElement, property } from 'lit/decorators';
import { frigateCardHasAction, refreshDynamicStateParameters } from '../common.js';
import { ifDefined } from 'lit/directives/if-defined';
import { styleMap } from 'lit/directives/style-map';

import { ExtendedHomeAssistant, MenuSubmenu, MenuSubmenuItem } from '../types.js';
import { actionHandler } from '../action-handler-directive.js';

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
          hasHold: frigateCardHasAction(item.hold_action),
          hasDoubleClick: frigateCardHasAction(item.double_tap_action),
        })}
      >
        ${stateParameters.title || ''}
        ${stateParameters.icon
          ? html` <ha-icon
              data-domain=${ifDefined(stateParameters.data_domain)}
              data-state=${ifDefined(stateParameters.data_state)}
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
        @closed=${
          // Prevent the submenu closing from closing anything upstream (e.g.
          // selecting a submenu in the editor dialog should not close the
          // editor, see https://github.com/dermotduffy/frigate-hass-card/issues/377).
          (ev) => ev.stopPropagation()
        }
      >
        <ha-icon-button
          style="${styleMap(this.submenu.style || {})}"
          class="button"
          slot="trigger"
          .label=${this.submenu.title || ''}
          .actionHandler=${actionHandler({
            hasHold: frigateCardHasAction(this.submenu.hold_action),
            hasDoubleClick: frigateCardHasAction(this.submenu.double_tap_action),
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
