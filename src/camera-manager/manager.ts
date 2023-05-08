import { HomeAssistant } from 'custom-card-helpers';
import {
  CameraConfig,
  CamerasConfig,
  CardWideConfig,
  ExtendedHomeAssistant,
} from '../types.js';
import { allPromises, arrayify, setify } from '../utils/basic.js';
import {
  CameraManagerCameraCapabilities,
  CameraManagerCameraMetadata,
  CameraManagerCapabilities,
  CameraManagerMediaCapabilities,
  CameraEndpointsContext,
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
  CameraEndpoints,
  Engine,
  MediaMetadataQuery,
  MediaMetadataQueryResults,
  EngineOptions,
  CameraEndpoint,
} from './types.js';
import { CameraManagerEngineFactory } from './engine-factory.js';
import { ViewMedia } from '../view/media.js';
import { CameraManagerEngine } from './engine.js';
import sum from 'lodash-es/sum';
import add from 'date-fns/add';
import { log } from '../utils/debug.js';
import { EntityRegistryManager } from '../utils/ha/entity-registry/index.js';
import { getCameraID } from '../utils/camera.js';
import { localize } from '../localize/localize.js';
import { CameraInitializationError } from './error.js';
import { CameraManagerReadOnlyConfigStore, CameraManagerStore } from './store.js';
import cloneDeep from 'lodash-es/cloneDeep';
import { MEDIA_CHUNK_SIZE_DEFAULT } from '../const.js';
import { sortMedia } from './util.js';

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
  public static isMediaMetadataQuery(
    query: DataQuery | PartialDataQuery,
  ): query is MediaMetadataQuery {
    return query.type === QueryType.MediaMetadata;
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
  public static isMediaMetadataQuery(
    queryResults: QueryResults,
  ): queryResults is MediaMetadataQueryResults {
    return queryResults.type === QueryResultsType.MediaMetadata;
  }
}

export interface ExtendedMediaQueryResult<T extends MediaQuery> {
  queries: T[];
  results: ViewMedia[];
}

interface InitializedCamera {
  inputConfig: CameraConfig;
  initializedConfig: CameraConfig;
  engine: CameraManagerEngine;
}

export class CameraManager {
  protected _engineFactory: CameraManagerEngineFactory;
  protected _cardWideConfig?: CardWideConfig;
  protected _store: CameraManagerStore;

  constructor(
    engineFactory: CameraManagerEngineFactory,
    cardWideConfig?: CardWideConfig,
  ) {
    this._engineFactory = engineFactory;
    this._cardWideConfig = cardWideConfig;
    this._store = new CameraManagerStore();
  }

  protected async _getEnginesForCameras(
    hass: HomeAssistant,
    camerasConfig: CamerasConfig,
  ): Promise<Map<CameraConfig, CameraManagerEngine>> {
    const output: Map<CameraConfig, CameraManagerEngine> = new Map();
    const engines: Map<Engine, CameraManagerEngine> = new Map();

    const getEngineTypes = async (configs: CameraConfig[]) => {
      return await allPromises(configs, (config) =>
        this._engineFactory.getEngineForCamera(hass, config),
      );
    };

    const engineTypes = await getEngineTypes(camerasConfig);
    for (const [index, cameraConfig] of camerasConfig.entries()) {
      const engineType = engineTypes[index];
      const engine = engineType
        ? engines.get(engineType) ?? await this._engineFactory.createEngine(engineType)
        : null;
      if (!engine || !engineType) {
        throw new CameraInitializationError(
          localize('error.no_camera_engine'),
          cameraConfig,
        );
      }
      engines.set(engineType, engine);
      output.set(cameraConfig, engine);
    }
    return output;
  }

  protected async _initializeCamera(
    hass: HomeAssistant,
    engine: CameraManagerEngine,
    entityRegistryManager: EntityRegistryManager,
    inputCameraConfig: CameraConfig,
  ): Promise<InitializedCamera> {
    const initializedConfig = await engine.initializeCamera(
      hass,
      entityRegistryManager,
      // Camera initialization may modify the configuration. Keep the original
      // for display in error messages to avoid user confusion.
      cloneDeep(inputCameraConfig),
    );

    return {
      inputConfig: inputCameraConfig,
      initializedConfig: initializedConfig,
      engine: engine,
    };
  }

