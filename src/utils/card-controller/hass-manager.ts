import { localize } from '../../localize/localize';
import { CameraConfig, ExtendedHomeAssistant } from '../../types';
import { hasHAConnectionStateChanged, isHassDifferent } from '../ha';
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

  public setHASS(hass: ExtendedHomeAssistant): void {
    const getSelectedCameraConfig = (): CameraConfig | null => {
      const view = this._api.getViewManager().getView();
      const cameraManager = this._api.getCameraManager();

      return view && cameraManager
        ? cameraManager?.getStore().getCameraConfig(view.camera) ?? null
        : null;
    };

    const oldHass = this._hass;
    this._hass = hass;

    const selectedCamera = getSelectedCameraConfig();

    if (hasHAConnectionStateChanged(oldHass, hass)) {
      if (!this._hass?.connected) {
        this._api.getMessageManager().setMessageIfHigherPriority({
          message: localize('error.reconnecting'),
          icon: 'mdi:lan-disconnect',
          type: 'connection',
          dotdotdot: true,
        });
      } else {
        this._api.getViewManager().setViewDefault();
      }
    } else if (
      // Home Assistant pumps a lot of updates through. Re-rendering the card is
      // necessary at times (e.g. to update the 'clip' view as new clips
      // arrive), but also is a jarring experience for the user (e.g. if they
      // are browsing the mini-gallery). Do not allow re-rendering from a Home
      // Assistant update if there's been recent interaction (e.g. clicks on the
      // card) or if there is media active playing.
      this._isAutomatedViewUpdateAllowed() &&
      isHassDifferent(this._hass, oldHass, [
        ...(this._api.getConfigManager().getConfig()?.view.update_entities ?? []),
        ...(selectedCamera?.triggers.entities ?? []),
      ])
    ) {
      // If entities being monitored have changed then reset the view to the
      // default.
      this._api.getViewManager().setViewDefault();
    } else if (
      isHassDifferent(this._hass, oldHass, [
        ...(this._api.getConfigManager().getConfig()?.view.render_entities ?? []),

        // Refresh the card if media player state changes:
        // https://github.com/dermotduffy/frigate-hass-card/issues/881
        ...this._api.getMediaPlayerManager().getMediaPlayers(),
      ])
    ) {
      this._api.getCardElementManager().update();
    }

    this._api.getTriggersManager().updateTriggeredCameras(oldHass);

    if (this._api.getConditionsManager().hasHAStateConditions()) {
      this._api.getConditionsManager().setState({ state: this._hass.states });
    }

    // Dark mode may depend on HASS.
    this._api.getStyleManager().setLightOrDarkMode();
  }

  protected _isAutomatedViewUpdateAllowed(): boolean {
    return (
      this._api.getConfigManager().getConfig()?.view.update_force ||
      !this._api.getInteractionManager().hasInteraction()
    );
  }
}