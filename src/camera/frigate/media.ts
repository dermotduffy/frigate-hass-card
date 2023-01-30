import { HomeAssistant } from 'custom-card-helpers';
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
  getRecordingID,
  getRecordingMediaContentID,
  getRecordingTitle,
} from './util';

export class FrigateEventViewMedia extends ViewMedia implements EventViewMedia {
  protected _event: FrigateEvent;
  protected _contentID: string;
  protected _thumbnail: string;

  constructor(
    mediaType: ViewMediaType,
    cameraID: string,
    event: FrigateEvent,
    contentID: string,
    thumbnail: string,
  ) {
    super(mediaType, cameraID);
    this._event = event;
    this._contentID = contentID;
    this._thumbnail = thumbnail;
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
  public getID(): string {
    return this._event.id;
  }
  public getContentID(): string {
    return this._contentID;
  }
  public getTitle(): string | null {
    return getEventTitle(this._event);
  }
  public getThumbnail(): string | null {
    return this._thumbnail;
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
}

export class FrigateRecordingViewMedia extends ViewMedia implements RecordingViewMedia {
  protected _recording: FrigateRecording;
  protected _id: string;
  protected _contentID: string;
  protected _title: string;

  constructor(
    mediaType: ViewMediaType,
    cameraID: string,
    recording: FrigateRecording,
    id: string,
    contentID: string,
    title: string,
  ) {
    super(mediaType, cameraID);
    this._recording = recording;
    this._id = id;
    this._contentID = contentID;
    this._title = title;
  }

  public getID(): string {
    return this._id;
  }
  public getStartTime(): Date {
    return this._recording.startTime;
  }
  public getEndTime(): Date {
    return this._recording.endTime;
  }
  public getContentID(): string | null {
    return this._contentID;
  }
  public getTitle(): string | null {
    return this._title;
  }
  public getEventCount(): number {
    return this._recording.events;
  }
}

export class FrigateViewMediaFactory {
  static createEventViewMedia(
    mediaType: 'clip' | 'snapshot',
    cameraID: string,
    cameraConfig: CameraConfig,
    event: FrigateEvent,
  ): FrigateEventViewMedia | null {
    if (
      (mediaType === 'clip' && !event.has_clip) ||
      (mediaType === 'snapshot' && !event.has_snapshot) ||
      !cameraConfig.frigate.client_id ||
      !cameraConfig.frigate.camera_name
    ) {
      return null;
    }

    return new FrigateEventViewMedia(
      mediaType,
      cameraID,
      event,
      getEventMediaContentID(
        cameraConfig.frigate.client_id,
        cameraConfig.frigate.camera_name,
        event,
        mediaType === 'clip' ? 'clips' : 'snapshots',
      ),
      getEventThumbnailURL(cameraConfig.frigate.client_id, event),
    );
  }

  static createRecordingViewMedia(
    hass: HomeAssistant,
    cameraID: string,
    recording: FrigateRecording,
    cameraConfig: CameraConfig,
  ): FrigateRecordingViewMedia | null {
    if (!cameraConfig.frigate.client_id || !cameraConfig.frigate.camera_name) {
      return null;
    }

    return new FrigateRecordingViewMedia(
      'recording',
      cameraID,
      recording,
      getRecordingID(cameraConfig, recording),
      getRecordingMediaContentID(
        cameraConfig.frigate.client_id,
        cameraConfig.frigate.camera_name,
        recording,
      ),
      getRecordingTitle(hass, cameraConfig, recording),
    );
  }
}
