import { CameraConfig } from '../types.js';
export type ViewMediaType = 'clip' | 'snapshot' | 'recording';

export class ViewMediaBase<T> {
  protected _mediaType: ViewMediaType;
  protected _cameraID: string;
  protected _source: T;

  constructor(mediaType: ViewMediaType, cameraID: string, source: T) {
    this._mediaType = mediaType;
    this._cameraID = cameraID;
    this._source = source;
  }
  public getContentType(): 'image' | 'video' {
    return this._mediaType === 'snapshot' ? 'image' : 'video';
  }
  public getCameraID(): string {
    return this._cameraID;
  }
  public getMediaType(): ViewMediaType {
    return this._mediaType;
  }
  public getSource(): T {
    return this._source;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getID(_cameraConfig?: CameraConfig): string | null {
    return null;
  }
  public getStartTime(): Date | null {
    return null;
  }
  public getEndTime(): Date | null {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getContentID(_cameraConfig?: CameraConfig): string | null {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getTitle(_cameraConfig?: CameraConfig): string | null {
    return null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getThumbnail(_cameraConfig?: CameraConfig): string | null {
    return null;
  }
  public isFavorite(): boolean | null {
    return null;
  }

  // Sets the favorite attribute (if any). This purely sets the media item as a
  // favorite in JS.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public setFavorite(_favorite: boolean): void {
    return;
  }
  public getWhere(): string[] | null {
    return null;
  }
}

export interface EventViewMedia<T> extends ViewMediaBase<T> {
  getScore(): number | null;
  getWhat(): string[] | null;
  isGroupableWith(that: EventViewMedia<T>): boolean;
  hasClip(): boolean | null;
}

export interface RecordingViewMedia<T> extends ViewMediaBase<T> {
  getEventCount(): number | null;
}

export type ViewMedia = ViewMediaBase<unknown>;
