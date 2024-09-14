import throttle from 'lodash-es/throttle';
import { Timer } from '../utils/timer';
import { CardInteractionAPI } from './types';

export class InteractionManager {
  protected _timer = new Timer();
  protected _api: CardInteractionAPI;

  constructor(api: CardInteractionAPI) {
    this._api = api;
  }

  // The mouse handler may be called continually, throttle it to at most once
  // per second for performance reasons.
  public reportInteraction = throttle(() => {
    this._reportInteraction();
  }, 1 * 1000);

  public initialize(): void {
    this._api.getConditionsManager().setState({ interaction: false });
  }

  public hasInteraction(): boolean {
    return this._timer.isRunning();
  }

  /**
   * Start the user interaction ('screensaver') timer to reset the view to
   * default `view.interaction_seconds` after user interaction.
   */
  protected _reportInteraction(): void {
    this._timer.stop();

    const timeoutSeconds = this._api.getConfigManager().getConfig()
      ?.view.interaction_seconds;

    if (timeoutSeconds) {
      this._api.getConditionsManager().setState({ interaction: true });

      this._timer.start(timeoutSeconds, () => {
        this._api.getConditionsManager().setState({ interaction: false });
        this._api.getStyleManager().setLightOrDarkMode();
      });
    }
  }
}
