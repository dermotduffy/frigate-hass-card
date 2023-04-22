/* eslint-disable @typescript-eslint/no-unused-vars */

import { HomeAssistant } from 'custom-card-helpers';
import { CameraConfig, ExtendedHomeAssistant } from '../../types';
import { ViewMedia } from '../../view/media';
import {
  CameraManagerCameraMetadata,
  CameraManagerMediaCapabilities,
  DataQuery,
  EventQuery,
  EventQueryResultsMap,
  PartialEventQuery,
  PartialRecordingQuery,
  PartialRecordingSegmentsQuery,
  RecordingQueryResultsMap,
  RecordingSegmentsQuery,
  RecordingSegmentsQueryResultsMap,
  CameraEndpointsContext,
  CameraConfigs,
  RecordingQuery,
  QueryReturnType,
  CameraManagerCameraCapabilities,
  Engine,
  CameraEndpoints,
  MediaMetadataQuery,
  MediaMetadataQueryResultsMap,
  EngineOptions,
  CameraEndpoint,
} from '../types';
import { getEntityIcon, getEntityTitle } from '../../utils/ha';
import { EntityRegistryManager } from '../../utils/ha/entity-registry';
import { CameraManagerEngine } from '../engine';

export class GenericCameraManagerEngine implements CameraManagerEngine {
  public getEngineType(): Engine {
    return Engine.Generic;
  }

  public async initializeCamera(
    _hass: HomeAssistant,
    _entityRegistryManager: EntityRegistryManager,
    cameraConfig: CameraConfig,
  ): Promise<CameraConfig> {
    return cameraConfig;
  }

  public generateDefaultEventQuery(
    _cameras: CameraConfigs,
    _cameraIDs: Set<string>,
    _query: PartialEventQuery,
  ): EventQuery[] | null {
    return null;
  }

  public generateDefaultRecordingQuery(
    _cameras: CameraConfigs,
    _cameraIDs: Set<string>,
    _query: PartialRecordingQuery,
  ): RecordingQuery[] | null {
    return null;
  }

  public generateDefaultRecordingSegmentsQuery(
    _cameras: CameraConfigs,
    _cameraIDs: Set<string>,
    _query: PartialRecordingSegmentsQuery,
  ): RecordingSegmentsQuery[] | null {
    return null;
  }

  public async getEvents(
    _hass: HomeAssistant,
    _cameras: CameraConfigs,
    _query: EventQuery,
    _engineOptions?: EngineOptions,
  ): Promise<EventQueryResultsMap | null> {
    return null;
  }

  public async getRecordings(
    _hass: HomeAssistant,
    _cameras: CameraConfigs,
    _query: RecordingQuery,
    _engineOptions?: EngineOptions,
  ): Promise<RecordingQueryResultsMap | null> {
    return null;
  }

  public async getRecordingSegments(
    _hass: HomeAssistant,
    _cameras: CameraConfigs,
    _query: RecordingSegmentsQuery,
    _engineOptions?: EngineOptions,
  ): Promise<RecordingSegmentsQueryResultsMap | null> {
    return null;
  }

  public generateMediaFromEvents(
    _hass: HomeAssistant,
    _cameras: CameraConfigs,
    _query: EventQuery,
    _results: QueryReturnType<EventQuery>,
  ): ViewMedia[] | null {
    return null;
  }

  public generateMediaFromRecordings(
    _hass: HomeAssistant,
    _cameras: CameraConfigs,
    _query: RecordingQuery,
    _results: QueryReturnType<RecordingQuery>,
  ): ViewMedia[] | null {
    return null;
  }

  public async getMediaDownloadPath(
    _hass: ExtendedHomeAssistant,
    _cameraConfig: CameraConfig,
    _media: ViewMedia,
  ): Promise<CameraEndpoint | null> {
    return null;
  }

  public async favoriteMedia(
    _hass: HomeAssistant,
    _cameraConfig: CameraConfig,
    _media: ViewMedia,
    _favorite: boolean,
  ): Promise<void> {
    return;
  }

  public getQueryResultMaxAge(_query: DataQuery): number | null {
    return null;
  }

  public async getMediaSeekTime(
    _hass: HomeAssistant,
    _cameras: CameraConfigs,
    _media: ViewMedia,
    _target: Date,
    _engineOptions?: EngineOptions,
  ): Promise<number | null> {
    return null;
  }

  public async getMediaMetadata(
    _hass: HomeAssistant,
    _cameras: CameraConfigs,
    _query: MediaMetadataQuery,
    _engineOptions?: EngineOptions,
  ): Promise<MediaMetadataQueryResultsMap | null> {
    return null;
  }

  public getCameraMetadata(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
  ): CameraManagerCameraMetadata {
    return {
      title:
        cameraConfig.title ??
        getEntityTitle(hass, cameraConfig.camera_entity) ??
        getEntityTitle(hass, cameraConfig.webrtc_card?.entity) ??
        cameraConfig.id ??
        '',
      icon:
        cameraConfig?.icon ??
        getEntityIcon(hass, cameraConfig.camera_entity) ??
        'mdi:video',
    };
  }

  public getCameraCapabilities(
    _cameraConfig: CameraConfig,
  ): CameraManagerCameraCapabilities | null {
    return {
      canFavoriteEvents: false,
      canFavoriteRecordings: false,
      canSeek: false,
      supportsClips: false,
      supportsRecordings: false,
      supportsSnapshots: false,
      supportsTimeline: false,
    };
  }

  public getMediaCapabilities(_media: ViewMedia): CameraManagerMediaCapabilities | null {
    return null;
  }

  public getCameraEndpoints(
    _cameraConfig: CameraConfig,
    _context?: CameraEndpointsContext,
  ): CameraEndpoints | null {
    return null;
  }
}
