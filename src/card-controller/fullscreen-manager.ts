import screenfull from 'screenfull';
import { CardFullscreenAPI } from './types';

export class FullscreenManager {
  protected _api: CardFullscreenAPI;

  constructor(api: CardFullscreenAPI) {
    this._api = api;
  }

  public initialize(): void {
    this._setConditionState();
  }

  public connect(): void {
    if (screenfull.isEnabled) {
      screenfull.on('change', this._fullscreenHandler);
    }
  }

  public disconnect(): void {
    if (screenfull.isEnabled) {
      screenfull.off('change', this._fullscreenHandler);
    }
  }

  public isInFullscreen(): boolean {
    return screenfull.isEnabled && screenfull.isFullscreen;
  }

  public toggleFullscreen(): void {
    screenfull.toggle(this._api.getCardElementManager().getElement());
  }

  public stopFullscreen(): void {
    screenfull.exit();
  }

  protected _setConditionState(): void {
    this._api.getConditionsManager()?.setState({
      fullscreen: this.isInFullscreen(),
    });
  }

  protected _fullscreenHandler = (): void => {
    this._api.getExpandManager().setExpanded(false);

    this._setConditionState();

    // Re-render after a change to fullscreen mode to take advantage of
    // the expanded screen real-estate (vs staying in aspect-ratio locked
    // modes).
    this._api.getCardElementManager().update();
  };
}
