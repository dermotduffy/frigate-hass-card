import { HomeAssistant } from 'custom-card-helpers';
import add from 'date-fns/add';
import endOfHour from 'date-fns/endOfHour';
import startOfHour from 'date-fns/startOfHour';
import { CAMERA_BIRDSEYE } from '../../const';
import { CameraConfig, RecordingSegment } from '../../types';
import { MediaQueriesResults } from '../../view/media-queries-results';
import { MediaQueriesClassifier } from '../../view/media-queries-classifier';
import { ViewMedia } from '../../view/media';
import { RecordingSegmentsCache } from '../cache';
import {
  CameraManagerEngine,
  CAMERA_MANAGER_ENGINE_EVENT_LIMIT_DEFAULT,
} from '../engine';
import { DateRange } from '../range';
import {
  Engine,
  EventQuery,
  FrigateEventQueryResults,
  FrigateRecordingQueryResults,
  FrigateRecordingSegmentsQueryResults,
  PartialEventQuery,
  PartialRecordingQuery,
  PartialRecordingSegmentsQuery,
  QueryResults,
  QueryResultsType,
  QueryReturnType,
  QueryType,
  RecordingQuery,
  RecordingSegmentsQuery,
} from '../types';
import { FrigateRecording } from './types';
import {
  getEvents,
  getRecordingSegments,
  getRecordingsSummary,
  NativeFrigateEventQuery,
  NativeFrigateRecordingSegmentsQuery,
  retainEvent,
} from './requests';
import { MediaQueries } from '../../view/media-queries';
import orderBy from 'lodash-es/orderBy';
import throttle from 'lodash-es/throttle';
import { runWhenIdleIfSupported } from '../../utils/basic';
import { fromUnixTime } from 'date-fns';
import { sum } from 'lodash-es';
import { FrigateViewMediaClassifier } from './media-classifier';
import { ViewMediaClassifier } from '../../view/media-classifier';
import { FrigateViewMediaFactory } from './media';

const EVENT_REQUEST_CACHE_MAX_AGE_SECONDS = 60;
const RECORDING_SUMMARY_REQUEST_CACHE_MAX_AGE_SECONDS = 60;

class FrigateQueryResultsClassifier {
  public static isFrigateEventQueryResults(
    results: QueryResults,
  ): results is FrigateEventQueryResults {
    return results.engine === Engine.Frigate && results.type === QueryResultsType.Event;
  }

  public static isFrigateRecordingQueryResults(
    results: QueryResults,
  ): results is FrigateRecordingQueryResults {
    return (
      results.engine === Engine.Frigate && results.type === QueryResultsType.Recording
    );
  }

  public static isFrigateRecordingSegmentsResults(
    results: QueryResults,
  ): results is FrigateRecordingSegmentsQueryResults {
    return (
      results.engine === Engine.Frigate &&
      results.type === QueryResultsType.RecordingSegments
    );
  }
}

export class FrigateCameraManagerEngine implements CameraManagerEngine {
  protected _recordingSegmentsCache: RecordingSegmentsCache;

  // Garbage collect segments at most once an hour.
  protected _throttledSegmentGarbageCollector = throttle(
    this._garbageCollectSegments.bind(this),
    60 * 60 * 1000,
    { trailing: true },
  );

  constructor(recordingSegmentsCache: RecordingSegmentsCache) {
    this._recordingSegmentsCache = recordingSegmentsCache;
  }

  public getMediaDownloadPath(
    cameraConfig: CameraConfig,
    media: ViewMedia,
  ): string | null {
    let path: string | null = null;
    if (FrigateViewMediaClassifier.isFrigateEvent(media)) {
      path =
        `/api/frigate/${cameraConfig.frigate.client_id}` +
        `/notifications/${media.getID()}/` +
        `${ViewMediaClassifier.isClip(media) ? 'clip.mp4' : 'snapshot.jpg'}` +
        `?download=true`;
    } else if (FrigateViewMediaClassifier.isFrigateRecording(media)) {
      path =
        `/api/frigate/${cameraConfig.frigate.client_id}` +
        `/recording/${cameraConfig.frigate.camera_name}` +
        `/start/${Math.floor(media.getStartTime().getTime() / 1000)}` +
        `/end/${Math.floor(media.getEndTime().getTime() / 1000)}}` +
        `?download=true`;
    }
    return path;
  }

  public generateDefaultEventQuery(
    cameraID: string,
    cameraConfig: CameraConfig,
    query: PartialEventQuery,
  ): EventQuery | null {
    return {
      type: QueryType.Event,
      cameraID: cameraID,
      ...(cameraConfig.frigate.label && { what: cameraConfig.frigate.label }),
      ...(cameraConfig.frigate.zone && { where: cameraConfig.frigate.zone }),
      ...query,
    };
  }

  public generateDefaultRecordingQuery(
    cameraID: string,
    _cameraConfig: CameraConfig,
    query: PartialRecordingQuery,
  ): RecordingQuery | null {
    return {
      type: QueryType.Recording,
      cameraID: cameraID,
      ...query,
    };
  }

