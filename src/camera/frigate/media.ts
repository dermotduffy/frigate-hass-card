import fromUnixTime from 'date-fns/fromUnixTime';
import isEqual from 'lodash-es/isEqual';
import { CameraConfig } from '../../types';
import { ViewMediaBase, EventViewMedia, RecordingViewMedia } from '../../view/media';
import { FrigateEvent, FrigateRecording } from './types';
import {
  getEventMediaContentID,
  getEventThumbnailURL,
  getEventTitle,
  getRecordingMediaContentID,
  getRecordingTitle,
} from './util';

export class FrigateEventViewMedia
  extends ViewMediaBase<FrigateEvent>
  implements EventViewMedia<FrigateEvent>
{
  public hasClip(): boolean {
    return !!this._source.has_clip;
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
      this._mediaType === 'clip' ? 'clips' : 'snapshots',
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
  public isGroupableWith(that: EventViewMedia<unknown>): boolean {
    return (
      this.getMediaType() === that.getMediaType() &&
      isEqual(this.getWhere(), that.getWhere()) &&
      isEqual(this.getWhat(), that.getWhat())
    );
  }

  public getClipEquivalent(): EventViewMedia<FrigateEvent> | null {
    if (!this.hasClip()) {
      return null;
    }
    return FrigateViewMediaFactory.createEventViewMedia(
      'clip',
      this._cameraID,
      this._source,
    );
  }
}

export class FrigateRecordingViewMedia
  extends ViewMediaBase<FrigateRecording>
  implements RecordingViewMedia<FrigateRecording>
{
  public getID(cameraConfig?: CameraConfig): string | null {
    // ID name is derived from the real camera name (not CameraID) since the
    // recordings for the same camera across multiple zones will be the same and
    // can be dedup'd from this id.
    if (cameraConfig) {
      return `${cameraConfig.frigate?.client_id ?? ''}/${
        cameraConfig.frigate.camera_name ?? ''
      }/${this._source.startTime.getTime()}/${this._source.endTime.getTime()}}`;
    }
    return null;
  }
  public getStartTime(): Date {
    return this._source.startTime;
  }
  public getEndTime(): Date {
    return this._source.endTime;
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
  public getTitle(cameraConfig?: CameraConfig): string | null {
    if (!cameraConfig) {
      return null;
    }
    return getRecordingTitle(cameraConfig, this._source);
  }
  public getEventCount(): number {
    return this._source.events;
  }
}

export class FrigateViewMediaFactory {
  static createEventViewMedia(
    type: 'clip' | 'snapshot',
    cameraID: string,
    event: FrigateEvent,
  ): FrigateEventViewMedia | null {
    if (
      (type === 'clip' && event.has_clip) ||
      (type === 'snapshot' && event.has_snapshot)
    ) {
      return new FrigateEventViewMedia(type, cameraID, event);
    }
    return null;
  }

  static createRecordingViewMedia(
    cameraID: string,
    recording: FrigateRecording,
  ): FrigateRecordingViewMedia | null {
    return new FrigateRecordingViewMedia('recording', cameraID, recording);
  }
}
