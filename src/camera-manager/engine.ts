import { HomeAssistant } from 'custom-card-helpers';
import { CameraConfig, ExtendedHomeAssistant } from '../types';
import { EntityRegistryManager } from '../utils/ha/entity-registry';
import { ViewMedia } from '../view/media';
import {
  DataQuery,
  EventQuery,
  EventQueryResultsMap,
  PartialEventQuery,
  PartialRecordingQuery,
  PartialRecordingSegmentsQuery,
  QueryReturnType,
  RecordingQuery,
  RecordingQueryResultsMap,
  RecordingSegmentsQuery,
  RecordingSegmentsQueryResultsMap,
  CameraManagerCameraCapabilities,
  CameraManagerMediaCapabilities,
  CameraManagerCameraMetadata,
  CameraEndpointsContext,
  CameraConfigs,
  Engine,
  CameraEndpoints,
  MediaMetadataQuery,
  MediaMetadataQueryResultsMap,
  EngineOptions,
  CameraEndpoint,
} from './types';

export const CAMERA_MANAGER_ENGINE_EVENT_LIMIT_DEFAULT = 10000;

export interface CameraManagerEngine {
  getEngineType(): Engine;

  initializeCamera(
    hass: HomeAssistant,
    entityRegistryManager: EntityRegistryManager,
    cameraConfig: CameraConfig,
  ): Promise<CameraConfig>;

  generateDefaultEventQuery(
    cameras: CameraConfigs,
    cameraIDs: Set<string>,
    query: PartialEventQuery,
  ): EventQuery[] | null;

  generateDefaultRecordingQuery(
    cameras: CameraConfigs,
    cameraIDs: Set<string>,
    query: PartialRecordingQuery,
  ): RecordingQuery[] | null;

  generateDefaultRecordingSegmentsQuery(
    cameras: CameraConfigs,
    cameraIDs: Set<string>,
    query: PartialRecordingSegmentsQuery,
  ): RecordingSegmentsQuery[] | null;

  getEvents(
    hass: HomeAssistant,
    cameras: CameraConfigs,
    query: EventQuery,
    engineOptions?: EngineOptions,
  ): Promise<EventQueryResultsMap | null>;

  getRecordings(
    hass: HomeAssistant,
    cameras: CameraConfigs,
    query: RecordingQuery,
    engineOptions?: EngineOptions,
  ): Promise<RecordingQueryResultsMap | null>;

  getRecordingSegments(
    hass: HomeAssistant,
    cameras: CameraConfigs,
    query: RecordingSegmentsQuery,
    engineOptions?: EngineOptions,
  ): Promise<RecordingSegmentsQueryResultsMap | null>;

  generateMediaFromEvents(
    hass: HomeAssistant,
    cameras: CameraConfigs,
    query: EventQuery,
    results: QueryReturnType<EventQuery>,
  ): ViewMedia[] | null;

  generateMediaFromRecordings(
    hass: HomeAssistant,
    cameras: CameraConfigs,
    query: RecordingQuery,
    results: QueryReturnType<RecordingQuery>,
  ): ViewMedia[] | null;

  getMediaDownloadPath(
    hass: ExtendedHomeAssistant,
    cameraConfig: CameraConfig,
    media: ViewMedia,
  ): Promise<CameraEndpoint | null>;

  favoriteMedia(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
    media: ViewMedia,
    favorite: boolean,
  ): Promise<void>;

  getQueryResultMaxAge(query: DataQuery): number | null;

  getMediaSeekTime(
    hass: HomeAssistant,
    cameras: CameraConfigs,
    media: ViewMedia,
    target: Date,
    engineOptions?: EngineOptions,
  ): Promise<number | null>;

  getMediaMetadata(
    hass: HomeAssistant,
    cameras: CameraConfigs,
    query: MediaMetadataQuery,
    engineOptions?: EngineOptions,
  ): Promise<MediaMetadataQueryResultsMap | null>;

  getCameraMetadata(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
  ): CameraManagerCameraMetadata;

  getCameraCapabilities(
    cameraConfig: CameraConfig,
  ): CameraManagerCameraCapabilities | null;

  getMediaCapabilities(media: ViewMedia): CameraManagerMediaCapabilities | null;

  getCameraEndpoints(
    cameraConfig: CameraConfig,
    context?: CameraEndpointsContext,
  ): CameraEndpoints | null;
}
