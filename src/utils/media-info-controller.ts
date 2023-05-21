import { MediaLoadedInfo } from '../types';

export class MediaLoadedInfoController {
  protected _current: MediaLoadedInfo | null = null;
  protected _lastKnown: MediaLoadedInfo | null = null;

  public set(current: MediaLoadedInfo): void {
    this._current = current;
    this._lastKnown = current;
  }

  public get(): MediaLoadedInfo | null {
    return this._current;
  }

  public getLastKnown(): MediaLoadedInfo | null {
    return this._lastKnown;
  }

  public clear(): void {
    this._current = null;
  }

  public has(): boolean {
    return !!this._current;
  }
}
