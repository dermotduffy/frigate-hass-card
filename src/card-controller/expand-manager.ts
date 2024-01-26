import { CardExpandAPI } from './types';

export class ExpandManager {
  protected _expanded = false;
  protected _api: CardExpandAPI;

  constructor(api: CardExpandAPI) {
    this._api = api;
  }

  public initialize(): void {
    this._setConditionState();
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
    this._setConditionState();
    this._api.getCardElementManager().update();
  }

  protected _setConditionState(): void {
    this._api.getConditionsManager()?.setState({
      expand: this._expanded,
    });
  }
}
