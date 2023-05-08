import { CameraConfig, FrigateCardView } from '../types';
import { ViewMedia } from '../view/media';

// ====
// Base
// ====

export enum QueryType {
  Event = 'event-query',
  Recording = 'recording-query',
  RecordingSegments = 'recording-segments-query',
  MediaMetadata = 'media-metadata',
}

export enum QueryResultsType {
  Event = 'event-results',
  Recording = 'recording-results',
  RecordingSegments = 'recording-segments-results',
  MediaMetadata = 'media-metadata-results',
}

export enum Engine {
  Frigate = 'frigate',
  Generic = 'generic',
  MotionEye = 'motioneye',
}

export interface DataQuery {
  type: QueryType;
  cameraIDs: Set<string>;
}
export type PartialDataQuery = Partial<DataQuery>;

interface TimeBasedDataQuery {
  start: Date;
  end: Date;
}

interface LimitedDataQuery {
  limit: number;
}

export interface MediaQuery
  extends DataQuery,
    Partial<TimeBasedDataQuery>,
    Partial<LimitedDataQuery> {
  favorite?: boolean;
}

export interface QueryResults {
  type: QueryResultsType;
  engine: Engine;
  expiry?: Date;
  cached?: boolean;
}

// Generic recording segment type (inspired by Frigate recording segments).
export interface RecordingSegment {
  start_time: number;
  end_time: number;
  id: string;
}

export type QueryReturnType<QT> = QT extends EventQuery
  ? EventQueryResults
  : QT extends RecordingQuery
  ? RecordingQueryResults
  : QT extends RecordingSegmentsQuery
  ? RecordingSegmentsQueryResults
  : QT extends MediaMetadataQuery
  ? MediaMetadataQueryResults
  : never;
export type PartialQueryConcreteType<PQT> = PQT extends PartialEventQuery
  ? EventQuery
  : PQT extends PartialRecordingQuery
  ? RecordingQuery
  : PQT extends PartialRecordingSegmentsQuery
  ? RecordingSegmentsQuery
  : never;

export type ResultsMap<QT> = Map<QT, QueryReturnType<QT>>;
export type EventQueryResultsMap = ResultsMap<EventQuery>;
export type RecordingQueryResultsMap = ResultsMap<RecordingQuery>;
export type RecordingSegmentsQueryResultsMap = ResultsMap<RecordingSegmentsQuery>;
export type MediaMetadataQueryResultsMap = ResultsMap<MediaMetadataQuery>;

export interface MediaMetadata {
  days?: Set<string>;
  tags?: Set<string>;
  where?: Set<string>;
  what?: Set<string>;
}

interface BaseCapabilities {
  canFavoriteEvents: boolean;
  canFavoriteRecordings: boolean;
  canSeek: boolean;

  supportsClips: boolean;
  supportsRecordings: boolean;
  supportsSnapshots: boolean;
  supportsTimeline: boolean;
}

export type CameraManagerCapabilities = BaseCapabilities;
export type CameraManagerCameraCapabilities = BaseCapabilities;
export interface CameraManagerMediaCapabilities {
  canFavorite: boolean;
  canDownload: boolean;
}

export interface CameraManagerCameraMetadata {
  title: string;
  icon: string;
  engineLogo?: string;
}

export interface CameraEndpointsContext {
  media?: ViewMedia;
  view?: FrigateCardView;
}

export interface CameraEndpoint {
  endpoint: string;
  sign?: boolean;
}

export interface CameraEndpoints {
  ui?: CameraEndpoint;
  go2rtc?: CameraEndpoint;
  jsmpeg?: CameraEndpoint;
  webrtcCard?: CameraEndpoint;
}

export type CameraConfigs = Map<string, CameraConfig>;

export interface EngineOptions {
  useCache?: boolean;
}

// ===========
// Event Query
// ===========

export interface EventQuery extends MediaQuery {
  type: QueryType.Event;

  // Frigate equivalent: has_snapshot
  hasSnapshot?: boolean;

  // Frigate equivalent: has_clip
  hasClip?: boolean;

  // Frigate equivalent: label
  what?: Set<string>;

  // Frigate equivalent: sub_label
  tags?: Set<string>;

  // Frigate equivalent: zone
  where?: Set<string>;
}
export type PartialEventQuery = Partial<EventQuery>;

export interface EventQueryResults extends QueryResults {
  type: QueryResultsType.Event;
}

// ===============
// Recording Query
// ===============

export interface RecordingQuery extends MediaQuery {
  type: QueryType.Recording;
}
export type PartialRecordingQuery = Partial<RecordingQuery>;

export interface RecordingQueryResults extends QueryResults {
  type: QueryResultsType.Recording;
}

// ========================
// Recording Segments Query
// ========================

export interface RecordingSegmentsQuery extends DataQuery, TimeBasedDataQuery {
  type: QueryType.RecordingSegments;
}
export type PartialRecordingSegmentsQuery = Partial<RecordingSegmentsQuery>;

export interface RecordingSegmentsQueryResults extends QueryResults {
  type: QueryResultsType.RecordingSegments;
  segments: RecordingSegment[];
}

// ====================
// Media metadata Query
// ====================

export interface MediaMetadataQuery extends DataQuery {
  type: QueryType.MediaMetadata;
}

export interface MediaMetadataQueryResults extends QueryResults {
  type: QueryResultsType.MediaMetadata;
  metadata: MediaMetadata;
}
