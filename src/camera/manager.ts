import { HomeAssistant } from 'custom-card-helpers';
import { CameraConfig } from '../types.js';
import { arrayify, setify } from '../utils/basic.js';
import {
  DataQuery,
  EventQuery,
  EventQueryResults,
  EventQueryResultsMap,
  MediaQuery,
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
  RecordingQueryResultsMap,
  RecordingSegmentsQuery,
  RecordingSegmentsQueryResults,
  RecordingSegmentsQueryResultsMap,
  ResultsMap,
} from './types.js';
import orderBy from 'lodash-es/orderBy';
import { CameraManagerEngineFactory } from './engine-factory.js';
import { ViewMedia } from '../view/media.js';
import { MediaQueriesResults } from '../view/media-queries-results';
import { MediaQueries } from '../view/media-queries.js';
import uniqBy from 'lodash-es/uniqBy';
import { CameraManagerEngine } from './engine.js';
import sum from 'lodash-es/sum';
import add from 'date-fns/add';

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

export interface ExtendedMediaQueryResult<T extends MediaQuery> {
  queries: T[];
  results: ViewMedia[];
}

export class CameraManager {
  protected _engineFactory: CameraManagerEngineFactory;
  protected _cameras: Map<string, CameraConfig>;

  constructor(
    engineFactory: CameraManagerEngineFactory,
    cameras: Map<string, CameraConfig>,
  ) {
    this._engineFactory = engineFactory;
    this._cameras = cameras;
  }

  public generateDefaultEventQueries(
    cameraIDs: string | Set<string>,
    partialQuery?: PartialEventQuery,
  ): EventQuery[] | null {
    return this._generateDefaultQueries(cameraIDs, {
      type: QueryType.Event,
      ...partialQuery,
    });
  }

  public generateDefaultRecordingQueries(
    cameraIDs: string | Set<string>,
    partialQuery?: PartialRecordingQuery,
  ): RecordingQuery[] | null {
    return this._generateDefaultQueries(cameraIDs, {
      type: QueryType.Recording,
      ...partialQuery,
    });
  }

  public generateDefaultRecordingSegmentsQueries(
    cameraIDs: string | Set<string>,
    partialQuery?: PartialRecordingSegmentsQuery,
  ): RecordingSegmentsQuery[] | null {
    return this._generateDefaultQueries(cameraIDs, {
      type: QueryType.RecordingSegments,
      ...partialQuery,
    });
  }

  protected _generateDefaultQueries<PQT extends PartialDataQuery>(
    cameraIDs: string | Set<string>,
    partialQuery: PQT,
  ): PartialQueryConcreteType<PQT>[] | null {
    const concreteQueries: PartialQueryConcreteType<PQT>[] = [];
    const _cameraIDs = setify(cameraIDs);

    const engines = this._engineFactory.getEnginesForCameraIDs(
      this._cameras,
      _cameraIDs,
    );

    if (!engines) {
      return null;
    }

    for (const [engine, cameraIDs] of engines) {
      let queries: DataQuery[] | null = null;
      if (QueryClassifier.isEventQuery(partialQuery)) {
        queries = engine.generateDefaultEventQuery(
          this._cameras,
          cameraIDs,
          partialQuery,
        );
      } else if (QueryClassifier.isRecordingQuery(partialQuery)) {
        queries = engine.generateDefaultRecordingQuery(
          this._cameras,
          cameraIDs,
          partialQuery,
        );
      } else if (QueryClassifier.isRecordingSegmentsQuery(partialQuery)) {
        queries = engine.generateDefaultRecordingSegmentsQuery(
          this._cameras,
          cameraIDs,
          partialQuery,
        );
      }

      for (const query of queries ?? []) {
        concreteQueries.push(query as PartialQueryConcreteType<PQT>);
      }
    }
    return concreteQueries;
  }

  public async getEvents(
    hass: HomeAssistant,
    query: EventQuery | EventQuery[],
  ): Promise<EventQueryResultsMap> {
    return await this._handleQuery(hass, query);
  }

