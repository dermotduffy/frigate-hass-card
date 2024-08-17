import { HASSDomEvent, HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { LitElement } from 'lit';
import { FRIGATE_ICON_SVG_PATH } from '../camera-manager/frigate/icon.js';
import type {
  ActionType,
  ActionsConfig,
  MenuConfig,
  MenuItem,
} from '../config/types.js';
import { FRIGATE_BUTTON_MENU_ICON } from '../const.js';
import { StateParameters } from '../types.js';
import {
  convertActionToCardCustomAction,
  getActionConfigGivenAction,
} from '../utils/action';
import { arrayify, isTruthy, setOrRemoveAttribute } from '../utils/basic.js';
import { refreshDynamicStateParameters } from '../utils/ha/index.js';
import { dispatchActionExecutionRequest } from '../card-controller/actions/utils/execution-request.js';

export class MenuController {
  protected _host: LitElement;
  protected _config: MenuConfig | null = null;
  protected _buttons: MenuItem[] = [];
  protected _expanded = false;

  constructor(host: LitElement) {
    this._host = host;
  }

  public setMenuConfig(config: MenuConfig): void {
    this._config = config;
    this._host.style.setProperty(
      '--frigate-card-menu-button-size',
      `${config.button_size}px`,
    );

    // Store the menu style, position and alignment as attributes (used for
    // styling).
    this._host.setAttribute('data-style', config.style);
    this._host.setAttribute('data-position', config.position);
    this._host.setAttribute('data-alignment', config.alignment);

    this._sortButtons();
    this._host.requestUpdate();
  }

  public getMenuConfig(): MenuConfig | null {
    return this._config;
  }

  public isExpanded(): boolean {
    return this._expanded;
  }

  public setButtons(buttons: MenuItem[]): void {
    this._buttons = buttons;
    this._sortButtons();
    this._host.requestUpdate();
  }

  public getButtons(alignment: 'matching' | 'opposing'): MenuItem[] {
    const style = this._config?.style;

    const aligned = (button: MenuItem): boolean => {
      return (
        button.alignment === alignment || (alignment === 'matching' && !button.alignment)
      );
    };

    const enabled = (button: MenuItem): boolean => {
      return button.enabled !== false;
    };

    const suitableToShowIfHiddenMenu = (button: MenuItem): boolean => {
      // If the hidden menu isn't expanded, only show the Frigate button.
      return (
        style !== 'hidden' || this._expanded || button.icon === FRIGATE_BUTTON_MENU_ICON
      );
    };

    return this._buttons.filter(
      (button) =>
        enabled(button) && aligned(button) && suitableToShowIfHiddenMenu(button),
    );
  }

  public setExpanded(expanded: boolean): void {
    this._expanded = expanded;
    setOrRemoveAttribute(this._host, expanded, 'expanded');
    this._host.requestUpdate();
  }

  public toggleExpanded(): void {
    this.setExpanded(!this._expanded);
  }

  public actionHandler(
    ev: HASSDomEvent<{ action: string; config?: ActionsConfig }>,
    config?: ActionsConfig,
  ): void {
    // These interactions should only be handled by the menu, as nothing
    // upstream has the user-provided configuration.
    ev.stopPropagation();

    // If the event itself contains a configuration then use that. This is
    // useful in cases where the registration of the event handler does not have
    // access to the actual desired configuration (e.g. action events generated
    // by a submenu).
    if (ev.detail.config) {
      config = ev.detail.config;
    }
    if (!config) {
      return;
    }

    const interaction: string = ev.detail.action;
    const action = getActionConfigGivenAction(interaction, config);
    if (!action) {
      return;
    }
    const actions = arrayify(action);

    // A note on the complexity below: By default the menu should close when a
    // user takes an action, an exception is if the user is specifically
    // manipulating the menu in the actions themselves.
    let menuToggle = false;

    const toggleLessActions = actions.filter(
      (item) => isTruthy(item) && !this._isMenuToggleAction(item),
    );
    if (toggleLessActions.length != actions.length) {
      menuToggle = true;
    }

    if (toggleLessActions.length) {
      dispatchActionExecutionRequest(this._host, {
        action: actions,
        config: config,
      });
    }

    if (this._isHidingMenu()) {
      if (menuToggle) {
        this.setExpanded(!this._expanded);
      } else {
        // Don't close the menu if there is another action to come.
        const holdAction = getActionConfigGivenAction('hold', config);
        const doubleTapAction = getActionConfigGivenAction('double_tap', config);
        const tapAction = getActionConfigGivenAction('tap', config);
        const endTapAction = getActionConfigGivenAction('end_tap', config);

        if (
          interaction === 'end_tap' ||
          (interaction === 'start_tap' &&
            !holdAction &&
            !doubleTapAction &&
            !tapAction &&
            !endTapAction) ||
          (interaction !== 'end_tap' && !endTapAction)
        ) {
          this.setExpanded(false);
        }
      }
    }
  }

  public getFreshButtonState(hass: HomeAssistant, button: MenuItem): StateParameters {
    const stateParameters = { ...button } as StateParameters;
    return hass && button.type === 'custom:frigate-card-menu-state-icon'
      ? refreshDynamicStateParameters(hass, stateParameters)
      : stateParameters;
  }

  public getSVGPath(button: MenuItem): string {
    return button.icon === FRIGATE_BUTTON_MENU_ICON ? FRIGATE_ICON_SVG_PATH : '';
  }

  protected _sortButtons(): void {
    const style = this._config?.style;
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

    this._buttons.sort(sortButtons);
  }

  protected _isHidingMenu(): boolean {
    return this._config?.style === 'hidden' ?? false;
  }

  protected _isMenuToggleAction(action: ActionType): boolean {
    const frigateCardAction = convertActionToCardCustomAction(action);
    return !!frigateCardAction && frigateCardAction.frigate_card_action == 'menu_toggle';
  }
}
