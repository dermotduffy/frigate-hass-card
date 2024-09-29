import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';
import { actionHandler } from '../action-handler-directive.js';
import { MenuController } from '../components-lib/menu-controller.js';
import type { MenuConfig, MenuItem } from '../config/types.js';
import menuStyle from '../scss/menu.scss';
import { frigateCardHasAction } from '../utils/action.js';
import { EntityRegistryManager } from '../utils/ha/registry/entity/index.js';
import './submenu.js';

@customElement('frigate-card-menu')
export class FrigateCardMenu extends LitElement {
  protected _controller = new MenuController(this);

  @property({ attribute: false })
  public entityRegistryManager?: EntityRegistryManager;

  @property({ attribute: false })
  public hass?: HomeAssistant;

  set menuConfig(menuConfig: MenuConfig) {
    this._controller.setMenuConfig(menuConfig);
  }

  set buttons(buttons: MenuItem[]) {
    this._controller.setButtons(buttons);
  }

  set expanded(expanded: boolean) {
    this._controller.setExpanded(expanded);
  }

  public toggleMenu(): void {
    this._controller.toggleExpanded();
  }

  protected _renderButton(button: MenuItem): TemplateResult | void {
    if (!this.hass) {
      return;
    }

    if (button.type === 'custom:frigate-card-menu-submenu') {
      return html` <frigate-card-submenu
        .hass=${this.hass}
        .submenu=${button}
        @action=${(ev) => this._controller.actionHandler(ev)}
      >
      </frigate-card-submenu>`;
    } else if (button.type === 'custom:frigate-card-menu-submenu-select') {
      return html` <frigate-card-submenu-select
        .hass=${this.hass}
        .submenuSelect=${button}
        .entityRegistryManager=${this.entityRegistryManager}
        @action=${(ev) => this._controller.actionHandler(ev)}
      >
      </frigate-card-submenu-select>`;
    }

    // =====================================================================================
    // For `data-domain` and `data-state`, see: See
    // https://github.com/home-assistant/frontend/blob/dev/src/components/entity/state-badge.ts#L54
    // =====================================================================================
    // Buttons are styled in a few ways (in order of precedence):
    //
    // - User provided style
    // - Color/Brightness styling for the `light` domain (calculated in
    //   `refreshDynamicStateParameters`)
    // - Static styling based on domain (`data-domain`) and state
    //   (`data-state`). This looks up a CSS style in `menu.scss`.

    const buttonState = this._controller.getFreshButtonState(this.hass, button);
    const svgPath = this._controller.getSVGPath(button);

    return html` <ha-icon-button
      data-domain=${ifDefined(buttonState.data_domain)}
      data-state=${ifDefined(buttonState.data_state)}
      class="button"
      style="${styleMap(buttonState.style || {})}"
      .actionHandler=${actionHandler({
        hasHold: frigateCardHasAction(button.hold_action),
        hasDoubleClick: frigateCardHasAction(button.double_tap_action),
      })}
      .label=${buttonState.title || ''}
      @action=${(ev) => this._controller.actionHandler(ev, button)}
    >
      ${svgPath
        ? html`<ha-svg-icon .path="${svgPath}"></ha-svg-icon>`
        : html`<ha-icon
            icon="${buttonState.icon || 'mdi:gesture-tap-button'}"
          ></ha-icon>`}
    </ha-icon-button>`;
  }

  protected render(): TemplateResult | void {
    const config = this._controller.getMenuConfig();
    const style = config?.style;
    if (!config || style === 'none') {
      return;
    }
    const matchingButtons = this._controller.getButtons('matching');
    const opposingButtons = this._controller.getButtons('opposing');

    return html` <div
        class="matching"
        style="${styleMap({ flex: String(matchingButtons.length) })}"
      >
        ${matchingButtons.map((button) => this._renderButton(button))}
      </div>
      <div
        class="opposing"
        style="${styleMap({ flex: String(opposingButtons.length) })}"
      >
        ${opposingButtons.map((button) => this._renderButton(button))}
      </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(menuStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-menu': FrigateCardMenu;
  }
}