  public async initializeCameras(
    hass: HomeAssistant,
    entityRegistryManager: EntityRegistryManager,
    camerasConfig: CamerasConfig,
  ): Promise<void> {
    const initializationStartTime = new Date();

    const hasAutoTriggers = (config: CameraConfig): boolean => {
      return config.triggers.motion || config.triggers.occupancy;
    };

    if (
      // If any camera requires automatic trigger detection ...
      camerasConfig.some((config) => hasAutoTriggers(config))
    ) {
      // ... then we need to populate the entity cache by fetching all entities
      // from Home Assistant. Do this once upfront, to avoid each camera doing
      // it.
      await entityRegistryManager.fetchEntityList(hass);
    }

    // Engines are created sequentially, to avoid duplicate creation of the same
    // engine. See: https://github.com/dermotduffy/frigate-hass-card/issues/941
    const engineByConfig = await this._getEnginesForCameras(hass, camerasConfig);

    // Configuration is initialized in parallel.
    const results = await allPromises(
      engineByConfig.entries(),
      async ([cameraConfig, engine]) =>
        await this._initializeCamera(hass, engine, entityRegistryManager, cameraConfig),
    );

    // Do the additions based off the result-order, to ensure the map order is
    // preserved.
    results.forEach((result) => {
      const id = getCameraID(result.initializedConfig);

      if (!id) {
        throw new CameraInitializationError(
          localize('error.no_camera_id'),
          result.inputConfig,
        );
      }

      if (this._store.hasCameraID(id)) {
        throw new CameraInitializationError(
          localize('error.duplicate_camera_id'),
          result.inputConfig,
        );
      }

      this._store.addCamera(id, result.initializedConfig, result.engine);
    });

    if (!this._store.getVisibleCameraCount()) {
      throw new CameraInitializationError(localize('error.no_visible_cameras'));
    }

    log(
      this._cardWideConfig,
      'Frigate Card CameraManager initialized (Cameras: ',
      this._store.getCameras(),
      `, Duration: ${
        (new Date().getTime() - initializationStartTime.getTime()) / 1000
      }s,`,
      ')',
    );
  }

  public isInitialized(): boolean {
    return this._store.getCameraCount() > 0;
  }

