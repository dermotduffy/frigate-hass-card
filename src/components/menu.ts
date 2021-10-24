import { HassEntity } from 'home-assistant-js-websocket';
import { HomeAssistant, hasAction, stateIcon } from 'custom-card-helpers';
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS, PropertyValues } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import { actionHandler } from '../action-handler-directive.js';

import type { ExtendedHomeAssistant, FrigateMenuMode } from '../types.js';
import { MenuButton } from '../types.js';
import { shouldUpdateBasedOnHass } from '../common.js';

import menuStyle from '../scss/menu.scss';

type FrigateCardMenuCallback = (name: string, button: MenuButton) => void;

export const MENU_HEIGHT = 46;

// A menu for the Frigate card.
@customElement('frigate-card-menu')
export class FrigateCardMenu extends LitElement {
  @property({ attribute: false })
  public hass!: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected menuMode: FrigateMenuMode = 'hidden-top';

  @property({ attribute: false })
  protected expand = false;

  @property({ attribute: false })
  protected actionCallback: FrigateCardMenuCallback | null = null;

  @property({ attribute: false })
  public buttons: MenuButton[] = [];

  // Call the callback.
  protected _callAction(ev: CustomEvent, button: MenuButton): void {
    if (this.menuMode.startsWith('hidden-')) {
      if (button.type == 'internal-menu-icon' && button.card_action === 'frigate') {
        this.expand = !this.expand;
        return;
      }
      // Collapse menu after the user clicks on something.
      this.expand = false;
    }

    if (this.actionCallback) {
      this.actionCallback(ev.detail.action, button);
    }
  }

  // Determine whether the menu should be updated.
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    const oldHass = changedProps.get('hass') as HomeAssistant | undefined;

    if (changedProps.size > 1 || !oldHass) {
      return true;
    }

    // Extract the entities the menu rendering depends on (if any).
    const entities: string[] = []
    for (let i = 0; i < this.buttons.length; i++) {
      const button = this.buttons[i];
      if (button.type == 'custom:frigate-card-menu-state-icon') {
        entities.push(button.entity);
      }
    }
    return shouldUpdateBasedOnHass(this.hass, oldHass, entities);
  }

  // Render a menu button.
  protected _renderButton(button: MenuButton): TemplateResult {
    let state: HassEntity | null = null;
    let emphasize = false;
    let title = button.title;
    let icon = button.icon;
    const style = ('style' in button ? button.style : {}) || {};

    if (button.type === 'custom:frigate-card-menu-state-icon') {
      state = this.hass.states[button.entity];
      emphasize =
        !!state && button.state_color && ['on', 'active', 'home'].includes(state.state);
      title = title ?? (state.attributes.friendly_name || button.entity);
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

    return html` <ha-icon-button
      class="${classMap(classes)}"
      style="${styleMap(style)}"
      icon=${icon || 'mdi:gesture-tap-button'}
      title=${title || ''}
      @action=${(ev) => this._callAction(ev, button)}
      .actionHandler=${actionHandler({
        hasHold: hasHold,
        hasDoubleClick: hasDoubleClick,
      })}
    ></ha-icon-button>`;
  }

  // Render the Frigate menu button.
  protected _renderFrigateButton(button: MenuButton): TemplateResult {
    const icon =
      this.menuMode.startsWith('hidden-') && !this.expand
        ? 'mdi:alpha-f-box-outline'
        : 'mdi:alpha-f-box';

    return this._renderButton(Object.assign({}, button, { icon: icon }));
  }

  // Render the menu.
  protected render(): TemplateResult {
    const isFrigateButton = function (button: MenuButton): boolean {
      return button.type === 'internal-menu-icon' && button.card_action === 'frigate';
    };

    // If the menu is off, or if it's in hidden mode but there's no button to
    // unhide it, just show nothing.
    if (
      this.menuMode == 'none' ||
      (this.menuMode.startsWith('hidden-') && !this.buttons.find(isFrigateButton))
    ) {
      return html``;
    }

    const classes = {
      'frigate-card-menu': true,
      'overlay-hidden':
        this.menuMode.startsWith('hidden-') ||
        this.menuMode.startsWith('overlay-') ||
        this.menuMode.startsWith('hover-'),
      'expanded-horizontal':
        (this.menuMode.startsWith('overlay-') ||
          this.menuMode.startsWith('hover-') ||
          this.expand) &&
        (this.menuMode.endsWith('-top') || this.menuMode.endsWith('-bottom')),
      'expanded-vertical':
        (this.menuMode.startsWith('overlay-') ||
          this.menuMode.startsWith('hover-') ||
          this.expand) &&
        (this.menuMode.endsWith('-left') || this.menuMode.endsWith('-right')),
      full: ['above', 'below'].includes(this.menuMode),
      left: this.menuMode.endsWith('-left'),
      right: this.menuMode.endsWith('-right'),
      top: this.menuMode.endsWith('-top'),
      bottom: this.menuMode.endsWith('-bottom'),
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
