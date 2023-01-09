import fromUnixTime from 'date-fns/fromUnixTime';
import isEqual from 'lodash-es/isEqual';
import { CameraConfig } from '../../types';
import {
  ViewMedia,
  EventViewMedia,
  RecordingViewMedia,
  ViewMediaType,
} from '../../view/media';
import { FrigateEvent, FrigateRecording } from './types';
import {
  getEventMediaContentID,
  getEventThumbnailURL,
  getEventTitle,
  getRecordingMediaContentID,
  getRecordingTitle,
} from './util';

export class FrigateEventViewMedia extends ViewMedia implements EventViewMedia {
  protected _event: FrigateEvent;

  constructor(mediaType: ViewMediaType, cameraID: string, event: FrigateEvent) {
    super(mediaType, cameraID);
    this._event = event;
  }

  public hasClip(): boolean {
    return !!this._event.has_clip;
  }
  public getStartTime(): Date {
    return fromUnixTime(this._event.start_time);
  }
  public getEndTime(): Date | null {
    return this._event.end_time ? fromUnixTime(this._event.end_time) : null;
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getID(_cameraConfig?: CameraConfig): string {
    return this._event.id;
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
      this._event,
      this._mediaType === 'clip' ? 'clips' : 'snapshots',
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getTitle(_cameraConfig?: CameraConfig): string | null {
    return getEventTitle(this._event);
  }

  public getThumbnail(cameraConfig?: CameraConfig): string | null {
    if (cameraConfig?.frigate.client_id) {
      return getEventThumbnailURL(cameraConfig.frigate.client_id, this._event);
    }
    return null;
  }
  public isFavorite(): boolean | null {
    return this._event.retain_indefinitely ?? null;
  }
  public setFavorite(favorite: boolean): void {
    this._event.retain_indefinitely = favorite;
  }
  public getWhat(): string[] | null {
    return [this._event.label];
  }
  public getWhere(): string[] | null {
    const zones = this._event.zones;
    return zones.length ? zones : null;
  }
  public getScore(): number | null {
    return this._event.top_score;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public isGroupableWith(that: EventViewMedia): boolean {
    return (
      this.getMediaType() === that.getMediaType() &&
      isEqual(this.getWhere(), that.getWhere()) &&
      isEqual(this.getWhat(), that.getWhat())
    );
  }

  public getClipEquivalent(): EventViewMedia | null {
    if (!this.hasClip()) {
      return null;
    }
    return FrigateViewMediaFactory.createEventViewMedia(
      'clip',
      this._cameraID,
      this._event,
    );
  }
}

export class FrigateRecordingViewMedia extends ViewMedia implements RecordingViewMedia {
  protected _recording: FrigateRecording;

  constructor(mediaType: ViewMediaType, cameraID: string, recording: FrigateRecording) {
    super(mediaType, cameraID);
    this._recording = recording;
  }

  public getID(cameraConfig?: CameraConfig): string | null {
    // ID name is derived from the real camera name (not CameraID) since the
    // recordings for the same camera across multiple zones will be the same and
    // can be dedup'd from this id.
    if (cameraConfig) {
      return `${cameraConfig.frigate?.client_id ?? ''}/${
        cameraConfig.frigate.camera_name ?? ''
      }/${this._recording.startTime.getTime()}/${this._recording.endTime.getTime()}}`;
    }
    return null;
  }
  public getStartTime(): Date {
    return this._recording.startTime;
  }
  public getEndTime(): Date {
    return this._recording.endTime;
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
      this._recording,
    );
  }
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getTitle(cameraConfig?: CameraConfig): string | null {
    if (!cameraConfig) {
      return null;
    }
    return getRecordingTitle(cameraConfig, this._recording);
  }
  public getEventCount(): number {
    return this._recording.events;
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
