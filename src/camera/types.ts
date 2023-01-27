import { RecordingSegment } from '../types';
import { FrigateEvent, FrigateRecording } from './frigate/types';

// ====
// Base
// ====

export enum QueryType {
  Event = 'event-query',
  Recording = 'recording-query',
  RecordingSegments = 'recording-segments-query',
}

export enum QueryResultsType {
  Event = 'event-results',
  Recording = 'recording-results',
  RecordingSegments = 'recording-segments-results',
}

export enum Engine {
  Frigate = 'frigate',
}

export interface DataQuery {
  type: QueryType;
  cameraIDs: Set<string>;
}
export type PartialDataQuery = Partial<DataQuery>;

export interface TimeBasedDataQuery {
  start: Date;
  end: Date;
}

export interface LimitedDataQuery {
  limit: number;
}

export interface MediaQuery
  extends DataQuery,
    Partial<TimeBasedDataQuery>,
    Partial<LimitedDataQuery> {}

export interface QueryResults {
  type: QueryResultsType;
  engine: Engine;
  expiry?: Date;
  cached?: boolean;
}

export type QueryReturnType<QT> = QT extends EventQuery
  ? EventQueryResults
  : QT extends RecordingQuery
  ? RecordingQueryResults
  : QT extends RecordingSegmentsQuery
  ? RecordingSegmentsQueryResults
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

export interface MediaMetadata {
  where?: Set<string>;
  what?: Set<string>;
  days?: Set<string>;
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

  // Frigate equivalent: zone
  where?: Set<string>;

  favorite?: boolean;
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

// ========================
// Frigate concrete results
// ========================

export interface FrigateEventQueryResults extends EventQueryResults {
  engine: Engine.Frigate;
  instanceID: string;
  events: FrigateEvent[];
}

export interface FrigateRecordingQueryResults extends RecordingQueryResults {
  engine: Engine.Frigate;
  instanceID: string;
  recordings: FrigateRecording[];
}

export interface FrigateRecordingSegmentsQueryResults
  extends RecordingSegmentsQueryResults {
  engine: Engine.Frigate;
  instanceID: string;
}
