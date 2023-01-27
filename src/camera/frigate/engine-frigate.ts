import { HomeAssistant } from 'custom-card-helpers';
import add from 'date-fns/add';
import endOfHour from 'date-fns/endOfHour';
import startOfHour from 'date-fns/startOfHour';
import { CAMERA_BIRDSEYE } from '../../const';
import { CameraConfig, RecordingSegment } from '../../types';
import { ViewMedia } from '../../view/media';
import { RequestCache, RecordingSegmentsCache } from '../cache';
import {
  CameraManagerEngine,
  CAMERA_MANAGER_ENGINE_EVENT_LIMIT_DEFAULT,
} from '../engine';
import { DateRange } from '../range';
import {
  DataQuery,
  Engine,
  EventQuery,
  EventQueryResults,
  EventQueryResultsMap,
  FrigateEventQueryResults,
  FrigateRecordingQueryResults,
  FrigateRecordingSegmentsQueryResults,
  MediaMetadata,
  PartialEventQuery,
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
  RecordingSegmentsQueryResultsMap,
} from '../types';
import { FrigateRecording } from './types';
import {
  getEvents,
  getEventSummary,
  getRecordingSegments,
  getRecordingsSummary,
  NativeFrigateEventQuery,
  NativeFrigateRecordingSegmentsQuery,
  retainEvent,
} from './requests';
import orderBy from 'lodash-es/orderBy';
import throttle from 'lodash-es/throttle';
import { allPromises, runWhenIdleIfSupported } from '../../utils/basic';
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
  protected _requestCache: RequestCache;

  // Garbage collect segments at most once an hour.
  protected _throttledSegmentGarbageCollector = throttle(
    this._garbageCollectSegments.bind(this),
    60 * 60 * 1000,
    { leading: false, trailing: true },
  );

  constructor(
    recordingSegmentsCache: RecordingSegmentsCache,
    requestCache: RequestCache,
  ) {
    this._recordingSegmentsCache = recordingSegmentsCache;
    this._requestCache = requestCache;
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
    cameras: Map<string, CameraConfig>,
    cameraIDs: Set<string>,
    query: PartialEventQuery,
  ): EventQuery[] | null {
    const relevantCameraConfigs = Array.from(cameraIDs).map((cameraID) =>
      cameras.get(cameraID),
    );

    // If there isn't a label or zone specified, we can come up with a single
    // batch query for Frigate that will match across all cameras.
    const canDoBatchQuery = relevantCameraConfigs.every(
      (cameraConfig) => !cameraConfig?.frigate.label && !cameraConfig?.frigate.zone,
    );

    if (canDoBatchQuery) {
      return [
        {
          type: QueryType.Event,
          cameraIDs: cameraIDs,
          ...query,
        },
      ];
    }

    const output: EventQuery[] = [];
    for (const cameraID of cameraIDs) {
      const cameraConfig = cameras.get(cameraID);
      if (cameraConfig) {
        output.push({
          type: QueryType.Event,
          cameraIDs: new Set([cameraID]),
          ...(cameraConfig.frigate.label && {
            what: new Set([cameraConfig.frigate.label]),
          }),
          ...(cameraConfig.frigate.zone && {
            where: new Set([cameraConfig.frigate.zone]),
          }),
          ...query,
        });
      }
    }
    return output.length ? output : null;
  }

  public generateDefaultRecordingQuery(
    _cameras: Map<string, CameraConfig>,
    cameraIDs: Set<string>,
    query: PartialRecordingQuery,
  ): RecordingQuery[] | null {
    return [
      {
        type: QueryType.Recording,
        cameraIDs: cameraIDs,
        ...query,
      },
    ];
  }

  public generateDefaultRecordingSegmentsQuery(
    _cameras: Map<string, CameraConfig>,
    cameraIDs: Set<string>,
    query: PartialRecordingSegmentsQuery,
  ): RecordingSegmentsQuery[] | null {
    if (!query.start || !query.end) {
      return null;
    }
    return [
      {
        type: QueryType.RecordingSegments,
        cameraIDs: cameraIDs,
        start: query.start,
        end: query.end,
        ...query,
      },
    ];
  }

  public async favoriteMedia(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
    media: ViewMedia,
    favorite: boolean,
  ): Promise<void> {
    if (!FrigateViewMediaClassifier.isFrigateEvent(media)) {
      return;
    }

    await retainEvent(hass, cameraConfig.frigate.client_id, media.getID(), favorite);
    media.setFavorite(favorite);
  }

  protected _buildInstanceToCameraIDMapFromQuery(
    cameras: Map<string, CameraConfig>,
    cameraIDs: Set<string>,
  ): Map<string, Set<string>> {
    const output: Map<string, Set<string>> = new Map();
    for (const cameraID of cameraIDs) {
      const cameraConfig = this._getQueryableCameraConfig(cameras, cameraID);
      const clientID = cameraConfig?.frigate.client_id;
      if (clientID) {
        if (!output.has(clientID)) {
          output.set(clientID, new Set());
        }
        output.get(clientID)?.add(cameraID);
      }
    }
    return output;
  }

  protected _getFrigateCameraNamesForCameraIDs(
    cameras: Map<string, CameraConfig>,
    cameraIDs: Set<string>,
  ): Set<string> {
    const output = new Set<string>();
    for (const cameraID of cameraIDs) {
      const cameraConfig = this._getQueryableCameraConfig(cameras, cameraID);
      if (cameraConfig?.frigate.camera_name) {
        output.add(cameraConfig.frigate.camera_name);
      }
    }
    return output;
  }

  public async getEvents(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    query: EventQuery,
  ): Promise<EventQueryResultsMap | null> {
    const output: EventQueryResultsMap = new Map();

    const processInstanceQuery = async (
      instanceID: string,
      cameraIDs?: Set<string>,
    ): Promise<void> => {
      if (!cameraIDs || !cameraIDs.size) {
        return;
      }
      const instanceQuery = { ...query, cameraIDs: cameraIDs };
      const cachedResult = this._requestCache.get(instanceQuery);
      if (cachedResult) {
        output.set(query, cachedResult as EventQueryResults);
        return;
      }

      const nativeQuery: NativeFrigateEventQuery = {
        instance_id: instanceID,
        cameras: Array.from(this._getFrigateCameraNamesForCameraIDs(cameras, cameraIDs)),
        ...(query.what && { labels: Array.from(query.what) }),
        ...(query.where && { zones: Array.from(query.where) }),
        ...(query.end && { before: Math.floor(query.end.getTime() / 1000) }),
        ...(query.start && { after: Math.floor(query.start.getTime() / 1000) }),
        ...(query.limit && { limit: query.limit }),
        ...(query.hasClip && { has_clip: query.hasClip }),
        ...(query.hasSnapshot && { has_snapshot: query.hasSnapshot }),
        ...(query.favorite && { favorites: query.favorite }),
        limit: query?.limit ?? CAMERA_MANAGER_ENGINE_EVENT_LIMIT_DEFAULT,
      };

      const result: FrigateEventQueryResults = {
        type: QueryResultsType.Event,
        engine: Engine.Frigate,
        instanceID: instanceID,
        events: await getEvents(hass, nativeQuery),
        expiry: add(new Date(), { seconds: EVENT_REQUEST_CACHE_MAX_AGE_SECONDS }),
        cached: false,
      };

      this._requestCache.set(query, { ...result, cached: true }, result.expiry);
      output.set(instanceQuery, result);
    };

    // Frigate allows multiple cameras to be searched for events in a single
    // query. Break them down into groups of cameras per Frigate instance, then
    // query once per instance for all cameras in that instance.
    const instances = this._buildInstanceToCameraIDMapFromQuery(
      cameras,
      query.cameraIDs,
    );

    await Promise.all(
      Array.from(instances.keys()).map((instanceID) =>
        processInstanceQuery(instanceID, instances.get(instanceID)),
      ),
    );
    return output.size ? output : null;
  }

  public async getRecordings(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    query: RecordingQuery,
  ): Promise<RecordingQueryResultsMap | null> {
    const output: RecordingQueryResultsMap = new Map();

    const processQuery = async (
      baseQuery: RecordingQuery,
      cameraID: string,
    ): Promise<void> => {
      const query = { ...baseQuery, cameraIDs: new Set([cameraID]) };
      const cachedResult = this._requestCache.get(query);
      if (cachedResult) {
        output.set(query, cachedResult as RecordingQueryResults);
        return;
      }

      const cameraConfig = this._getQueryableCameraConfig(cameras, cameraID);
      if (!cameraConfig || !cameraConfig.frigate.camera_name) {
        return;
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
              cameraID: cameraID,
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

      const result: FrigateRecordingQueryResults = {
        type: QueryResultsType.Recording,
        engine: Engine.Frigate,
        instanceID: cameraConfig.frigate.client_id,
        recordings: recordings,
        expiry: add(new Date(), {
          seconds: RECORDING_SUMMARY_REQUEST_CACHE_MAX_AGE_SECONDS,
        }),
        cached: false,
      };
      this._requestCache.set(query, { ...result, cached: true }, result.expiry);
      output.set(query, result);
    };

    // Frigate recordings can only be queried for a single camera, so fan out
    // the inbound query into multiple outbound queries.
    await Promise.all(
      Array.from(query.cameraIDs).map((cameraID) => processQuery(query, cameraID)),
    );
    return output.size ? output : null;
  }

  public async getRecordingSegments(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    query: RecordingSegmentsQuery,
  ): Promise<RecordingSegmentsQueryResultsMap | null> {
    const output: RecordingSegmentsQueryResultsMap = new Map();

    const processQuery = async (
      baseQuery: RecordingSegmentsQuery,
      cameraID: string,
    ): Promise<void> => {
      const query = { ...baseQuery, cameraIDs: new Set([cameraID]) };
      const cameraConfig = this._getQueryableCameraConfig(cameras, cameraID);
      if (!cameraConfig || !cameraConfig.frigate.camera_name) {
        return;
      }

      const range: DateRange = { start: query.start, end: query.end };

      // A note on Frigate Recording Segments:
      // - There is an internal cache at the engine level for segments to allow
      //   caching "within an existing query" (e.g. if we already cached hour
      //   1-8, we will avoid a fetch if we request hours 2-3 even though the
      //   query is different -- the segments won't be). This is since the
      //   volume of data in segment transfers can be high, and the segments can
      //   be used in high frequency situations (e.g. video seeking).
      const cachedSegments = this._recordingSegmentsCache.get(cameraID, range);
      if (cachedSegments) {
        output.set(query, <FrigateRecordingSegmentsQueryResults>{
          type: QueryResultsType.RecordingSegments,
          engine: Engine.Frigate,
          instanceID: cameraConfig.frigate.client_id,
          segments: cachedSegments,
          cached: true,
        });
        return;
      }

      const request: NativeFrigateRecordingSegmentsQuery = {
        instance_id: cameraConfig.frigate.client_id,
        camera: cameraConfig.frigate.camera_name,
        after: Math.floor(query.start.getTime() / 1000),
        before: Math.floor(query.end.getTime() / 1000),
      };

      const segments = await getRecordingSegments(hass, request);
      this._recordingSegmentsCache.add(cameraID, range, segments);

      output.set(query, <FrigateRecordingSegmentsQueryResults>{
        type: QueryResultsType.RecordingSegments,
        engine: Engine.Frigate,
        instanceID: cameraConfig.frigate.client_id,
        segments: segments,
        cached: false,
      });
    };

    // Frigate recording segments can only be queried for a single camera, so
    // fan out the inbound query into multiple outbound queries.
    await Promise.all(
      Array.from(query.cameraIDs).map((cameraID) => processQuery(query, cameraID)),
    );

    runWhenIdleIfSupported(() => this._throttledSegmentGarbageCollector(hass, cameras));
    return output.size ? output : null;
  }

  protected _getCameraIDMatch(
    cameras: Map<string, CameraConfig>,
    query: DataQuery,
    instanceID: string,
    cameraName: string,
  ): string | null {
    // If the query is only for a single cameraID, all results are assumed to
    // belong to it for performance reasons. Otherwise, we need to map the
    // instanceID and camera name for the known cameras, and get the precise
    // cameraID that matches the expected instance ID / camera name.
    if (query.cameraIDs.size === 1) {
      return [...query.cameraIDs][0];
    }
    for (const [cameraID, cameraConfig] of cameras.entries()) {
      if (
        cameraConfig.frigate.client_id === instanceID &&
        cameraConfig.frigate.camera_name === cameraName
      ) {
        return cameraID;
      }
    }
    return null;
  }

  public generateMediaFromEvents(
    cameras: Map<string, CameraConfig>,
    query: EventQuery,
    results: QueryReturnType<EventQuery>,
  ): ViewMedia[] | null {
    if (!FrigateQueryResultsClassifier.isFrigateEventQueryResults(results)) {
      return null;
    }

    const output: ViewMedia[] = [];
    for (const event of results.events) {
      const cameraID = this._getCameraIDMatch(
        cameras,
        query,
        results.instanceID,
        event.camera,
      );
      if (!cameraID) {
        continue;
      }
      const cameraConfig = this._getQueryableCameraConfig(cameras, cameraID);
      if (!cameraConfig) {
        continue;
      }
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
        cameraID,
        cameraConfig,
        event,
      );
      if (media) {
        output.push(media);
      }
    }
    return output;
  }

  public generateMediaFromRecordings(
    cameras: Map<string, CameraConfig>,
    _query: RecordingQuery,
    results: QueryReturnType<RecordingQuery>,
  ): ViewMedia[] | null {
    if (!FrigateQueryResultsClassifier.isFrigateRecordingQueryResults(results)) {
      return null;
    }

    const output: ViewMedia[] = [];
    for (const recording of results.recordings) {
      const cameraConfig = this._getQueryableCameraConfig(cameras, recording.cameraID);
      if (!cameraConfig) {
        continue;
      }
      const media = FrigateViewMediaFactory.createRecordingViewMedia(
        recording.cameraID,
        recording,
        cameraConfig,
      );
      if (media) {
        output.push(media);
      }
    }
    return output;
  }

  public getQueryResultMaxAge(query: DataQuery): number | null {
    if (query.type === QueryType.Event) {
      return EVENT_REQUEST_CACHE_MAX_AGE_SECONDS;
    } else if (query.type === QueryType.Recording) {
      return RECORDING_SUMMARY_REQUEST_CACHE_MAX_AGE_SECONDS;
    }
    return null;
  }

  public async getMediaSeekTime(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    media: ViewMedia,
    target: Date,
  ): Promise<number | null> {
    const start = media.getStartTime();
    const end = media.getEndTime();
    if (!start || !end || target < start || target > end) {
      return null;
    }

    const cameraID = media.getCameraID();
    const query: RecordingSegmentsQuery = {
      cameraIDs: new Set([cameraID]),
      start: start,
      end: end,
      type: QueryType.RecordingSegments,
    };

    const results = await this.getRecordingSegments(hass, cameras, query);

    if (results) {
      return this._getSeekTimeInSegments(
        start,
        target,
        // There will only be a single result since Frigate recording segments
        // searches are per camera which is specified singularly above.
        Array.from(results.values())[0].segments,
      );
    }
    return null;
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

  public async getMediaMetadata(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
  ): Promise<MediaMetadata | null> {
    const what: Set<string> = new Set();
    const where: Set<string> = new Set();
    const days: Set<string> = new Set();

    const instances = this._buildInstanceToCameraIDMapFromQuery(
      cameras,
      new Set(cameras.keys()),
    );

    const processQuery = async (
      instanceID: string,
      cameraIDs: Set<string>,
    ): Promise<void> => {
      const cameraNames = this._getFrigateCameraNamesForCameraIDs(cameras, cameraIDs);
      for (const entry of await getEventSummary(hass, instanceID)) {
        if (!cameraNames.has(entry.camera)) {
          // If this entry applies to a camera that *is* in this Frigate
          // instance, but is *not* a configured camera in the card, skip it.
          continue;
        }
        if (entry.label) {
          what.add(entry.label);
        }
        if (entry.zones.length) {
          entry.zones.forEach(where.add, where);
        }
        if (entry.day) {
          days.add(entry.day);
        }
      }
    };

    await allPromises([...instances.entries()], ([instanceID, cameraIDs]) =>
      processQuery(instanceID, cameraIDs),
    );

    if (!what.size && !where.size && !days.size) {
      return null;
    }
    return {
      ...(what.size && { what: what }),
      ...(where.size && { where: where }),
      ...(days.size && { days: days }),
    };
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
    const recordingQuery: RecordingQuery = {
      cameraIDs: new Set(cameraIDs),
      type: QueryType.Recording,
    };

    const countSegments = () =>
      sum(
        cameraIDs.map(
          (cameraID) => this._recordingSegmentsCache.getCache(cameraID)?.size() ?? 0,
        ),
      );
    const segmentsStart = countSegments();

    // Performance: _recordingSegments is potentially very large (e.g. 10K - 1M
    // items) and each item must be examined, so care required here to stick to
    // nothing worse than O(n) performance.
    const getHourID = (cameraID: string, startTime: Date): string => {
      return `${cameraID}/${startTime.getDate()}/${startTime.getHours()}`;
    };

    const results = await this.getRecordings(hass, cameras, recordingQuery);
    if (!results) {
      return;
    }

    for (const [query, result] of results) {
      if (!FrigateQueryResultsClassifier.isFrigateRecordingQueryResults(result)) {
        continue;
      }

      const goodHours: Set<string> = new Set();
      for (const recording of result.recordings) {
        goodHours.add(getHourID(recording.cameraID, recording.startTime));
      }

      // Frigate recordings are always executed individually, so there'll only
      // be a single results.
      const cameraID = Array.from(query.cameraIDs)[0];
      this._recordingSegmentsCache.expireMatches(
        cameraID,
        (segment: RecordingSegment) => {
          const hourID = getHourID(cameraID, fromUnixTime(segment.start_time));
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

  /**
   * Get the number of seconds to seek into a video stream consisting of the
   * provided segments to reach the target time provided.
   * @param startTime The earliest allowable time to seek from.
   * @param targetTime Target time.
   * @param segments An array of segments dataset items. Must be sorted from oldest to youngest.
   * @returns
   */
  protected _getSeekTimeInSegments(
    startTime: Date,
    targetTime: Date,
    segments: RecordingSegment[],
  ): number | null {
    if (!segments.length) {
      return null;
    }
    let seekMilliseconds = 0;

    // Inspired by: https://github.com/blakeblackshear/frigate/blob/release-0.11.0/web/src/routes/Recording.jsx#L27
    for (const segment of segments) {
      const segmentStart = fromUnixTime(segment.start_time);
      if (segmentStart > targetTime) {
        break;
      }
      const segmentEnd = fromUnixTime(segment.end_time);
      const start = segmentStart < startTime ? startTime : segmentStart;
      const end = segmentEnd > targetTime ? targetTime : segmentEnd;
      seekMilliseconds += end.getTime() - start.getTime();
    }
    return seekMilliseconds / 1000;
  }
}