  public getStore(): CameraManagerReadOnlyConfigStore {
    return this._store;
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
    const tags: Set<string> = new Set();
    const what: Set<string> = new Set();
    const where: Set<string> = new Set();
    const days: Set<string> = new Set();

    const query: MediaMetadataQuery = {
      type: QueryType.MediaMetadata,
      cameraIDs: this._store.getCameraIDs(),
    };

    const results = await this._handleQuery(hass, query);

    for (const result of results?.values() ?? []) {
      if (result.metadata.tags) {
        result.metadata.tags.forEach(tags.add, tags);
      }
      if (result.metadata.what) {
        result.metadata.what.forEach(what.add, what);
      }
      if (result.metadata.where) {
        result.metadata.where.forEach(where.add, where);
      }
      if (result.metadata.days) {
        result.metadata.days.forEach(days.add, days);
      }
    }

    if (!what.size && !where.size && !days.size) {
      return null;
    }
    return {
      ...(tags.size && { tags: tags }),
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
    const engines = this._store.getEnginesForCameraIDs(_cameraIDs);

    if (!engines) {
      return null;
    }

    for (const [engine, cameraIDs] of engines) {
      let queries: DataQuery[] | null = null;
      if (QueryClassifier.isEventQuery(partialQuery)) {
        queries = engine.generateDefaultEventQuery(
          this._store.getVisibleCameras(),
          cameraIDs,
          partialQuery,
        );
      } else if (QueryClassifier.isRecordingQuery(partialQuery)) {
        queries = engine.generateDefaultRecordingQuery(
          this._store.getVisibleCameras(),
          cameraIDs,
          partialQuery,
        );
      } else if (QueryClassifier.isRecordingSegmentsQuery(partialQuery)) {
        queries = engine.generateDefaultRecordingSegmentsQuery(
          this._store.getVisibleCameras(),
          cameraIDs,
          partialQuery,
        );
      }

      for (const query of queries ?? []) {
        concreteQueries.push(query as PartialQueryConcreteType<PQT>);
      }
    }
    return concreteQueries.length ? concreteQueries : null;
  }

  public async getEvents(
    hass: HomeAssistant,
    query: EventQuery | EventQuery[],
    engineOptions?: EngineOptions,
  ): Promise<EventQueryResultsMap> {
    return await this._handleQuery(hass, query, engineOptions);
  }

  public async getRecordings(
    hass: HomeAssistant,
    query: RecordingQuery | RecordingQuery[],
    engineOptions?: EngineOptions,
  ): Promise<RecordingQueryResultsMap> {
    return await this._handleQuery(hass, query, engineOptions);
  }

  public async getRecordingSegments(
    hass: HomeAssistant,
    query: RecordingSegmentsQuery | RecordingSegmentsQuery[],
    engineOptions?: EngineOptions,
  ): Promise<RecordingSegmentsQueryResultsMap> {
    return await this._handleQuery(hass, query, engineOptions);
  }

  public async executeMediaQueries<T extends MediaQuery>(
    hass: HomeAssistant,
    queries: T[],
    engineOptions?: EngineOptions,
  ): Promise<ViewMedia[] | null> {
    return this._convertQueryResultsToMedia(
      hass,
      await this._handleQuery(hass, queries, engineOptions),
    );
  }

  public async extendMediaQueries<T extends MediaQuery>(
    hass: HomeAssistant,
    queries: T[],
    results: ViewMedia[],
    direction: 'earlier' | 'later',
    engineOptions?: EngineOptions,
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

    const chunkSize =
      this._cardWideConfig?.performance?.features.media_chunk_size ??
      MEDIA_CHUNK_SIZE_DEFAULT;

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
      await this._handleQuery(hass, newChunkQueries, engineOptions),
    );

    if (!newChunkMedia.length) {
      return null;
    }

    const outputMedia = sortMedia(results.concat(newChunkMedia));

    // If the media did not _ACTUALLY_ get longer, there is no new media despite
    // the increased limit, so just return null.
    if (outputMedia.length === results.length) {
      return null;
    }

    return {
      queries: extendedQueries,
      results: outputMedia,
    };
  }

  public async getMediaDownloadPath(
    hass: ExtendedHomeAssistant,
    media: ViewMedia,
  ): Promise<CameraEndpoint | null> {
    const cameraConfig = this._store.getCameraConfigForMedia(media);
    const engine = this._store.getEngineForMedia(media);

    if (!cameraConfig || !engine) {
      return null;
    }
    return await engine.getMediaDownloadPath(hass, cameraConfig, media);
  }