  public generateDefaultRecordingSegmentsQuery(
    cameraID: string,
    _cameraConfig: CameraConfig,
    query: PartialRecordingSegmentsQuery,
  ): RecordingSegmentsQuery | null {
    if (!query.start || !query.end) {
      return null;
    }
    return {
      type: QueryType.RecordingSegments,
      cameraID: cameraID,
      start: query.start,
      end: query.end,
      ...query,
    };
  }

  public async favoriteMedia(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
    media: ViewMedia,
    favorite: boolean,
  ): Promise<void> {
    const clientID = cameraConfig.frigate.client_id;
    if (!FrigateViewMediaClassifier.isFrigateEvent(media)) {
      return;
    }

    await retainEvent(hass, clientID, media.getID(cameraConfig), favorite);
    media.setFavorite(favorite);
  }

  public async getEvents(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    query: EventQuery,
  ): Promise<QueryReturnType<EventQuery> | null> {
    const cameraConfig = this._getQueryableCameraConfig(cameras, query.cameraID);
    if (!cameraConfig) {
      return null;
    }

    const nativeQuery: NativeFrigateEventQuery = {
      instance_id: cameraConfig.frigate.client_id,
      camera: cameraConfig.frigate.camera_name,
      ...(query.what && { label: query.what }),
      ...(query.where && { zone: query.where }),
      ...(query?.end && { before: Math.floor(query.end.getTime() / 1000) }),
      ...(query?.start && { after: Math.floor(query.start.getTime() / 1000) }),
      ...(query?.limit && { limit: query.limit }),
      ...(query?.hasClip && { has_clip: query.hasClip }),
      ...(query?.hasSnapshot && { has_snapshot: query.hasSnapshot }),
      limit: query?.limit ?? CAMERA_MANAGER_ENGINE_EVENT_LIMIT_DEFAULT,
    };

    return <FrigateEventQueryResults>{
      type: QueryResultsType.Event,
      engine: Engine.Frigate,
      events: await getEvents(hass, nativeQuery),
      expiry: add(new Date(), { seconds: EVENT_REQUEST_CACHE_MAX_AGE_SECONDS }),
    };
  }

  public async getRecordings(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    query: RecordingQuery,
  ): Promise<QueryReturnType<RecordingQuery> | null> {
    const cameraConfig = this._getQueryableCameraConfig(cameras, query.cameraID);
    if (!cameraConfig) {
      return null;
    }
    if (!cameraConfig || !cameraConfig.frigate.camera_name) {
      return null;
    }

    const recordingSummary = await getRecordingsSummary(
      hass,
      cameraConfig.frigate.client_id,
      cameraConfig.frigate.camera_name,
    );

    let recordings: FrigateRecording[] = [];

    for (const dayData of recordingSummary ?? []) {
      for (const hourData of dayData.hours) {
        const hour = add(dayData.day, { hours: hourData.hour });
        const startHour = startOfHour(hour);
        const endHour = endOfHour(hour);
        if (
          (!query.start || startHour >= query.start) &&
          (!query.end || endHour <= query.end)
        ) {
          recordings.push({
            cameraID: query.cameraID,
            startTime: startHour,
            endTime: endHour,
            events: hourData.events,
          });
        }
      }
    }

    if (query.limit !== undefined) {
      // Frigate does not natively support a way to limit recording searches so
      // this simulates it.
      recordings = orderBy(
        recordings,
        (recording: FrigateRecording) => recording.startTime,
        'desc',
      ).slice(0, query.limit);
    }

    return <FrigateRecordingQueryResults>{
      type: QueryResultsType.Recording,
      engine: Engine.Frigate,
      recordings: recordings,
      expiry: add(new Date(), {
        seconds: RECORDING_SUMMARY_REQUEST_CACHE_MAX_AGE_SECONDS,
      }),
    };
  }

  public async getRecordingSegments(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    query: RecordingSegmentsQuery,
  ): Promise<QueryReturnType<RecordingSegmentsQuery> | null> {
    const cameraConfig = this._getQueryableCameraConfig(cameras, query.cameraID);
    if (!cameraConfig || !cameraConfig.frigate.camera_name) {
      return null;
    }

    const range: DateRange = { start: query.start, end: query.end };

    // A note on Frigate Recording Segments:
    // - Unlike other query types, there is an internal cache at the engine
    //   level for segments to allow caching "within an existing query" (e.g. if
    //   we already cached hour 1-8, we will avoid a fetch if we request hours
    //   2-3 even though the query is different -- the segments won't be). This
    //   is since the volume of data in segment transfers can be high, and the
    //   segments can be used in high frequency situations (e.g. video seeking).
    const cachedSegments = this._recordingSegmentsCache.get(query.cameraID, range);
    if (cachedSegments) {
      return {
        type: QueryResultsType.RecordingSegments,
        engine: Engine.Frigate,
        segments: cachedSegments,
      };
    }

    const request: NativeFrigateRecordingSegmentsQuery = {
      instance_id: cameraConfig.frigate.client_id,
      camera: cameraConfig.frigate.camera_name,
      after: Math.floor(query.start.getTime() / 1000),
      before: Math.floor(query.end.getTime() / 1000),
    };

    const segments = await getRecordingSegments(hass, request);
    this._recordingSegmentsCache.add(query.cameraID, range, segments);

    runWhenIdleIfSupported(() => this._throttledSegmentGarbageCollector(hass, cameras));

    return {
      type: QueryResultsType.RecordingSegments,
      engine: Engine.Frigate,
      segments: segments,
    };
  }