  public async getRecordings(
    hass: HomeAssistant,
    query: RecordingQuery | RecordingQuery[],
  ): Promise<RecordingQueryResultsMap> {
    return await this._handleQuery(hass, query);
  }

  public async getRecordingSegments(
    hass: HomeAssistant,
    query: RecordingSegmentsQuery | RecordingSegmentsQuery[],
  ): Promise<RecordingSegmentsQueryResultsMap> {
    return await this._handleQuery(hass, query);
  }

  public async executeMediaQueries(
    hass: HomeAssistant,
    mediaQueries: MediaQueries,
  ): Promise<MediaQueriesResults | null> {
    const queries: (RecordingQuery | EventQuery)[] | null = mediaQueries.getQueries();
    if (!queries) {
      return null;
    }
    const mediaArray = this._convertQueryResultsToMedia(
      await this._handleQuery(hass, queries),
    );

    return new MediaQueriesResults(
      mediaArray,

      // Select the first (most-recent) item.
      mediaArray.length ? 0 : null,
    );
  }

  public async extendMediaQueries<T extends MediaQuery>(
    hass: HomeAssistant,
    queries: T[],
    results: ViewMedia[],
    direction: 'earlier' | 'later',
    chunkSize: number,
  ): Promise<ExtendedMediaQueryResult<T> | null> {
    const getTimeFromResults = (want: 'earliest' | 'latest'): Date | null => {
      let output: Date | null = null;
      for (const result of results) {
        const startTime = result.getStartTime();
        if (
          startTime &&
          (!output ||
            (want === 'earliest' && startTime < output) ||
            (want === 'latest' && startTime > output))
        ) {
          output = startTime;
        }
      }
      return output;
    };

    // The queries associated with the chunk to fetch.
    const newChunkQueries: T[] = [];

    // The re-constituted combined query.
    const newCombinedQueries: T[] = [];

    for (const query of queries) {
      const newChunkQuery = { ...query };
      const newCombinedQuery = { ...query };

      if (direction === 'later') {
        newChunkQuery.start = getTimeFromResults('latest') ?? undefined;
        newChunkQuery.end = undefined;
        newCombinedQuery.end = undefined;
      } else if (direction === 'earlier') {
        newChunkQuery.end = getTimeFromResults('earliest') ?? undefined;
        newChunkQuery.start = undefined;
        newCombinedQuery.start = undefined;
      }
      newChunkQuery.limit = chunkSize;
      newCombinedQuery.limit = (query.limit ?? 0) + chunkSize;

      newCombinedQueries.push(newCombinedQuery);
      newChunkQueries.push(newChunkQuery);
    }

    const newChunkMedia = this._convertQueryResultsToMedia(
      await this._handleQuery(hass, newChunkQueries),
    );

    if (!newChunkMedia.length) {
      return null;
    }

    return {
      queries: newCombinedQueries,
      results: this._sortMedia(results.concat(newChunkMedia)),
    };
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
    const now = new Date();
    const resultsTimestamp = results.getResultsTimestamp();

    if (!resultsTimestamp) {
      return false;
    }

    for (const query of queries.getQueries() ?? []) {
      const engines = this._engineFactory.getEnginesForCameraIDs(
        this._cameras,
        query.cameraIDs,
      );
      for (const [engine, cameraIDs] of engines ?? []) {
        const maxAgeSeconds = engine.getQueryResultMaxAge({
          ...query,
          cameraIDs: cameraIDs,
        });
        if (
          maxAgeSeconds !== null &&
          add(resultsTimestamp, { seconds: maxAgeSeconds }) < now
        ) {
          return false;
        }
      }
    }
    return true;
  }

