import { CardExpandAPI } from './types';

export class ExpandManager {
  protected _expanded = false;
  protected _api: CardExpandAPI;

  constructor(api: CardExpandAPI) {
    this._api = api;
  }

  public isExpanded(): boolean {
    return this._expanded;
  }

  public toggleExpanded(): void {
    this.setExpanded(!this._expanded);
  }

  public setExpanded(expanded: boolean): void {
    if (expanded && this._api.getFullscreenManager().isInFullscreen()) {
      // Fullscreen and expanded mode are mutually exclusive.
      this._api.getFullscreenManager().stopFullscreen();
    }

    this._expanded = expanded;
    this._api.getConditionsManager()?.setState({
      expand: expanded,
    });
    this._api.getCardElementManager().update();
  }
}
