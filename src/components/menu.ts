import { HASSDomEvent, HomeAssistant } from 'custom-card-helpers';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';
import { actionHandler } from '../action-handler-directive.js';
import menuStyle from '../scss/menu.scss';
import type {
  ActionsConfig,
  ActionType,
  MenuButton,
  MenuConfig,
  MenuItem,
  StateParameters,
} from '../types.js';
import {
  convertActionToFrigateCardCustomAction,
  frigateCardHandleActionConfig,
  frigateCardHasAction,
  getActionConfigGivenAction,
} from '../utils/action.js';
import { FRIGATE_ICON_SVG_PATH } from '../camera-manager/frigate/icon.js';
import { refreshDynamicStateParameters } from '../utils/ha';
import './submenu.js';
import { EntityRegistryManager } from '../utils/ha/entity-registry/index.js';
import { FRIGATE_BUTTON_MENU_ICON } from '../const.js';

/**
 * A menu for the FrigateCard.
 */
@customElement('frigate-card-menu')
export class FrigateCardMenu extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: true, type: Boolean, reflect: true })
  public expanded = false;

  set menuConfig(menuConfig: MenuConfig) {
    this._menuConfig = menuConfig;
    if (menuConfig) {
      this.style.setProperty(
        '--frigate-card-menu-button-size',
        `${menuConfig.button_size}px`,
      );
    }
    // Store the menu style, position and alignment as attributes (used for
    // styling).
    this.setAttribute('data-style', menuConfig.style);
    this.setAttribute('data-position', menuConfig.position);
    this.setAttribute('data-alignment', menuConfig.alignment);
  }
  @state()
  protected _menuConfig?: MenuConfig;

  @property({ attribute: false })
  public buttons: MenuButton[] = [];

  @property({ attribute: false })
  public entityRegistryManager?: EntityRegistryManager;

  /**
   * Determine if a given menu configuration is a hiding menu.
   * @param menuConfig The menu configuration.
   * @returns `true` if the menu is hiding, `false` otherwise.
   */
  static isHidingMenu(menuConfig: MenuConfig | undefined): boolean {
    return menuConfig?.style === 'hidden' ?? false;
  }

  /**
   * Toggle the menu. Has no action if menu is not hiding/expandable.
   */
  public toggleMenu(): void {
    if (this._isHidingMenu()) {
      this.expanded = !this.expanded;
    }
  }

  /**
   * Determine if a given menu configuration is a hiding menu (internal version).
   * @returns `true` if the menu is hiding, `false` otherwise.
   */
  protected _isHidingMenu(): boolean {
    return FrigateCardMenu.isHidingMenu(this._menuConfig);
  }

  /**
   * Determine if a given action is intended to toggle the menu.
   * @param action The action to check.
   * @returns `true` if the action toggles the menu, `false` otherwise.
   */
  protected _isMenuToggleAction(action: ActionType | undefined): boolean {
    // Determine if this action is a Frigate card action, if so handle it
    // internally.
    if (!action) {
      return false;
    }
    const frigateCardAction = convertActionToFrigateCardCustomAction(action);
    return !!frigateCardAction && frigateCardAction.frigate_card_action == 'menu_toggle';
  }

  /**
   * Handle an action on a menu button.
   * @param ev The action event.
   * @param button The button configuration.
   */
  protected _actionHandler(
    ev: HASSDomEvent<{ action: string; config?: ActionsConfig }>,
    config?: ActionsConfig,
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

    // These interactions should only be handled by the menu, as nothing
    // upstream has the user-provided configuration.
    ev.stopPropagation();

    const interaction: string = ev.detail.action;
    let action = getActionConfigGivenAction(interaction, config);
    if (!config || !interaction) {
      return;
    }

    let tookAction = false;
    let menuToggle = false;

    if (Array.isArray(action)) {
      // Case 1: An array of actions.
      // Strip out actions that toggle the menu.
      const actionCount = action.length;
      action = action.filter((item) => !this._isMenuToggleAction(item));
      if (action.length != actionCount) {
        menuToggle = true;
      }

      // If there are still actions left, handle them as usual.
      if (action.length) {
        tookAction = frigateCardHandleActionConfig(
          this,
          this.hass as HomeAssistant,
          config,
          interaction,
          action,
        );
      }
    } else {
      // Case 2: Either a specific action, or no action at all (i.e. default
      // action for `tap`).
      if (this._isMenuToggleAction(action)) {
        menuToggle = true;
      } else {
        tookAction = frigateCardHandleActionConfig(
          this,
          this.hass as HomeAssistant,
          config,
          interaction,
          action,
        );
      }
    }

    if (this._isHidingMenu()) {
      if (menuToggle) {
        this.expanded = !this.expanded;
      } else if (tookAction) {
        this.expanded = false;
      }
    }
  }

  /**
   * Ensure menu buttons are sorted before the render.
   * @param changedProps The changed properties
   */
  protected willUpdate(changedProps: PropertyValues): void {
    const style = this._menuConfig?.style;
    const sortButtons = (a: MenuItem, b: MenuItem): number => {
      // If the menu is hidden, the Frigate button must come first.
      if (style === 'hidden') {
        if (a.icon === FRIGATE_BUTTON_MENU_ICON) {
          return -1;
        } else if (b.icon === FRIGATE_BUTTON_MENU_ICON) {
          return 1;
        }
      }

      // Otherwise sort by priority.
      if (
        a.priority === undefined ||
        (b.priority !== undefined && b.priority > a.priority)
      ) {
        return 1;
      }
      if (
        b.priority === undefined ||
        (a.priority !== undefined && b.priority < a.priority)
      ) {
        return -1;
      }
      return 0;
    };

    if (changedProps.has('_menuConfig') || changedProps.has('buttons')) {
      this.buttons.sort(sortButtons);
    }
  }

  /**
   * Render a button.
   * @param button The button configuration to render.
   * @returns A rendered template or void.
   */
  protected _renderButton(button: MenuButton): TemplateResult | void {
    if (button.type === 'custom:frigate-card-menu-submenu') {
      return html` <frigate-card-submenu
        .hass=${this.hass}
        .submenu=${button}
        @action=${this._actionHandler.bind(this)}
      >
      </frigate-card-submenu>`;
    } else if (button.type === 'custom:frigate-card-menu-submenu-select') {
      return html` <frigate-card-submenu-select
        .hass=${this.hass}
        .submenuSelect=${button}
        .entityRegistryManager=${this.entityRegistryManager}
        @action=${this._actionHandler.bind(this)}
      >
      </frigate-card-submenu-select>`;
    }

    let stateParameters = { ...button } as StateParameters;
    const svgPath =
      stateParameters.icon === FRIGATE_BUTTON_MENU_ICON ? FRIGATE_ICON_SVG_PATH : '';

    if (this.hass && button.type === 'custom:frigate-card-menu-state-icon') {
      stateParameters = refreshDynamicStateParameters(this.hass, stateParameters);
    }

    const hasHold = frigateCardHasAction(button.hold_action);
    const hasDoubleClick = frigateCardHasAction(button.double_tap_action);

    const classes = {
      button: true,
    };

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

    return html` <ha-icon-button
      data-domain=${ifDefined(stateParameters.data_domain)}
      data-state=${ifDefined(stateParameters.data_state)}
      class="${classMap(classes)}"
      style="${styleMap(stateParameters.style || {})}"
      .actionHandler=${actionHandler({
        hasHold: hasHold,
        hasDoubleClick: hasDoubleClick,
      })}
      .label=${stateParameters.title || ''}
      @action=${(ev) => this._actionHandler(ev, button)}
    >
      ${svgPath
        ? html`<ha-svg-icon .path="${svgPath}"></ha-svg-icon>`
        : html`<ha-icon
            icon="${stateParameters.icon || 'mdi:gesture-tap-button'}"
          ></ha-icon>`}
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
    const style = this._menuConfig.style;
    if (style === 'none') {
      return;
    }

    // If the hidden menu isn't expanded, only show the Frigate button.
    const matchingButtons = (
      style !== 'hidden' || this.expanded
        ? this.buttons.filter(
            (button) => !button.alignment || button.alignment === 'matching',
          )
        : this.buttons.filter((button) => button.icon === FRIGATE_BUTTON_MENU_ICON)
    ).filter((button) => button.enabled !== false);

    const opposingButtons =
      style !== 'hidden' || this.expanded
        ? this.buttons.filter(
            (button) => button.alignment === 'opposing' && button.enabled !== false,
          )
        : [];

    const matchingStyle = {
      flex: String(matchingButtons.length),
    };
    const opposingStyle = {
      flex: String(opposingButtons.length),
    };

    return html` <div class="matching" style="${styleMap(matchingStyle)}">
        ${matchingButtons.map((button) => this._renderButton(button))}
      </div>
      <div class="opposing" style="${styleMap(opposingStyle)}">
        ${opposingButtons.map((button) => this._renderButton(button))}
      </div>`;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(menuStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-menu': FrigateCardMenu;
  }
}
