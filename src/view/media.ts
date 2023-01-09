export type ViewMediaType = 'clip' | 'snapshot' | 'recording';

export class ViewMedia {
  protected _mediaType: ViewMediaType;
  protected _cameraID: string;

  constructor(mediaType: ViewMediaType, cameraID: string) {
    this._mediaType = mediaType;
    this._cameraID = cameraID;
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
  public getID(): string | null {
    return null;
  }
  public getStartTime(): Date | null {
    return null;
  }
  public getEndTime(): Date | null {
    return null;
  }
  public getContentID(): string | null {
    return null;
  }
  public getTitle(): string | null {
    return null;
  }
  public getThumbnail(): string | null {
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

export interface EventViewMedia extends ViewMedia {
  getScore(): number | null;
  getWhat(): string[] | null;
  isGroupableWith(that: EventViewMedia): boolean;
  hasClip(): boolean | null;
}

export interface RecordingViewMedia extends ViewMedia {
  getEventCount(): number | null;
}
