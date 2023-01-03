import { HomeAssistant } from 'custom-card-helpers';
import { CameraConfig } from '../types';
import { MediaQueries, MediaQueriesResults } from '../view';
import { ViewMedia } from '../view-media';
import {
  EventQuery,
  PartialEventQuery,
  PartialRecordingQuery,
  PartialRecordingSegmentsQuery,
  QueryReturnType,
  RecordingQuery,
  RecordingSegmentsQuery,
} from './types';

export const CAMERA_MANAGER_ENGINE_EVENT_LIMIT_DEFAULT = 10000;

export interface CameraManagerEngine {
  generateDefaultEventQuery(
    cameraID: string,
    cameraConfig: CameraConfig,
    query: PartialEventQuery,
  ): EventQuery | null;

  generateDefaultRecordingQuery(
    cameraID: string,
    cameraConfig: CameraConfig,
    query: PartialRecordingQuery,
  ): RecordingQuery | null;

  generateDefaultRecordingSegmentsQuery(
    cameraID: string,
    cameraConfig: CameraConfig,
    query: PartialRecordingSegmentsQuery,
  ): RecordingSegmentsQuery | null;

  getEvents(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    query: EventQuery,
  ): Promise<QueryReturnType<EventQuery> | null>;

  getRecordings(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    query: RecordingQuery,
  ): Promise<QueryReturnType<RecordingQuery> | null>;

  getRecordingSegments(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    query: RecordingSegmentsQuery,
  ): Promise<QueryReturnType<RecordingSegmentsQuery> | null>;

  generateMediaFromEvents(
    query: EventQuery,
    results: QueryReturnType<EventQuery>,
  ): ViewMedia[] | null;

  generateMediaFromRecordings(
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

  areMediaQueriesResultsFresh(
    queries: MediaQueries,
    results: MediaQueriesResults,
  ): boolean;
}
