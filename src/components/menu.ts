import { HassEntity } from 'home-assistant-js-websocket';
import { HomeAssistant, handleAction, hasAction, stateIcon } from 'custom-card-helpers';
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
import { StyleInfo, styleMap } from 'lit/directives/style-map.js';

import { actionHandler } from '../action-handler-directive.js';

import './submenu.js';

import type {
  Actions,
  ExtendedHomeAssistant,
  MenuButton,
  MenuConfig,
} from '../types.js';
import {
  convertActionToFrigateCardCustomAction,
  getActionConfigGivenAction,
  shouldUpdateBasedOnHass,
} from '../common.js';

import menuStyle from '../scss/menu.scss';
import { ConditionState, evaluateCondition } from '../card-condition.js';

export const FRIGATE_BUTTON_MENU_ICON = 'frigate';

/**
 * A menu for the FrigateCard.
 */
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
  protected _menuConfig?: MenuConfig;

  @property({ attribute: false })
  protected expand = false;

  @property({ attribute: false })
  public buttons: MenuButton[] = [];

  @property({ attribute: false })
  protected conditionState?: ConditionState;

  /**
   * Handle an action on a menu button.
   * @param ev The action event.
   * @param button The button configuration.
   */
  protected _actionHandler(
    ev: CustomEvent<{ action: string; config?: Actions }>,
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
    if (!config || !action || !interaction) {
      return;
    }

    // Determine if this action is a Frigate card action, if so handle it
    // internally.
    const frigateCardAction = convertActionToFrigateCardCustomAction(action);
    if (
      frigateCardAction &&
      frigateCardAction.frigate_card_action == 'frigate' &&
      this._menuConfig?.mode.startsWith('hidden-')
    ) {
      // If the user presses the frigate button and it's a hide-away menu,
      // then expand the menu and return.
      this.expand = !this.expand;
      return;
    }

    // Collapse menu after the user clicks on something.
    this.expand = false;
    handleAction(this, this.hass as HomeAssistant, config, interaction);
  }

  /**
   * Determine whether the menu should be updated.
   * @param changedProps The changed properties.
   * @returns `true` if the menu should be updated, otherwise `false`.
   */
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

  /**
   * Get the style of emphasized menu items.
   * @returns A StyleInfo.
   */
  public static getEmphasizedStyle(): StyleInfo {
    return {
      color: 'var(--primary-color, white)',
    };
  }

  /**
   * Render a button.
   * @param button The button configuration to render.
   * @returns A rendered template or void.
   */
  protected _renderButton(button: MenuButton): TemplateResult | void {
    if (button.type == 'custom:frigate-card-menu-submenu') {
      return html` <frigate-card-submenu
        .submenu=${button}
        @action=${this._actionHandler.bind(this)}
      >
      </frigate-card-submenu>`;
    }

    let state: HassEntity | null = null;
    let title = button.title;
    let icon = button.icon;
    let style = button.style || {};

    if (icon == FRIGATE_BUTTON_MENU_ICON) {
      icon =
        this._menuConfig?.mode.startsWith('hidden-') && !this.expand
          ? 'mdi:alpha-f-box-outline'
          : 'mdi:alpha-f-box';
    }

    if (button.type === 'custom:frigate-card-menu-state-icon') {
      if (!this.hass) {
        return;
      }
      state = this.hass.states[button.entity];
      if (
        !!state &&
        button.state_color &&
        ['on', 'active', 'home'].includes(state.state)
      ) {
        style = { ...style, ...FrigateCardMenu.getEmphasizedStyle() };
      }
      title = title ?? (state?.attributes?.friendly_name || button.entity);
      icon = icon ?? stateIcon(state);
    }

    const hasHold = hasAction(button.hold_action);
    const hasDoubleClick = hasAction(button.double_tap_action);

    const classes = {
      button: true,
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
      @action=${(ev) => this._actionHandler(ev, button)}
      .actionHandler=${actionHandler({
        hasHold: hasHold,
        hasDoubleClick: hasDoubleClick,
      })}
    >
      <ha-icon icon="${icon || 'mdi:gesture-tap-button'}"></ha-icon>
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

    if (
      mode == 'none' ||
      !evaluateCondition(this._menuConfig.conditions, this.conditionState)
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
        ${Array.from(this.buttons).map((button) => this._renderButton(button))}
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