  public getMediaCapabilities(media: ViewMedia): CameraManagerMediaCapabilities | null {
    const engine = this._store.getEngineForMedia(media);
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
    const cameraConfig = this._store.getCameraConfigForMedia(media);
    const engine = this._store.getEngineForMedia(media);

    if (!cameraConfig || !engine) {
      return;
    }

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

  public areMediaQueriesResultsFresh<T extends MediaQuery>(
    queries: T[],
    resultsTimestamp: Date,
  ): boolean {
    const now = new Date();

    for (const query of queries) {
      const engines = this._store.getEnginesForCameraIDs(query.cameraIDs);
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
    const cameraConfig = this._store.getCameraConfigForMedia(media);
    const engine = this._store.getEngineForMedia(media);
    if (
      !cameraConfig ||
      !engine ||
      !startTime ||
      !endTime ||
      target < startTime ||
      target > endTime
    ) {
      return null;
    }

    return await engine.getMediaSeekTime(hass, this._store.getCameras(), media, target);
  }

  protected async _handleQuery<QT extends DataQuery>(
    hass: HomeAssistant,
    query: QT | QT[],
    engineOptions?: EngineOptions,
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
        engineResult = (await engine.getEvents(
          hass,
          this._store.getCameras(),
          query,
          engineOptions,
        )) as Map<QT, QueryReturnType<QT>> | null;
      } else if (QueryClassifier.isRecordingQuery(query)) {
        engineResult = (await engine.getRecordings(
          hass,
          this._store.getCameras(),
          query,
          engineOptions,
        )) as Map<QT, QueryReturnType<QT>> | null;
      } else if (QueryClassifier.isRecordingSegmentsQuery(query)) {
        engineResult = (await engine.getRecordingSegments(
          hass,
          this._store.getCameras(),
          query,
          engineOptions,
        )) as Map<QT, QueryReturnType<QT>> | null;
      } else if (QueryClassifier.isMediaMetadataQuery(query)) {
        engineResult = (await engine.getMediaMetadata(
          hass,
          this._store.getCameras(),
          query,
          engineOptions,
        )) as Map<QT, QueryReturnType<QT>> | null;
      }

      engineResult?.forEach((value, key) => results.set(key, value));
    };

    const processQuery = async (query: QT): Promise<void> => {
      const engines = this._store.getEnginesForCameraIDs(query.cameraIDs);
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
      Array.from(results.values()).map((result) => Number(result.cached ?? 0)),
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
      const engine = this._store.getEngineOfType(result.engine);

      if (engine) {
        let media: ViewMedia[] | null = null;
        if (
          QueryClassifier.isEventQuery(query) &&
          QueryResultClassifier.isEventQueryResult(result)
        ) {
          media = engine.generateMediaFromEvents(
            hass,
            this._store.getCameras(),
            query,
            result,
          );
        } else if (
          QueryClassifier.isRecordingQuery(query) &&
          QueryResultClassifier.isRecordingQuery(result)
        ) {
          media = engine.generateMediaFromRecordings(
            hass,
            this._store.getCameras(),
            query,
            result,
          );
        }
        if (media) {
          mediaArray.push(...media);
        }
      }
    }
    return sortMedia(mediaArray);
  }

  public getCameraEndpoints(
    cameraID: string,
    context?: CameraEndpointsContext,
  ): CameraEndpoints | null {
    const cameraConfig = this._store.getCameraConfig(cameraID);
    const engine = this._store.getEngineForCameraID(cameraID);
    if (!cameraConfig || !engine) {
      return null;
    }
    return engine.getCameraEndpoints(cameraConfig, context);
  }

  public getCameraMetadata(
    hass: HomeAssistant,
    cameraID: string,
  ): CameraManagerCameraMetadata | null {
    const cameraConfig = this._store.getCameraConfig(cameraID);
    const engine = this._store.getEngineForCameraID(cameraID);
    if (!cameraConfig || !engine) {
      return null;
    }
    return engine.getCameraMetadata(hass, cameraConfig);
  }

  public getCameraCapabilities(
    cameraID: string,
  ): CameraManagerCameraCapabilities | null {
    const cameraConfig = this._store.getCameraConfig(cameraID);
    const engine = this._store.getEngineForCameraID(cameraID);
    if (!cameraConfig || !engine) {
      return null;
    }
    return engine.getCameraCapabilities(cameraConfig);
  }

  public getAggregateCameraCapabilities(
    cameraIDs?: Set<string>,
  ): CameraManagerCapabilities | null {
    const perCameraCapabilities = [...(cameraIDs ?? this._store.getCameraIDs())].map(
      (cameraID) => this.getCameraCapabilities(cameraID),
    );

    return {
      canFavoriteEvents: perCameraCapabilities.some((cap) => cap?.canFavoriteEvents),
      canFavoriteRecordings: perCameraCapabilities.some(
        (cap) => cap?.canFavoriteRecordings,
      ),
      canSeek: perCameraCapabilities.some(
        (cap) => cap?.canSeek,
      ),

      supportsClips: perCameraCapabilities.some((cap) => cap?.supportsClips),
      supportsRecordings: perCameraCapabilities.some((cap) => cap?.supportsRecordings),
      supportsSnapshots: perCameraCapabilities.some((cap) => cap?.supportsSnapshots),
      supportsTimeline: perCameraCapabilities.some((cap) => cap?.supportsTimeline),
    };
  }
}
