import fromUnixTime from 'date-fns/fromUnixTime';
import isEqual from 'lodash-es/isEqual';
import {
  BrowseMediaSource,
  CameraConfig,
  FrigateEvent,
  FrigateRecording,
  MEDIA_TYPE_IMAGE,
} from './types.js';
import { ModifyInterface } from './utils/basic.js';
import {
  getEventMediaContentID,
  getEventThumbnailURL,
  getEventTitle,
  getRecordingMediaContentID,
  getRecordingTitle,
} from './camera/frigate/frigate.js';

export type ViewMediaType = 'clip' | 'snapshot' | 'recording';
export type ViewMediaSourceType = FrigateEvent | FrigateRecording | BrowseMediaSource;

export class ViewMediaClassifier {
  public static isFrigateMedia(
    media: ViewMedia,
  ): media is FrigateEventViewMedia | FrigateRecordingViewMedia {
    return this.isFrigateEvent(media) || this.isFrigateRecording(media);
  }
  public static isFrigateEvent(media: ViewMedia): media is FrigateEventViewMedia {
    return media instanceof FrigateEventViewMedia;
  }
  public static isFrigateRecording(
    media: ViewMedia,
  ): media is FrigateRecordingViewMedia {
    return media instanceof FrigateRecordingViewMedia;
  }

  // Typescript conveniences.
  public static isMediaWithStartEndTime(media: ViewMedia): media is ModifyInterface<
    ViewMedia,
    {
      getStartTime(): Date;
      getEndTime(): Date;
    }
  > {
    return !!media.getStartTime() && !!media.getEndTime();
  }
  public static isMediaWithStartTime(media: ViewMedia): media is ModifyInterface<
    ViewMedia,
    {
      getStartTime(): Date;
    }
  > {
    return !!media.getStartTime();
  }
  public static isMediaWithEndTime(media: ViewMedia): media is ModifyInterface<
    ViewMedia,
    {
      getEndTime(): Date;
    }
  > {
    return !!media.getEndTime();
  }
  public static isMediaWithID(media: ViewMedia): media is ModifyInterface<
    ViewMedia,
    {
      getID(): string;
    }
  > {
    return !!media.getID();
  }
}

class ViewMediaBase<T extends ViewMediaSourceType> {
  protected _mediaType: ViewMediaType;
  protected _cameraID: string;
  protected _source: T;

  constructor(mediaType: ViewMediaType, cameraID: string, source: T) {
    this._mediaType = mediaType;
    this._cameraID = cameraID;
    this._source = source;
  }

