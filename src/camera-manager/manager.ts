import { HomeAssistant } from 'custom-card-helpers';
import { CameraConfig, CardWideConfig } from '../types.js';
import { allPromises, arrayify, setify } from '../utils/basic.js';
import {
  CameraManagerCameraMetadata,
  CameraManagerCapabilities,
  CameraManagerMediaCapabilities,
  DataQuery,
  EventQuery,
  EventQueryResults,
  EventQueryResultsMap,
  MediaMetadata,
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
import uniqBy from 'lodash-es/uniqBy';
import { CameraManagerEngine } from './engine.js';
import sum from 'lodash-es/sum';
import add from 'date-fns/add';
import { log } from '../utils/debug.js';

class QueryClassifier {
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

class QueryResultClassifier {
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
  protected _cardWideConfig?: CardWideConfig;

  constructor(
    engineFactory: CameraManagerEngineFactory,
    cameras: Map<string, CameraConfig>,
    cardWideConfig?: CardWideConfig,
  ) {
    this._engineFactory = engineFactory;
    this._cameras = cameras;
    this._cardWideConfig = cardWideConfig;
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

  public async getMediaMetadata(hass: HomeAssistant): Promise<MediaMetadata | null> {
    const what: Set<string> = new Set();
    const where: Set<string> = new Set();
    const days: Set<string> = new Set();

    const engines = this._engineFactory.getAllEngines(this._cameras);
    if (!engines) {
      return null;
    }

    const processMetadata = async (engine: CameraManagerEngine): Promise<void> => {
      const engineMetadata = await engine.getMediaMetadata(hass, this._cameras);
      if (engineMetadata) {
        if (engineMetadata.what) {
          engineMetadata.what.forEach(what.add, what);
        }
        if (engineMetadata.where) {
          engineMetadata.where.forEach(where.add, where);
        }
        if (engineMetadata.days) {
          engineMetadata.days.forEach(days.add, days);
        }
      }
    };

    await allPromises(engines, (engine) => processMetadata(engine));

    if (!what.size && !where.size && !days.size) {
      return null;
    }
    return {
      ...(what.size && { what: what }),
      ...(where.size && { where: where }),
      ...(days.size && { days: days }),
    };
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

  public async executeMediaQueries<T extends MediaQuery>(
    hass: HomeAssistant,
    queries: T[],
  ): Promise<ViewMedia[] | null> {
    return this._convertQueryResultsToMedia(
      hass,
      await this._handleQuery(hass, queries),
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
    const extendedQueries: T[] = [];

    for (const query of queries) {
      const newChunkQuery = { ...query };

      if (direction === 'later') {
        const latestResult = getTimeFromResults('latest');
        if (latestResult) {
          newChunkQuery.start = latestResult;
        }
      } else if (direction === 'earlier') {
        const earliestResult = getTimeFromResults('earliest');
        if (earliestResult) {
          newChunkQuery.end = earliestResult;
        }
      }
      newChunkQuery.limit = chunkSize;

      extendedQueries.push({
        ...query,
        limit: (query.limit ?? 0) + chunkSize,
      });
      newChunkQueries.push(newChunkQuery);
    }

    const newChunkMedia = this._convertQueryResultsToMedia(
      hass,
      await this._handleQuery(hass, newChunkQueries),
    );

    if (!newChunkMedia.length) {
      return null;
    }

    return {
      queries: extendedQueries,
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

  public getCapabilities(): CameraManagerCapabilities | null {
    const engines = this._engineFactory.getAllEngines(this._cameras);
    if (!engines) {
      return null;
    }

    return {
      canFavoriteEvents: engines.some(
        (engine) => engine.getCapabilities()?.canFavoriteEvents,
      ),
      canFavoriteRecordings: engines.some(
        (engine) => engine.getCapabilities()?.canFavoriteRecordings,
      ),
    };
  }

  public getMediaCapabilities(media: ViewMedia): CameraManagerMediaCapabilities | null {
    const engine = this._engineFactory.getEngineForMedia(this._cameras, media);
    if (!engine) {
      return null;
    }
    return engine.getMediaCapabilities(media);
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

      log(
        this._cardWideConfig,
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

  public areMediaQueriesResultsFresh<T extends MediaQuery>(
    queries: T[],
    resultsTimestamp: Date,
  ): boolean {
    const now = new Date();

    for (const query of queries) {
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

    log(
      this._cardWideConfig,
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
    hass: HomeAssistant,
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
          media = engine.generateMediaFromEvents(hass, this._cameras, query, result);
        } else if (
          QueryClassifier.isRecordingQuery(query) &&
          QueryResultClassifier.isRecordingQuery(result)
        ) {
          media = engine.generateMediaFromRecordings(hass, this._cameras, query, result);
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

  public getCameraMetadata(
    hass: HomeAssistant,
    cameraConfig?: CameraConfig,
  ): CameraManagerCameraMetadata | null {
    const engine = this._engineFactory.getEngineForCamera(cameraConfig);
    if (!engine || !cameraConfig) {
      return null;
    }
    return engine.getCameraMetadata(hass, cameraConfig);
  }
}
