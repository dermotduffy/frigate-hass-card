import { HomeAssistant } from 'custom-card-helpers';
import { CameraConfig } from '../types.js';
import { arrayify, setify } from '../utils/basic.js';
import {
  DataQuery,
  EventQuery,
  EventQueryResults,
  PartialDataQuery,
  PartialEventQuery,
  PartialQueryConcreteType,
  PartialRecordingQuery,
  PartialRecordingSegmentsQuery,
  QueryResults,
  QueryResultsType,
  QueryReturnType,
  QueryType,
  RecordingQuery,
  RecordingQueryResults,
  RecordingSegmentsQuery,
  RecordingSegmentsQueryResults,
} from './types.js';
import orderBy from 'lodash-es/orderBy';
import { CameraManagerEngineFactory } from './engine-factory.js';
import { ViewMedia } from '../view/media.js';
import { MediaQueriesResults } from '../view/media-queries-results';
import { MemoryRequestCache } from './cache.js';
import { MediaQueries } from '../view/media-queries.js';
import uniqBy from 'lodash-es/uniqBy';

export class QueryClassifier {
  public static isEventQuery(query: DataQuery | PartialDataQuery): query is EventQuery {
    return query.type === QueryType.Event;
  }
  public static isRecordingQuery(
    query: DataQuery | PartialDataQuery,
  ): query is RecordingQuery {
    return query.type === QueryType.Recording;
  }
  public static isRecordingSegmentsQuery(
    query: DataQuery | PartialDataQuery,
  ): query is RecordingSegmentsQuery {
    return query.type === QueryType.RecordingSegments;
  }
}

export class QueryResultClassifier {
  public static isEventQueryResult(
    queryResults: QueryResults,
  ): queryResults is EventQueryResults {
    return queryResults.type === QueryResultsType.Event;
  }
  public static isRecordingQuery(
    queryResults: QueryResults,
  ): queryResults is RecordingQueryResults {
    return queryResults.type === QueryResultsType.Recording;
  }
  public static isRecordingSegmentsQuery(
    queryResults: QueryResults,
  ): queryResults is RecordingSegmentsQueryResults {
    return queryResults.type === QueryResultsType.RecordingSegments;
  }
}

export type RequestCache = MemoryRequestCache<DataQuery, QueryResults>;

export class CameraManager {
  protected _engineFactory: CameraManagerEngineFactory;
  protected _cameras: Map<string, CameraConfig>;
  protected _requestCache: RequestCache;

  constructor(
    engineFactory: CameraManagerEngineFactory,
    cameras: Map<string, CameraConfig>,
    requestCache: RequestCache,
  ) {
    this._engineFactory = engineFactory;
    this._cameras = cameras;
    this._requestCache = requestCache;
  }

  public generateDefaultEventQueries(
    cameraIDs: string | Set<string>,
    partialQuery: PartialEventQuery,
  ): EventQuery[] {
    return this._generateDefaultQueries(cameraIDs, {
      ...partialQuery,
      type: QueryType.Event,
    });
  }

  public generateDefaultRecordingQueries(
    cameraIDs: string | Set<string>,
    partialQuery: PartialRecordingQuery,
  ): RecordingQuery[] {
    return this._generateDefaultQueries(cameraIDs, {
      ...partialQuery,
      type: QueryType.Recording,
    });
  }

  public generateDefaultRecordingSegmentsQueries(
    cameraIDs: string | Set<string>,
    partialQuery: PartialRecordingSegmentsQuery,
  ): RecordingSegmentsQuery[] {
    return this._generateDefaultQueries(cameraIDs, {
      ...partialQuery,
      type: QueryType.RecordingSegments,
    });
  }

  protected _generateDefaultQueries<PQT extends Partial<DataQuery>>(
    cameraIDs: string | Set<string>,
    partialQuery: PQT,
  ): PartialQueryConcreteType<PQT>[] {
    const concreteQueries: PartialQueryConcreteType<PQT>[] = [];
    const _cameraIDs = setify(cameraIDs);

    _cameraIDs.forEach((cameraID) => {
      const cameraConfig = this._cameras.get(cameraID);
      if (!cameraConfig) {
        return;
      }

      const engine = this._engineFactory.getEngineForCamera(cameraConfig);
      if (!engine) {
        return;
      }

      let query: DataQuery | null = null;
      if (QueryClassifier.isEventQuery(partialQuery)) {
        query = engine.generateDefaultEventQuery(cameraID, cameraConfig, partialQuery);
      } else if (QueryClassifier.isRecordingQuery(partialQuery)) {
        query = engine.generateDefaultRecordingQuery(
          cameraID,
          cameraConfig,
          partialQuery,
        );
      } else if (QueryClassifier.isRecordingSegmentsQuery(partialQuery)) {
        query = engine.generateDefaultRecordingSegmentsQuery(
          cameraID,
          cameraConfig,
          partialQuery,
        );
      }

      if (query) {
        concreteQueries.push(query as PartialQueryConcreteType<PQT>);
      }
    });
    return concreteQueries;
  }

  public async getEvents(
    hass: HomeAssistant,
    query: EventQuery | EventQuery[],
  ): Promise<Map<EventQuery, EventQueryResults>> {
    return await this._handleQuery(hass, query);
  }

  public async getRecordings(
    hass: HomeAssistant,
    query: RecordingQuery | RecordingQuery[],
  ): Promise<Map<RecordingQuery, RecordingQueryResults>> {
    return await this._handleQuery(hass, query);
  }