  public generateMediaFromEvents(
    query: EventQuery,
    results: QueryReturnType<EventQuery>,
  ): ViewMedia[] | null {
    if (!FrigateQueryResultsClassifier.isFrigateEventQueryResults(results)) {
      return null;
    }

    const output: ViewMedia[] = [];
    for (const event of results.events) {
      let mediaType: 'clip' | 'snapshot' | null = null;
      if (
        !query.hasClip &&
        !query.hasSnapshot &&
        (event.has_clip || event.has_snapshot)
      ) {
        mediaType = event.has_clip ? 'clip' : 'snapshot';
      } else if (query.hasSnapshot && event.has_snapshot) {
        mediaType = 'snapshot';
      } else if (query.hasClip && event.has_clip) {
        mediaType = 'clip';
      }
      if (!mediaType) {
        continue;
      }
      const media = FrigateViewMediaFactory.createEventViewMedia(
        mediaType,
        query.cameraID,
        event,
      );
      if (media) {
        output.push(media);
      }
    }
    return output;
  }

  public generateMediaFromRecordings(
    query: RecordingQuery,
    results: QueryReturnType<RecordingQuery>,
  ): ViewMedia[] | null {
    if (!FrigateQueryResultsClassifier.isFrigateRecordingQueryResults(results)) {
      return null;
    }

    const output: ViewMedia[] = [];
    for (const recording of results.recordings) {
      const media = FrigateViewMediaFactory.createRecordingViewMedia(
        query.cameraID,
        recording,
      );
      if (media) {
        output.push(media);
      }
    }
    return output;
  }

  public areMediaQueriesResultsFresh(
    queries: MediaQueries,
    results: MediaQueriesResults,
  ): boolean {
    let freshThreshold: number | null = null;
    if (MediaQueriesClassifier.areEventQueries(queries)) {
      freshThreshold = EVENT_REQUEST_CACHE_MAX_AGE_SECONDS;
    } else if (MediaQueriesClassifier.areRecordingQueries(queries)) {
      freshThreshold = RECORDING_SUMMARY_REQUEST_CACHE_MAX_AGE_SECONDS;
    }
    const now = new Date();
    const resultsTimestamp = results.getResultsTimestamp();
    return (
      !freshThreshold ||
      !resultsTimestamp ||
      add(resultsTimestamp, { seconds: freshThreshold }) >= now
    );
  }

  protected _getQueryableCameraConfig(
    cameras: Map<string, CameraConfig>,
    cameraID: string,
  ): CameraConfig | null {
    const cameraConfig = cameras.get(cameraID);
    if (!cameraConfig || cameraConfig.frigate.camera_name == CAMERA_BIRDSEYE) {
      return null;
    }
    return cameraConfig;
  }

  /**
   * Garbage collect recording segments that no longer feature in the recordings
   * returned by the Frigate backend.
   */
  protected async _garbageCollectSegments(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
  ): Promise<void> {
    const cameraIDs = this._recordingSegmentsCache.getCameraIDs();
    const recordingQueries: RecordingQuery[] = cameraIDs.map((cameraID) => ({
      cameraID: cameraID,
      type: QueryType.Recording,
    }));

    const countSegments = () =>
      sum(
        cameraIDs.map(
          (cameraID) => this._recordingSegmentsCache.getCache(cameraID)?.size() ?? 0,
        ),
      );
    const segmentsStart = countSegments();

    const results: Map<RecordingQuery, FrigateRecordingQueryResults> = new Map();

    await Promise.all(
      recordingQueries.map((query) =>
        (async () => {
          const recordings = await this.getRecordings(hass, cameras, query);
          if (recordings && recordings.engine === Engine.Frigate) {
            results.set(query, recordings as FrigateRecordingQueryResults);
          }
        })(),
      ),
    );

    // Performance: _recordingSegments is potentially very large (e.g. 10K - 1M
    // items) and each item must be examined, so care required here to stick to
    // nothing worse than O(n) performance.
    const getHourID = (cameraID: string, startTime: Date): string => {
      return `${cameraID}/${startTime.getDate()}/${startTime.getHours()}`;
    };

    for (const [query, result] of results) {
      const goodHours: Set<string> = new Set();
      for (const recording of result.recordings) {
        goodHours.add(getHourID(recording.cameraID, recording.startTime));
      }

      this._recordingSegmentsCache.expireMatches(
        query.cameraID,
        (segment: RecordingSegment) => {
          const hourID = getHourID(query.cameraID, fromUnixTime(segment.start_time));
          // ~O(1) lookup time for a JS set.
          return goodHours.has(hourID);
        },
      );
    }

    console.debug(
      'Frigate Card recording segment garbage collection: ' +
        `Released ${segmentsStart - countSegments()} segment(s)`,
    );
  }
}
