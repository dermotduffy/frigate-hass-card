import { HASSDomEvent, HomeAssistant, handleAction, hasAction } from 'custom-card-helpers';
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import { actionHandler } from '../action-handler-directive.js';

import './submenu.js';

import type {
  Actions,
  ActionType,
  ExtendedHomeAssistant,
  MenuButton,
  MenuConfig,
  StateParameters,
} from '../types.js';
import {
  convertActionToFrigateCardCustomAction,
  getActionConfigGivenAction,
  refreshDynamicStateParameters,
} from '../common.js';

import menuStyle from '../scss/menu.scss';
import { Corner } from '@material/mwc-menu';

export const FRIGATE_BUTTON_MENU_ICON = 'frigate';

/**
 * A menu for the FrigateCard.
 */
@customElement('frigate-card-menu')
export class FrigateCardMenu extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant & ExtendedHomeAssistant;

  set menuConfig(menuConfig: MenuConfig) {
    this.expanded = !menuConfig?.mode.startsWith('hidden-');

    this._menuConfig = menuConfig;
    if (menuConfig) {
      this.style.setProperty('--frigate-card-menu-button-size', menuConfig.button_size);
    }
  }
  @state()
  protected _menuConfig?: MenuConfig;

  @state()
  protected expanded = false;

  @property({ attribute: false })
  public buttons: MenuButton[] = [];

  protected _isFrigateCardAction(action: ActionType): boolean {
    // Determine if this action is a Frigate card action, if so handle it
    // internally.
    const frigateCardAction = convertActionToFrigateCardCustomAction(action);
    return !!frigateCardAction && frigateCardAction.frigate_card_action == 'frigate';
  }

  /**
   * Handle an action on a menu button.
   * @param ev The action event.
   * @param button The button configuration.
   */
  protected _actionHandler(
    ev: HASSDomEvent<{ action: string; config?: Actions }>,
    config?: Actions,
  ): void {
    if (!ev) {
      return;
    }

    // If the event itself contains a configuration then use that. This is
    // useful in cases where the registration of the event handler does not have
    // access to the actual desired configuration (e.g. action events generated
    // by a submenu).
    if (ev.detail.config) {
      config = ev.detail.config;
    }

    // These interactions should only be handled by the card, as nothing
    // upstream has the user-provided configuration.
    ev.stopPropagation();

    const interaction: string = ev.detail.action;
    const action = getActionConfigGivenAction(interaction, config);
    if (!config || !interaction) {
      return;
    }

    if (
      action &&
      this._isFrigateCardAction(action) &&
      this._menuConfig?.mode.startsWith('hidden-')
    ) {
      // If the user presses the frigate button and it's a hide-away menu,
      // then expand the menu and return.
      this.expanded = !this.expanded;
      return;
    }

    // Collapse menu after the user clicks on something.
    this.expanded = false;
    handleAction(this, this.hass as HomeAssistant, config, interaction);
  }

  /**
   * Render a button.
   * @param button The button configuration to render.
   * @returns A rendered template or void.
   */
  protected _renderButton(button: MenuButton): TemplateResult | void {
    if (button.type == 'custom:frigate-card-menu-submenu') {
      let corner: Corner | undefined;
      if (this._menuConfig?.mode.endsWith('-left')) {
        // Minor nicety: Start the menu to the right of the menu itself is on
        // the left, otherwise use the default.
        corner = 'BOTTOM_RIGHT';
      }

      return html` <frigate-card-submenu
        .corner=${corner}
        .hass=${this.hass}
        .submenu=${button}
        @action=${this._actionHandler.bind(this)}
      >
      </frigate-card-submenu>`;
    }

    let stateParameters: StateParameters = { ...button };

    if (stateParameters.icon == FRIGATE_BUTTON_MENU_ICON) {
      stateParameters.icon =
        this._menuConfig?.mode.startsWith('hidden-') && !this.expanded
          ? 'mdi:alpha-f-box-outline'
          : 'mdi:alpha-f-box';
    }

    if (button.type === 'custom:frigate-card-menu-state-icon') {
      if (!this.hass) {
        return;
      }
      stateParameters = refreshDynamicStateParameters(this.hass, stateParameters);
    }

    const hasHold = hasAction(button.hold_action);
    const hasDoubleClick = hasAction(button.double_tap_action);

    const classes = {
      button: true,
    };

    return html` <ha-icon-button
      class="${classMap(classes)}"
      style="${styleMap(stateParameters.style || {})}"
      .actionHandler=${actionHandler({
        hasHold: hasHold,
        hasDoubleClick: hasDoubleClick,
      })}
      .label=${stateParameters.title || ''}
      @action=${(ev) => this._actionHandler(ev, button)}
    >
      <ha-icon icon="${stateParameters.icon || 'mdi:gesture-tap-button'}"></ha-icon>
    </ha-icon-button>`;
  }

  /**
   * Render the menu.
   * @returns A rendered template or void.
   */
  protected render(): TemplateResult | void {
    if (!this._menuConfig) {
      return;
    }
    const mode = this._menuConfig.mode;

    if (mode == 'none') {
      return;
    }

    const classes = {
      'frigate-card-menu': true,
      'overlay-hidden':
        mode.startsWith('hidden-') ||
        mode.startsWith('overlay-') ||
        mode.startsWith('hover-'),
      'expanded-horizontal':
        (mode.startsWith('overlay-') ||
          mode.startsWith('hover-') ||
          (mode.startsWith('hidden-') && this.expanded)) &&
        (mode.endsWith('-top') || mode.endsWith('-bottom')),
      'expanded-vertical':
        (mode.startsWith('overlay-') ||
          mode.startsWith('hover-') ||
          (mode.startsWith('hidden-') && this.expanded)) &&
        (mode.endsWith('-left') || mode.endsWith('-right')),
      full: mode == 'above' || mode == 'below',
      left: mode.endsWith('-left'),
      right: mode.endsWith('-right'),
      top: mode.endsWith('-top'),
      bottom: mode.endsWith('-bottom'),
    };

    // If the hidden menu isn't expanded, only show the Frigate button.
    const buttons =
      !mode.startsWith('hidden-') || this.expanded
        ? this.buttons
        : this.buttons.filter((button) => button.icon === FRIGATE_BUTTON_MENU_ICON);
    return html`
      <div class=${classMap(classes)}>
        ${buttons.map((button) => this._renderButton(button))}
      </div>
    `;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(menuStyle);
  }
}
