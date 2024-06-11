import { localize } from '../localize/localize';
import { ExtendedHomeAssistant } from '../types';
import { hasHAConnectionStateChanged, isHassDifferent } from '../utils/ha';
import { CardHASSAPI } from './types';

export class HASSManager {
  protected _hass: ExtendedHomeAssistant | null = null;
  protected _api: CardHASSAPI;

  constructor(api: CardHASSAPI) {
    this._api = api;
  }

  public getHASS(): ExtendedHomeAssistant | null {
    return this._hass;
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

    if (
      isHassDifferent(this._hass, oldHass, [
        ...(this._api.getConfigManager().getConfig()?.view.render_entities ?? []),

        // Refresh the card if media player state changes:
        // https://github.com/dermotduffy/frigate-hass-card/issues/881
        ...this._api.getMediaPlayerManager().getMediaPlayers(),
      ])
    ) {
      this._api.getCardElementManager().update();
    }

    if (this._api.getConditionsManager().hasHAStateConditions()) {
      this._api.getConditionsManager().setState({
        state: this._hass.states,
        user: this._hass.user,
      });
    }

    // Dark mode may depend on HASS.
    this._api.getStyleManager().setLightOrDarkMode();
  }
}