  public async getMediaSeekTime(
    hass: HomeAssistant,
    media: ViewMedia,
    target: Date,
  ): Promise<number | null> {
    const startTime = media.getStartTime();
    const endTime = media.getEndTime();
    const cameraConfig = this._cameras.get(media.getCameraID());
    if (
      !cameraConfig ||
      !startTime ||
      !endTime ||
      target < startTime ||
      target > endTime
    ) {
      return null;
    }

    const engine = this._engineFactory.getEngineForCamera(cameraConfig);
    return (await engine?.getMediaSeekTime(hass, this._cameras, media, target)) ?? null;
  }

  protected async _handleQuery<QT extends DataQuery>(
    hass: HomeAssistant,
    query: QT | QT[],
  ): Promise<Map<QT, QueryReturnType<QT>>> {
    const _queries = arrayify(query);
    const results = new Map<QT, QueryReturnType<QT>>();
    const queryStartTime = new Date();

    const processEngineQuery = async (
      engine: CameraManagerEngine,
      query?: QT,
    ): Promise<void> => {
      if (!query) {
        return;
      }

      let engineResult: Map<QT, QueryReturnType<QT>> | null = null;
      if (QueryClassifier.isEventQuery(query)) {
        engineResult = (await engine.getEvents(hass, this._cameras, query)) as Map<
          QT,
          QueryReturnType<QT>
        > | null;
      } else if (QueryClassifier.isRecordingQuery(query)) {
        engineResult = (await engine.getRecordings(hass, this._cameras, query)) as Map<
          QT,
          QueryReturnType<QT>
        > | null;
      } else if (QueryClassifier.isRecordingSegmentsQuery(query)) {
        engineResult = (await engine.getRecordingSegments(
          hass,
          this._cameras,
          query,
        )) as Map<QT, QueryReturnType<QT>> | null;
      }

      engineResult?.forEach((value, key) => results.set(key, value));
    };

    const processQuery = async (query: QT): Promise<void> => {
      const engines = this._engineFactory.getEnginesForCameraIDs(
        this._cameras,
        query.cameraIDs,
      );
      if (!engines) {
        return;
      }
      await Promise.all(
        Array.from(engines.keys()).map((engine) =>
          processEngineQuery(engine, { ...query, cameraIDs: engines.get(engine) }),
        ),
      );
    };

    await Promise.all(_queries.map((query) => processQuery(query)));

    const cachedOutputQueries = sum(
      Array.from(results.values()).map((result) => Number(result.cached)),
    );

    console.debug(
      'Frigate Card CameraManager request [Input queries:',
      _queries.length,
      ', Cached output queries:',
      cachedOutputQueries,
      ', Total output queries:',
      results.size,
      ', Duration:',
      `${(new Date().getTime() - queryStartTime.getTime()) / 1000}s,`,
      ', Queries:',
      _queries,
      ', Results:',
      results,
      ']',
    );
    return results;
  }

  protected _convertQueryResultsToMedia<QT extends DataQuery>(
    results: ResultsMap<QT>,
  ): ViewMedia[] {
    const mediaArray: ViewMedia[] = [];
    for (const [query, result] of results.entries()) {
      const engine = this._engineFactory.getEngine(result.engine);

      if (engine) {
        let media: ViewMedia[] | null = null;
        if (
          QueryClassifier.isEventQuery(query) &&
          QueryResultClassifier.isEventQueryResult(result)
        ) {
          media = engine.generateMediaFromEvents(this._cameras, query, result);
        } else if (
          QueryClassifier.isRecordingQuery(query) &&
          QueryResultClassifier.isRecordingQuery(result)
        ) {
          media = engine.generateMediaFromRecordings(this._cameras, query, result);
        }
        if (media) {
          mediaArray.push(...media);
        }
      }
    }
    return this._sortMedia(mediaArray);
  }

  protected _sortMedia(mediaArray: ViewMedia[]): ViewMedia[] {
    return orderBy(
      // Ensure uniqueness by the ID (if specified), otherwise all elements
      // are assumed to be unique.
      uniqBy(mediaArray, (media) => media.getID() ?? media),

      // Sort all items leading with the most recent.
      (media) => media.getStartTime(),
      'desc',
    );
  }
}
