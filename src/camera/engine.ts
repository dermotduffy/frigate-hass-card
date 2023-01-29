import { HomeAssistant } from 'custom-card-helpers';
import { CameraConfig } from '../types';
import { ViewMedia } from '../view/media';
import {
  DataQuery,
  EventQuery,
  EventQueryResultsMap,
  MediaMetadata,
  PartialEventQuery,
  PartialRecordingQuery,
  PartialRecordingSegmentsQuery,
  QueryReturnType,
  RecordingQuery,
  RecordingQueryResultsMap,
  RecordingSegmentsQuery,
  RecordingSegmentsQueryResultsMap,
  CameraManagerEngineCapabilities,
  CameraManagerMediaCapabilities,
} from './types';

export const CAMERA_MANAGER_ENGINE_EVENT_LIMIT_DEFAULT = 10000;

export interface CameraManagerEngine {
  generateDefaultEventQuery(
    cameras: Map<string, CameraConfig>,
    cameraIDs: Set<string>,
    query: PartialEventQuery,
  ): EventQuery[] | null;

  generateDefaultRecordingQuery(
    cameras: Map<string, CameraConfig>,
    cameraIDs: Set<string>,
    query: PartialRecordingQuery,
  ): RecordingQuery[] | null;

  generateDefaultRecordingSegmentsQuery(
    cameras: Map<string, CameraConfig>,
    cameraIDs: Set<string>,
    query: PartialRecordingSegmentsQuery,
  ): RecordingSegmentsQuery[] | null;

  getEvents(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    query: EventQuery,
  ): Promise<EventQueryResultsMap | null>;

  getRecordings(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    query: RecordingQuery,
  ): Promise<RecordingQueryResultsMap | null>;

  getRecordingSegments(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    query: RecordingSegmentsQuery,
  ): Promise<RecordingSegmentsQueryResultsMap | null>;

  generateMediaFromEvents(
    cameras: Map<string, CameraConfig>,
    query: EventQuery,
    results: QueryReturnType<EventQuery>,
  ): ViewMedia[] | null;

  generateMediaFromRecordings(
    cameras: Map<string, CameraConfig>,
    query: RecordingQuery,
    results: QueryReturnType<RecordingQuery>,
  ): ViewMedia[] | null;

  getMediaDownloadPath(cameraConfig: CameraConfig, media: ViewMedia): string | null;

  favoriteMedia(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
    media: ViewMedia,
    favorite: boolean,
  ): Promise<void>;

  getQueryResultMaxAge(query: DataQuery): number | null;

  getMediaSeekTime(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    media: ViewMedia,
    target: Date,
  ): Promise<number | null>;

  getMediaMetadata(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
  ): Promise<MediaMetadata | null>;

  getCapabilities(): CameraManagerEngineCapabilities | null;
  getMediaCapabilities(media: ViewMedia): CameraManagerMediaCapabilities | null;
}
