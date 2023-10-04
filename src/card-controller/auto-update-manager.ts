import { Timer } from '../utils/timer';
import { CardAutoRefreshAPI } from './types';

export class AutoUpdateManager {
  protected _timer = new Timer();
  protected _api: CardAutoRefreshAPI;

  constructor(api: CardAutoRefreshAPI) {
    this._api = api;
  }

  /**
   * Set the update timer to trigger an update refresh every
   * `view.update_seconds`.
   */
  public startDefaultViewTimer(): void {
    this._timer.stop();
    const updateSeconds = this._api.getConfigManager().getConfig()
      ?.view.update_seconds;
    if (updateSeconds) {
      this._timer.start(updateSeconds, () => {
        if (this._isAutomatedUpdateAllowed()) {
          this._api.getViewManager().setViewDefault();
        } else {
          // Not allowed to update this time around, but try again at the next
          // interval.
          this.startDefaultViewTimer();
        }
      });
    }
  }

  protected _isAutomatedUpdateAllowed(): boolean {
    const triggers = this._api.getTriggersManager();
    const config = this._api.getConfigManager().getConfig();
    const interactionManager = this._api.getInteractionManager();

    return (
      !triggers.isTriggered() &&
      (config?.view.update_force || !interactionManager.hasInteraction())
    );
  }
}