  public async getRecordingSegments(
    hass: HomeAssistant,
    query: RecordingSegmentsQuery | RecordingSegmentsQuery[],
  ): Promise<Map<RecordingSegmentsQuery, RecordingSegmentsQueryResults>> {
    return await this._handleQuery(hass, query);
  }

  public async executeMediaQuery(
    hass: HomeAssistant,
    mediaQuerys: MediaQueries,
  ): Promise<MediaQueriesResults | null> {
    const queries: (RecordingQuery | EventQuery)[] | null = mediaQuerys.getQueries();
    if (!queries) {
      return null;
    }

    const results = await this._handleQuery(hass, queries);

    const mediaArray: ViewMedia[] = [];
    for (const [query, result] of results.entries()) {
      const cameraConfig = this._cameras.get(query.cameraID);
      const engine = this._engineFactory.getEngineForCamera(cameraConfig);

      if (engine && cameraConfig) {
        let media: ViewMedia[] | null = null;
        if (
          QueryClassifier.isEventQuery(query) &&
          QueryResultClassifier.isEventQueryResult(result)
        ) {
          media = engine.generateMediaFromEvents(cameraConfig, query, result);
        } else if (
          QueryClassifier.isRecordingQuery(query) &&
          QueryResultClassifier.isRecordingQuery(result)
        ) {
          media = engine.generateMediaFromRecordings(cameraConfig, query, result);
        }
        if (media) {
          mediaArray.push(...media);
        }
      }
    }

    return new MediaQueriesResults(
      orderBy(
        // Ensure uniqueness by the ID (if specified), otherwise all elements
        // are assumed to be unique.
        uniqBy(
          mediaArray,
          (media) => media.getID() ?? media,
        ),

        // Sort all items leading with the most recent.
        (media) => media.getStartTime(),
        'desc',
      ),

      // Select the first (most-recent) item.
      mediaArray.length ? 0 : null,
    );
  }

  public getMediaDownloadPath(media: ViewMedia): string | null {
    const cameraConfig = this._cameras.get(media.getCameraID());
    const engine = cameraConfig
      ? this._engineFactory.getEngineForCamera(cameraConfig)
      : null;
    if (!cameraConfig || !engine) {
      return null;
    }
    return engine.getMediaDownloadPath(cameraConfig, media);
  }

  public async favoriteMedia(
    hass: HomeAssistant,
    media: ViewMedia,
    favorite: boolean,
  ): Promise<void> {
    const cameraConfig = this._cameras.get(media.getCameraID());
    if (!cameraConfig) {
      return;
    }
    const engine = this._engineFactory.getEngineForCamera(cameraConfig);
    if (engine) {
      const queryStartTime = new Date();
      await engine.favoriteMedia(hass, cameraConfig, media, favorite);

      console.debug(
        'Frigate Card CameraManager favorite request (',
        `Duration: ${(new Date().getTime() - queryStartTime.getTime()) / 1000}s,`,
        'Media:',
        media.getID(),
        ', Favorite:',
        favorite,
        ')',
      );
    }
  }

  public areMediaQueriesResultsFresh(
    queries: MediaQueries,
    results: MediaQueriesResults,
  ): boolean {
    const cameraIDs: Set<string> = new Set();
    (queries.getQueries() ?? []).forEach((query) => cameraIDs.add(query.cameraID));
    for (const cameraID of cameraIDs) {
      const cameraConfig = this._cameras.get(cameraID);
      if (!cameraConfig) {
        return false;
      }
      const engine = this._engineFactory.getEngineForCamera(cameraConfig);
      if (!engine || !engine.areMediaQueriesResultsFresh(queries, results)) {
        return false;
      }
    }
    return true;
  }

  protected async _handleQuery<QT extends DataQuery>(
    hass: HomeAssistant,
    query: QT | QT[],
  ): Promise<Map<QT, QueryReturnType<QT>>> {
    const _queries = arrayify(query);
    const results = new Map<QT, QueryReturnType<QT>>();

    const queryStartTime = new Date();
    let queryCachedCount = 0;

    const processQuery = async (query: QT): Promise<void> => {
      const cachedResult: QueryReturnType<QT> | null = this._requestCache.get(
        query,
      ) as QueryReturnType<QT> | null;
      if (cachedResult) {
        queryCachedCount++;
        results.set(query, cachedResult);
        return;
      }

      const engine = this._engineFactory.getEngineForQuery(this._cameras, query);
      if (!engine) {
        return;
      }

      let result: QueryResults | null = null;
      if (QueryClassifier.isEventQuery(query)) {
        result = await engine.getEvents(hass, this._cameras, query);
      } else if (QueryClassifier.isRecordingQuery(query)) {
        result = await engine.getRecordings(hass, this._cameras, query);
      } else if (QueryClassifier.isRecordingSegmentsQuery(query)) {
        result = await engine.getRecordingSegments(hass, this._cameras, query);
      }

      if (result) {
        if (result.expiry) {
          this._requestCache.set(query, result, result.expiry);
        }
        results.set(query, result as QueryReturnType<QT>);
      }
    };

    await Promise.all(_queries.map((query) => processQuery(query)));

    console.debug(
      'Frigate Card CameraManager request (Cached:',
      `${queryCachedCount}/${_queries.length},`,
      `Duration: ${(new Date().getTime() - queryStartTime.getTime()) / 1000}s,`,
      'Queries:',
      _queries,
      ', Results:',
      results,
      ')',
    );
    return results;
  }
}
