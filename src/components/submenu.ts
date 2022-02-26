import type { Corner, Menu } from '@material/mwc-menu';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { customElement, property, query } from 'lit/decorators';
import { frigateCardHasAction, refreshDynamicStateParameters } from '../common.js';
import { ifDefined } from 'lit/directives/if-defined';
import { styleMap } from 'lit/directives/style-map';

import { ExtendedHomeAssistant, MenuSubmenu, MenuSubmenuItem } from '../types.js';
import { actionHandler } from '../action-handler-directive.js';

import submenuStyle from '../scss/submenu.scss';

@customElement('frigate-card-submenu')
export class FrigateCardSubmenu extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  public submenu?: MenuSubmenu;

  @property({ attribute: false })
  public corner?: Corner;

  @query('mwc-menu') private _menu?: Menu;

  protected _renderItem(item: MenuSubmenuItem): TemplateResult | void {
    if (!this.hass) {
      return;
    }
    const stateParameters = refreshDynamicStateParameters(this.hass, { ...item });

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

  /**
   * Get the fixed root element in which fixed elements are positioned against.
   * @returns The fixed root element or null if not found.
   */
  protected _getFixedRoot(): HTMLElement | null {
    let n = this as Node | null;
    while (n) {
      if (n.nodeType === Node.ELEMENT_NODE && (n as Element).tagName === 'HA-APP-LAYOUT') {
        return n as HTMLElement;
      }
      n = n.parentNode
        ? n.parentNode
        : n.nodeType === Node.DOCUMENT_FRAGMENT_NODE
        ? (n as ShadowRoot).host
        : null;
    }
    return null;
  }

  protected render(): TemplateResult {
    if (!this.submenu) {
      return html``;
    }
    return html`
      <ha-icon-button
        style="${styleMap(this.submenu.style || {})}"
        class="button"
        .label=${this.submenu.title || ''}
        .actionHandler=${actionHandler({
          hasHold: frigateCardHasAction(this.submenu.hold_action),
          hasDoubleClick: frigateCardHasAction(this.submenu.double_tap_action),
        })}
        @click=${() => {
          if (this._menu) {
            // Hack: This insanity is brought about by lack of MWCMenu playing
            // nicely with the Home Assistant view/sidepanel. The menu must be
            // rendered in fixed mode in order to allow the menu to render
            // outside of the card boundaries (card has overflow as hidden).
            // When in fixed mode, the menu anchoring refuses to get the
            // placement correct -- it's always off by exactly the dimensions of
            // the sidebar/header. To work around this we iterate up the DOM to
            // find the main root (excl. the sidebar) and subtract those
            // dimensions off wherever the menu believes it should render.
            this._menu.anchor = this;
            const root = this._getFixedRoot();
            if (root) {
              const rootPosition = root.getBoundingClientRect();
              this._menu.x = -rootPosition.x;
              this._menu.y = -rootPosition.y;
            } else {
              this._menu.x = 0;
              this._menu.y = 0;
            }
            this._menu.show();
          }
        }}
      >
        <ha-icon icon="${this.submenu.icon}"></ha-icon>
      </ha-icon-button>
      <mwc-menu
        .corner=${this.corner || "BOTTOM_LEFT"}
        fixed
        @closed=${
          // Prevent the submenu closing from closing anything upstream (e.g.
          // selecting a submenu in the editor dialog should not close the
          // editor, see https://github.com/dermotduffy/frigate-hass-card/issues/377).
          (ev) => ev.stopPropagation()
        }
      >
        ${this.submenu.items.map(this._renderItem.bind(this))}
      </mwc-menu>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(submenuStyle);
  }
}
