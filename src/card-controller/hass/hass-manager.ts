import { localize } from '../../localize/localize';
import { ExtendedHomeAssistant } from '../../types';
import { hasHAConnectionStateChanged } from '../../utils/ha';
import { CardHASSAPI } from '../types';
import { StateWatcher, StateWatcherSubscriptionInterface } from './state-watcher';

export class HASSManager {
  protected _hass: ExtendedHomeAssistant | null = null;
  protected _api: CardHASSAPI;
  protected _stateWatcher: StateWatcher = new StateWatcher();

  constructor(api: CardHASSAPI) {
    this._api = api;
  }

  public getHASS(): ExtendedHomeAssistant | null {
    return this._hass;
  }

  public hasHASS(): boolean {
    return !!this._hass;
  }

  public getStateWatcher(): StateWatcherSubscriptionInterface {
    return this._stateWatcher;
  }

  public setHASS(hass?: ExtendedHomeAssistant | null): void {
    if (hasHAConnectionStateChanged(this._hass, hass)) {
      if (!hass?.connected) {
        this._api.getMessageManager().setMessageIfHigherPriority({
          message: localize('error.reconnecting'),
          icon: 'mdi:lan-disconnect',
          type: 'connection',
          dotdotdot: true,
        });
      } else {
        this._api.getMessageManager().resetType('connection');
      }
    }

    if (!hass) {
      return;
    }

    const oldHass = this._hass;
    this._hass = hass;

    if (this._api.getConditionsManager().hasHAStateConditions()) {
      this._api.getConditionsManager().setState({
        state: this._hass.states,
        user: this._hass.user,
      });
    }

    // Dark mode may depend on HASS.
    this._api.getStyleManager().setLightOrDarkMode();

    this._stateWatcher.setHASS(oldHass, hass);
  }
}
