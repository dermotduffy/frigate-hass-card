import PQueue from 'p-queue';
import { DestroyCallback, subscribeToTrigger } from '../utils/ha';
import { isActionAllowedBasedOnInteractionState } from '../utils/interaction-mode';
import { Timer } from '../utils/timer';
import { CardDefaultManagerAPI } from './types';

/**
 * Manages automated resetting to the default view.
 */
export class DefaultManager {
  protected _timer = new Timer();
  protected _api: CardDefaultManagerAPI;
  protected _unsubscribeCallback: DestroyCallback | null = null;
  protected _initializationLimit = new PQueue({ concurrency: 1 });

  constructor(api: CardDefaultManagerAPI) {
    this._api = api;
  }

  /**
   * Initialize the default manager. Requires both hass and configuration to be
   * effective (so cannot be called from just the configuration manager, as hass
   * will not be available yet)
   */
  public async initialize(): Promise<boolean> {
    const result = await this._initializationLimit.add(() => this._reconfigure());
    this._startTimer();
    return !!result;
  }

  public uninitialize(): void {
    this._timer.stop();
    this._unsubscribeCallback?.();
    this._unsubscribeCallback = null;
  }

  protected async _reconfigure(): Promise<boolean> {
    const hass = this._api.getHASSManager().getHASS();
    const config = this._api.getConfigManager().getConfig()?.view.default_reset;
    if (!hass || !config) {
      return false;
    }

    if (this._unsubscribeCallback) {
      await this._unsubscribeCallback();
    }

    this._unsubscribeCallback = await subscribeToTrigger(
      hass,
      () => this._setToDefaultIfAllowed(),
      {
        entityID: config.entities,
        platform: 'state',
        stateOnly: true,
      },
    );

    // If the timer is running, restart it with the newly configured timer.
    if (this._timer.isRunning()) {
      this._timer.stop();
      this._startTimer();
    }

    return true;
  }

  protected _setToDefaultIfAllowed(): void {
    if (this._isAutomatedUpdateAllowed()) {
      this._api.getViewManager().setViewDefault();
    }
  }

  protected _isAutomatedUpdateAllowed(): boolean {
    const interactionMode = this._api.getConfigManager().getConfig()?.view
      .default_reset.interaction_mode;
    return (
      !!interactionMode &&
      isActionAllowedBasedOnInteractionState(
        interactionMode,
        this._api.getInteractionManager().hasInteraction(),
      )
    );
  }

  protected _startTimer(): void {
    const timerSeconds = this._api.getConfigManager().getConfig()?.view
      .default_reset.every_seconds;
    if (timerSeconds) {
      this._timer.startRepeated(timerSeconds, () => this._setToDefaultIfAllowed());
    }
  }
}