  public isEvent(): boolean {
    return this._mediaType === 'clip' || this._mediaType === 'snapshot';
  }
  public isRecording(): boolean {
    return this._mediaType === 'recording';
  }
  public isClip(): boolean {
    return this._mediaType === 'clip';
  }
  public isSnapshot(): boolean {
    return this._mediaType === 'snapshot';
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
  public isVideo(): boolean {
    return this.isClip() || this.isRecording();
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public isGroupableWith(that: ViewMedia): boolean {
    return (
      this.getMediaType() === that.getMediaType() &&
      isEqual(this.getWhere(), that.getWhere()) &&
      isEqual(this.getWhat(), that.getWhat())
    );
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
  public getWhat(): string[] | null {
    return null;
  }
  public getWhere(): string[] | null {
    return null;
  }
  public getScore(): number | null {
    return null;
  }
  public getEventCount(): number | null {
    return null;
  }
}

// Creates a 'public interface only' version of ViewMediaBase for use elsewhere
// (typescript struggles with the ViewMediaClassifier classification functions
// used above if the object has data elements).
export type ViewMedia = {
  [P in keyof ViewMediaBase<ViewMediaSourceType>]: ViewMediaBase<ViewMediaSourceType>[P];
};

export class HomeAssistantBrowserViewMedia extends ViewMediaBase<BrowseMediaSource> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getID(_cameraConfig?: CameraConfig): string | null {
    return this._source.media_content_id;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getContentID(_cameraConfig?: CameraConfig): string | null {
    return this._source.media_content_id;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getTitle(_cameraConfig?: CameraConfig): string | null {
    return this._source.title;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getThumbnail(_cameraConfig?: CameraConfig): string | null {
    return this._source.thumbnail;
  }
}

export class FrigateEventViewMedia extends ViewMediaBase<FrigateEvent> {
  public hasClip(): boolean {
    return !!this._source.has_clip;
  }
  public getClipEquivalent(): ViewMedia | null {
    if (!this.hasClip()) {
      return null;
    }
    return ViewMediaFactory.createViewMediaFromFrigateEvent(
      'clip',
      this._cameraID,
      this._source,
    );
  }
  public getStartTime(): Date {
    return fromUnixTime(this._source.start_time);
  }
  public getEndTime(): Date | null {
    return this._source.end_time ? fromUnixTime(this._source.end_time) : null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getID(_cameraConfig?: CameraConfig): string {
    return this._source.id;
  }
  public getContentID(cameraConfig?: CameraConfig): string | null {
    if (
      !cameraConfig ||
      !cameraConfig.frigate.client_id ||
      !cameraConfig.frigate.camera_name
    ) {
      return null;
    }
    return getEventMediaContentID(
      cameraConfig.frigate.client_id,
      cameraConfig.frigate.camera_name,
      this._source,
      this.isClip() ? 'clips' : 'snapshots',
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getTitle(_cameraConfig?: CameraConfig): string | null {
    return getEventTitle(this._source);
  }

  public getThumbnail(cameraConfig?: CameraConfig): string | null {
    if (cameraConfig?.frigate.client_id) {
      return getEventThumbnailURL(cameraConfig.frigate.client_id, this._source);
    }
    return null;
  }
  public isFavorite(): boolean | null {
    return this._source.retain_indefinitely ?? null;
  }
  public setFavorite(favorite: boolean): void {
    this._source.retain_indefinitely = favorite;
  }
  public getWhat(): string[] | null {
    return [this._source.label];
  }
  public getWhere(): string[] | null {
    const zones = this._source.zones;
    return zones.length ? zones : null;
  }
  public getScore(): number | null {
    return this._source.top_score;
  }
}

export class FrigateRecordingViewMedia extends ViewMediaBase<FrigateRecording> {
  public getID(cameraConfig?: CameraConfig): string | null {
    // ID name is derived from the real camera name (not CameraID) since the
    // recordings for the same camera across multiple zones will be the same and
    // can be dedup'd from this id.
    if (cameraConfig) {
      return `${cameraConfig.frigate?.client_id ?? ''}/${
        cameraConfig.frigate.camera_name ?? ''
      }/${this._source.start_time}/${this._source.end_time}}`;
    }
    return null;
  }
  public getStartTime(): Date {
    return fromUnixTime(this._source.start_time);
  }
  public getEndTime(): Date {
    return fromUnixTime(this._source.end_time);
  }
  public getContentID(cameraConfig?: CameraConfig): string | null {
    if (
      !cameraConfig ||
      !cameraConfig.frigate.client_id ||
      !cameraConfig.frigate.camera_name
    ) {
      return null;
    }
    return getRecordingMediaContentID(
      cameraConfig.frigate.client_id,
      cameraConfig.frigate.camera_name,
      this._source,
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getTitle(_cameraConfig?: CameraConfig): string | null {
    return getRecordingTitle(this._source);
  }
  public getEventCount(): number {
    return this._source.events;
  }
}

export class ViewMediaFactory {
  static createViewMediaFromFrigateEvent(
    type: 'clip' | 'snapshot',
    cameraID: string,
    event: FrigateEvent,
  ): ViewMedia | null {
    if (
      (type === 'clip' && event.has_clip) ||
      (type === 'snapshot' && event.has_snapshot)
    ) {
      return new FrigateEventViewMedia(type, cameraID, event);
    }
    return null;
  }

  static createViewMediaFromFrigateRecording(
    cameraID: string,
    recording: FrigateRecording,
  ): ViewMedia | null {
    return new FrigateRecordingViewMedia('recording', cameraID, recording);
  }

  static createViewMediaFromBrowseMediaSource(
    cameraID: string,
    browseMedia: BrowseMediaSource,
  ): ViewMedia | null {
    return new HomeAssistantBrowserViewMedia(
      browseMedia.media_content_type === MEDIA_TYPE_IMAGE ? 'snapshot' : 'clip',
      cameraID,
      browseMedia,
    );
  }
}
