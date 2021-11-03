import { HassEntity } from 'home-assistant-js-websocket';
import { HomeAssistant, hasAction, stateIcon } from 'custom-card-helpers';
import {
  CSSResultGroup,
  LitElement,
  TemplateResult,
  html,
  unsafeCSS,
  PropertyValues,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import { actionHandler } from '../action-handler-directive.js';

import type {
  ExtendedHomeAssistant,
  MenuButton,
  MenuConfig,
  MenuInteraction,
} from '../types.js';
import { dispatchFrigateCardEvent, shouldUpdateBasedOnHass } from '../common.js';

import menuStyle from '../scss/menu.scss';

export const MENU_HEIGHT = 46;

// A menu for the Frigate card.
@customElement('frigate-card-menu')
export class FrigateCardMenu extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  set menuConfig(menuConfig: MenuConfig) {
    this._menuConfig = menuConfig;
    if (menuConfig) {
      this.style.setProperty('--frigate-card-menu-button-size', menuConfig.button_size);
    }
  }
  public _menuConfig?: MenuConfig;

  @property({ attribute: false })
  protected expand = false;

  @property({ attribute: false })
  public buttons: MenuButton[] = [];

  protected _interactionHandler(ev: CustomEvent, button: MenuButton): void {
    if (this._menuConfig?.mode.startsWith('hidden-')) {
      if (button.type == 'internal-menu-icon' && button.tap_action === 'frigate') {
        this.expand = !this.expand;
        return;
      }
      // Collapse menu after the user clicks on something.
      this.expand = false;
    }

    dispatchFrigateCardEvent<MenuInteraction>(this, 'menu-interaction', {
      interaction: ev.detail.action,
      button: button,
    });
  }

  // Determine whether the menu should be updated.
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    const oldHass = changedProps.get('hass') as HomeAssistant | undefined;

    if (changedProps.size > 1 || !oldHass) {
      return true;
    }

    // Extract the entities the menu rendering depends on (if any).
    const entities: string[] = [];
    for (let i = 0; i < this.buttons.length; i++) {
      const button = this.buttons[i];
      if (button.type == 'custom:frigate-card-menu-state-icon') {
        entities.push(button.entity);
      }
    }
    return shouldUpdateBasedOnHass(this.hass, oldHass, entities);
  }

  // Render a menu button.
  protected _renderButton(button: MenuButton): TemplateResult | void {
    let state: HassEntity | null = null;
    let emphasize = false;
    let title = button.title;
    let icon = button.icon;
    const style = ('style' in button ? button.style : {}) || {};

    if (button.type === 'custom:frigate-card-menu-state-icon') {
      if (!this.hass) {
        return;
      }
      state = this.hass.states[button.entity];
      emphasize =
        !!state && button.state_color && ['on', 'active', 'home'].includes(state.state);
      title = title ?? (state?.attributes?.friendly_name || button.entity);
      icon = icon ?? stateIcon(state);
    } else if (button.type === 'internal-menu-icon') {
      emphasize = button.emphasize ?? false;
    }

    let hasHold = false;
    let hasDoubleClick = false;

    if (button.type != 'internal-menu-icon') {
      hasHold = hasAction(button.hold_action);
      hasDoubleClick = hasAction(button.double_tap_action);
    }

    const classes = {
      button: true,
      emphasize: emphasize,
    };

    // TODO: Upon a safe distance from the release of HA 2021.11 these
    // attributes can be removed from the <ha-icon-button>.
    // - icon (replaced with the embedded <ha-icon>)
    // - title (replaced with .label)
    return html` <ha-icon-button
      class="${classMap(classes)}"
      style="${styleMap(style)}"
      icon=${icon || 'mdi:gesture-tap-button'}
      .label=${title || ''}
      title=${title || ''}
      @action=${(ev) => this._interactionHandler(ev, button)}
      .actionHandler=${actionHandler({
        hasHold: hasHold,
        hasDoubleClick: hasDoubleClick,
      })}
    >
      <ha-icon icon="${icon || 'mdi:gesture-tap-button'}"></ha-icon>
    </ha-icon-button>`;
  }

  // Render the Frigate menu button.
  protected _renderFrigateButton(button: MenuButton): TemplateResult | void {
    const icon =
      this._menuConfig?.mode.startsWith('hidden-') && !this.expand
        ? 'mdi:alpha-f-box-outline'
        : 'mdi:alpha-f-box';

    return this._renderButton(Object.assign({}, button, { icon: icon }));
  }

  // Render the menu.
  protected render(): TemplateResult | void {
    if (!this._menuConfig) {
      return;
    }
    const mode = this._menuConfig.mode;

    const isFrigateButton = function (button: MenuButton): boolean {
      return button.type === 'internal-menu-icon' && button.tap_action === 'frigate';
    };

    // If the menu is off, or if it's in hidden mode but there's no button to
    // unhide it, just show nothing.
    if (
      mode == 'none' ||
      (mode.startsWith('hidden-') && !this.buttons.find(isFrigateButton))
    ) {
      return;
    }

    const classes = {
      'frigate-card-menu': true,
      'overlay-hidden':
        mode.startsWith('hidden-') ||
        mode.startsWith('overlay-') ||
        mode.startsWith('hover-'),
      'expanded-horizontal':
        (mode.startsWith('overlay-') || mode.startsWith('hover-') || this.expand) &&
        (mode.endsWith('-top') || mode.endsWith('-bottom')),
      'expanded-vertical':
        (mode.startsWith('overlay-') || mode.startsWith('hover-') || this.expand) &&
        (mode.endsWith('-left') || mode.endsWith('-right')),
      full: mode == 'above' || mode == 'below',
      left: mode.endsWith('-left'),
      right: mode.endsWith('-right'),
      top: mode.endsWith('-top'),
      bottom: mode.endsWith('-bottom'),
    };

    return html`
      <div class=${classMap(classes)}>
        ${Array.from(this.buttons).map((button) => {
          return isFrigateButton(button)
            ? this._renderFrigateButton(button)
            : this._renderButton(button);
        })}
      </div>
    `;
  }

  // Return compiled CSS styles (thus safe to use with unsafeCSS).
  static get styles(): CSSResultGroup {
    return unsafeCSS(menuStyle);
  }
}
