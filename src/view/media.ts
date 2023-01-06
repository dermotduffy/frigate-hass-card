import fromUnixTime from 'date-fns/fromUnixTime';
import isEqual from 'lodash-es/isEqual';
import { CameraConfig } from '../types.js';
import {
  getEventMediaContentID,
  getEventThumbnailURL,
  getEventTitle,
  getRecordingMediaContentID,
  getRecordingTitle,
} from '../camera/frigate/util.js';
import { FrigateEvent, FrigateRecording } from '../camera/frigate/types.js';
import { ViewMediaClassifier } from './media-classifier.js';

export type ViewMediaType = 'clip' | 'snapshot' | 'recording';
export type ViewMediaSourceType = FrigateEvent | FrigateRecording;

class ViewMediaBase<T extends ViewMediaSourceType> {
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

export interface EventViewMedia extends ViewMedia {
  getScore(): number | null;
  getWhat(): string[] | null;
  isGroupableWith(that: EventViewMedia): boolean;
}

export interface RecordingViewMedia extends ViewMedia {
  getEventCount(): number | null;
}

// Creates a 'public interface only' version of ViewMediaBase for use elsewhere
// (typescript struggles with the ViewMediaClassifier classification functions
// used above if the object has data elements).
export type ViewMedia = {
  [P in keyof ViewMediaBase<ViewMediaSourceType>]: ViewMediaBase<ViewMediaSourceType>[P];
};

export class FrigateEventViewMedia
  extends ViewMediaBase<FrigateEvent>
  implements EventViewMedia
{
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
      ViewMediaClassifier.isClip(this) ? 'clips' : 'snapshots',
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public isGroupableWith(that: EventViewMedia): boolean {
    return (
      this.getMediaType() === that.getMediaType() &&
      isEqual(this.getWhere(), that.getWhere()) &&
      isEqual(this.getWhat(), that.getWhat())
    );
  }
}

export class FrigateRecordingViewMedia
  extends ViewMediaBase<FrigateRecording>
  implements RecordingViewMedia
{
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
}
