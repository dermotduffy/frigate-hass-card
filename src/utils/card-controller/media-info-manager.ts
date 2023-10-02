import { MediaLoadedInfo } from '../../types';
import { log } from '../debug';
import { isValidMediaLoadedInfo } from '../media-info';
import { CardMediaLoadedAPI } from './types';

export class MediaLoadedInfoManager {
  protected _api: CardMediaLoadedAPI;
  protected _current: MediaLoadedInfo | null = null;
  protected _lastKnown: MediaLoadedInfo | null = null;

  constructor(api: CardMediaLoadedAPI) {
    this._api = api;
  }

  public set(mediaInfo: MediaLoadedInfo): void {
    if (!isValidMediaLoadedInfo(mediaInfo)) {
      return;
    }

    log(
      this._api.getConfigManager().getCardWideConfig(),
      `Frigate Card media load: `,
      mediaInfo,
    );

    this._current = mediaInfo;
    this._lastKnown = mediaInfo;

    this._api.getConditionsManager().setState({ media_loaded: true });

    // Fresh media information may change how the card is rendered.
    this._api.getStyleManager().setExpandedMode();
    this._api.getCardElementManager().update();
  }

  public get(): MediaLoadedInfo | null {
    return this._current;
  }

  public getLastKnown(): MediaLoadedInfo | null {
    return this._lastKnown;
  }

  public clear(): void {
    this._current = null;
    this._api.getConditionsManager().setState({ media_loaded: false });
  }

  public has(): boolean {
    return !!this._current;
  }
}
