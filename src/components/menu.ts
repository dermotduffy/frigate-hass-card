import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { actionHandler } from '../action-handler-directive.js';
import { MenuController } from '../components-lib/menu-controller.js';
import type { MenuConfig, MenuItem } from '../config/types.js';
import menuStyle from '../scss/menu.scss';
import { frigateCardHasAction } from '../utils/action.js';
import { getEntityTitle } from '../utils/ha/index.js';
import { EntityRegistryManager } from '../utils/ha/registry/entity/index.js';
import './icon.js';
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

    const title =
      this.hass && button.type === 'custom:frigate-card-menu-state-icon' && !button.title
        ? getEntityTitle(this.hass, button.entity)
        : button.title;

    return html` <ha-icon-button
      class="button"
      style="${styleMap(button.style || {})}"
      .actionHandler=${actionHandler({
        hasHold: frigateCardHasAction(button.hold_action),
        hasDoubleClick: frigateCardHasAction(button.double_tap_action),
      })}
      .label=${title ?? ''}
      @action=${(ev) => this._controller.actionHandler(ev, button)}
    >
      <frigate-card-icon
        .hass=${this.hass}
        .icon=${{
          icon: button.icon,
          entity: button.entity,
          stateColor: button.state_color,
          fallback: 'mdi:gesture-tap-button',
        }}
      ></frigate-card-icon>
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
