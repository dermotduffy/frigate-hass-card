import { HomeAssistant } from 'custom-card-helpers';
import { DataSet, DataView } from 'vis-data/esnext';
import type { IdType, TimelineItem } from 'vis-timeline/esnext';
import { CAMERA_BIRDSEYE } from '../const.js';
import {
  CameraConfig,
  ExtendedHomeAssistant,
  FrigateCardError,
  FrigateEvent,
  FrigateEvents,
} from '../types.js';
import { errorToConsole, runWhenIdleIfSupported } from './basic.js';
import {
  FrigateGetEventsParameters,
  getEventsMultiple,
  getRecordingSegments,
  getRecordingsSummary,
  RecordingSegments,
  RecordingSummary,
} from './frigate.js';
import { dispatchFrigateCardErrorEvent } from '../components/message.js';
import fromUnixTime from 'date-fns/fromUnixTime';
import { throttle } from 'lodash-es';

const RECORDING_SEGMENT_TOLERANCE = 60;
const DATA_MANAGER_MAX_AGE_SECONDS = 10;
const DATA_MANAGER_MAX_FETCH_COUNT = 10000;

export interface FrigateCardTimelineItem extends TimelineItem {
  // DataView has issues using datasets with Date objects, so avoid them and use
  // numbers instead.
  start: number;
  end?: number;
  event?: FrigateEvent;
}

type TimelineMediaType = 'all' | 'clips' | 'snapshots';

export interface RecordingSegmentsItem {
  id: string;
  cameraID: string;
  start: number;
  end: number;
}

/**
 * Sort the timeline items most recent to least recent.
 * @param a The first item.
 * @param b The second item.
 * @returns -1, 0, 1 (standard array sort function configuration).
 */
export const sortYoungestToOldest = (
  a: RecordingSegmentsItem | FrigateCardTimelineItem,
  b: RecordingSegmentsItem | FrigateCardTimelineItem,
): number => {
  if (a.start < b.start) {
    return 1;
  }
  if (a.start > b.start) {
    return -1;
  }
  return 0;
};

/**
 * Sort the segments least recent to most recent.
 * @param a The first item.
 * @param b The second item.
 * @returns -1, 0, 1 (standard array sort function configuration).
 */
export const sortOldestToYoungest = (
  a: RecordingSegmentsItem | FrigateCardTimelineItem,
  b: RecordingSegmentsItem | FrigateCardTimelineItem,
): number => {
  if (a.start < b.start) {
    return -1;
  }
  if (a.start > b.start) {
    return 1;
  }
  return 0;
};

/**
 * A manager to maintain/fetch timeline events.
 */
export class DataManager {
  protected _recordingSummary: Map<string, RecordingSummary | null> = new Map();
  protected _recordingSegments = new DataSet<RecordingSegmentsItem>();

  protected _dataset = new DataSet<FrigateCardTimelineItem>();

  // The earliest date managed.
  protected _dateStart: Date | null = null;

  // The latest date managed.
  protected _dateEnd: Date | null = null;

  // The last fetch date.
  protected _dateFetch: Date | null = null;

  // The maximum allowable age of fetch data (will not fetch more frequently
  // than this).
  protected _maxAgeSeconds: number = DATA_MANAGER_MAX_AGE_SECONDS;

  protected _cameras: Map<string, CameraConfig>;

  // Garbage collect segments at most once an hour.
  protected _throttledSegmentGarbageCollector = throttle(
    () => {
      runWhenIdleIfSupported(this._garbageCollectSegments.bind(this));
    },
    60 * 60 * 1000,
    { trailing: true },
  );

  constructor(cameras: Map<string, CameraConfig>) {
    this._cameras = cameras;
  }

  // Get the last event fetch date.
  get lastFetchDate(): Date | null {
    return this._dateFetch ?? null;
  }

  public getRecordingSummaryForCamera(cameraID: string): RecordingSummary | null {
    return this._recordingSummary.get(cameraID) ?? null;
  }

  /**
   * Create a dataview for a given set of camera.
   * @param cameraIDs The cameraIDs to include.
   * @param showRecordings Whether or not to show recordings.
   * @returns A dataview.
   */
  public createDataView(
    cameraIDs: Set<string>,
    showRecordings: boolean,
    mediaType: TimelineMediaType,
  ): DataView<FrigateCardTimelineItem> {
    return new DataView(this._dataset, {
      filter: (item: FrigateCardTimelineItem) =>
        // Only return items for the given cameras.
        !!item.group &&
        cameraIDs.has(String(item.group)) &&
        // Don't return recordings if the user does not want them.
        (showRecordings || item.type !== 'background') &&
        // Don't return events that are the wrong media type.
        (item.type === 'background' ||
          mediaType === 'all' ||
          (mediaType === 'clips' && !!item.event?.has_clip) ||
          (mediaType === 'snapshots' && !!item.event?.has_snapshot)),
    });
  }

  /**
   * Create a dataview for segments.
   * @returns A dataview.
   */
  public createSegmentDataView(): DataView<RecordingSegmentsItem> {
    return new DataView(this._recordingSegments);
  }

  /**
   * Get the underlying recording segments dataset.
   */
  get recordingSegments(): DataSet<RecordingSegmentsItem> {
    return this._recordingSegments;
  }

  /**
   * Rewrite an item as-is. May be useful in cases where clustering may need to
   * be recalculated.
   * @param id The id to rewrite.
   */
  public rewriteItem(id: IdType): void {
    // Hack: Clustering may not update unless the dataset changes, artifically
    // update the dataset to ensure the newly selected item cannot be included
    // in a cluster.
    const item = this._dataset.get(id);
    if (item) {
      this._dataset.updateOnly(item);
    }
  }

  /**
   * Add events for the given camera.
   * @param cameraID The camera ID.
   * @param events The array of events.
   */
  protected _addEvents(cameraID: string, events: FrigateEvents): void {
    this._dataset.update(
      events.map((event) => ({
        id: event.id,
        group: cameraID,
        content: '',
        event: event,
        start: event.start_time * 1000,
        type: event.end_time ? 'range' : 'point',
        ...(event.end_time && { end: event.end_time * 1000 }),
      })),
    );
  }

  /**
   * Determine if the timeline has coverage for a given range of dates.
   * @param start The start of the date range.
   * @param end An optional end of the date range.
   * @returns
   */
  public hasCoverage(now: Date, start: Date, end?: Date): boolean {
    // Never fetched: no coverage.
    if (!this._dateFetch || !this._dateStart || !this._dateEnd) {
      return false;
    }

    // If the most recent fetch is older than maxAgeSeconds: no coverage.
    if (
      this._maxAgeSeconds &&
      now.getTime() - this._dateFetch.getTime() > this._maxAgeSeconds * 1000
    ) {
      return false;
    }

    // If the most requested data is earlier than the earliest stored: no
    // coverage.
    if (start < this._dateStart) {
      return false;
    }

    // If there's no end time specified: there IS coverage.
    if (!end) {
      return true;
    }
    // If the requested end time is older than the oldest requested: there IS
    // coverage.
    if (end.getTime() < this._dateEnd.getTime()) {
      return true;
    }
    // If there's no maxAgeSeconds specified: no coverage.
    if (!this._maxAgeSeconds) {
      return false;
    }
    // If the requested end time is beyond `_maxAgeSeconds` of now: no coverage.
    if (now.getTime() - end.getTime() > this._maxAgeSeconds * 1000) {
      return false;
    }

    // End time is within `_maxAgeSeconds` of the latest data: there IS
    // coverage.
    return end.getTime() - this._maxAgeSeconds * 1000 <= this._dateEnd.getTime();
  }

  /**
   * Fetch events if no coverage in given range.
   * @param element The element to send error events from.
   * @param hass The HomeAssistant object.
   * @param start Fetch events that start later than this date.
   * @param end Fetch events that start earlier than this date.
   * @returns `true` if events were fetched, `false` otherwise.
   */
  public async fetchIfNecessary(
    element: HTMLElement,
    hass: ExtendedHomeAssistant,
    start: Date,
    end: Date,
  ): Promise<boolean> {
    // Cannot fetch the future, always clip the end date to now so as to avoid
    // checking for coverage that could not possibly exist yet.
    const now = new Date();
    end = end > now ? now : end;

    if (this.hasCoverage(now, start, end)) {
      return false;
    }

    const oldStart = this._dateStart;
    const oldEnd = this._dateEnd;
    let segmentStart: Date | null = null;
    let segmentEnd: Date | null = null;
    if (!this._dateStart || start < this._dateStart) {
      this._dateStart = start;
      segmentStart = start;
    } else {
      segmentStart = oldEnd ?? end;
    }
    if (!this._dateEnd || end > this._dateEnd) {
      this._dateEnd = end;
      segmentEnd = end;
    } else {
      segmentEnd = oldStart ?? start;
    }

    this._dateFetch = new Date();

    await Promise.all([
      // Events are always fetched for the maximum extent of the managed
      // range. This is because events may change at any point in time
      // (e.g. a long-running event that ends).
      this._fetchEvents(element, hass, this._dateStart, this._dateEnd),
      this._fetchRecordingSummary(hass),
      ...(segmentEnd > segmentStart
        ? [this._fetchRecordingSegments(hass, segmentStart, segmentEnd)]
        : []),
    ]);

    this._throttledSegmentGarbageCollector();
    return true;
  }

  /**
   * Garbage collect recording segments that no longer feature in the summary.
   */
  protected _garbageCollectSegments(): void {
    if (!this._recordingSegments || !this._recordingSummary) {
      return;
    }

    // Performance: _recordingSegments is potentially very large (e.g. 10K - 1M
    // items) and each item must be examined, so care required here to stick to
    // nothing worse than O(n) performance.
    const getHourID = (cameraID: string, day: number, hour: number): string => {
      return `${cameraID}/${day}/${hour}`;
    };

    const goodHours: Set<string> = new Set();
    for (const cameraID of this._recordingSummary.keys()) {
      for (const summaryDay of this._recordingSummary?.get(cameraID) ?? []) {
        for (const summaryHour of summaryDay.hours) {
          goodHours.add(getHourID(cameraID, summaryDay.day.getDate(), summaryHour.hour));
        }
      }
    }

    const deleteIDs: string[] = [];
    this._recordingSegments.forEach((item, id) => {
      const startDate = fromUnixTime(item.start / 1000);
      const hourID = getHourID(item.cameraID, startDate.getDate(), startDate.getHours());

      // ~O(1) lookup time for a JS set.
      if (!goodHours.has(hourID)) {
        deleteIDs.push(String(id));
      }
    });

    this._recordingSegments.remove(deleteIDs);
    this._compressRecordingSegmentsOntoTimeline();
  }

  /**
   * Fetch recording segments for cameras.
   * @param hass The HomeAssistant object.
   * @param start Fetch segments that start later than this date.
   * @param end Fetch segments that start earlier than this date.
   */
  protected async _fetchRecordingSegments(
    hass: ExtendedHomeAssistant,
    start: Date,
    end: Date,
  ): Promise<void> {
    const results: Map<string, RecordingSegments> = new Map();
    const fetch = async (camera: string, config?: CameraConfig): Promise<void> => {
      if (!config || !config.frigate.camera_name || !hass) {
        return;
      }

      try {
        const cameraResults = await getRecordingSegments(
          hass,
          config.frigate.client_id,
          config.frigate.camera_name,
          end,
          start,
        );
        results.set(camera, cameraResults);
      } catch (e) {
        errorToConsole(e as Error);
      }
    };

    await Promise.all(
      Array.from(this._cameras.keys()).map((camera) =>
        fetch(camera, this._cameras.get(camera)),
      ),
    );

    const items: RecordingSegmentsItem[] = [];
    results.forEach((segments, cameraID) => {
      segments.forEach((segment) => {
        items.push({
          id: `${cameraID}/${segment.id}`,
          cameraID: cameraID,
          start: segment.start_time * 1000,
          end: segment.end_time * 1000,
        });
      });
    });
    this._recordingSegments.update(items);
    this._compressRecordingSegmentsOntoTimeline();
  }

  /**
   * Compress recording segments into recordings shown on the timeline
   * background.
   */
  protected _compressRecordingSegmentsOntoTimeline(): void {
    if (!this._recordingSegments.length) {
      return;
    }

    // Delete all the existing background.
    this._dataset.remove(
      this._dataset.get({
        filter: (item) => item.type === 'background',
      }),
    );

    const convertToRecording = (
      segment: RecordingSegmentsItem,
    ): FrigateCardTimelineItem => {
      return {
        id: `recording-${segment.cameraID}-${segment.id}`,
        group: segment.cameraID,
        start: segment.start,
        end: segment.end,
        content: ' ',
        type: 'background',
      };
    };

    // Iterate through the segments least to most recent, effectively joining
    // segments together that are within a certain tolerance to create large
    // blocks that are visualized on the timeline as recordings.
    const recordings: FrigateCardTimelineItem[] = [];

    this._cameras.forEach((_, cameraID) => {
      const segments = this._recordingSegments.get({
        filter: (item) => item.cameraID === cameraID,
        order: sortOldestToYoungest,
      });
      let current: RecordingSegmentsItem | null = null;
      for (let i = 0; i < segments.length; ++i) {
        const item = segments[i];

        if (!current) {
          current = { ...item };
        } else if (current.end + RECORDING_SEGMENT_TOLERANCE * 1000 >= item.start) {
          current.end = item.end;
        } else {
          recordings.push(convertToRecording(current));
          current = null;
        }
        if (i === segments.length - 1 && current) {
          recordings.push(convertToRecording(current));
        }
      }
    });

    this._dataset.update(recordings);
  }

  /**
   * Fetch recording summary.
   * @param hass The HomeAssistant object.
   */
  protected async _fetchRecordingSummary(hass: ExtendedHomeAssistant): Promise<void> {
    const storeRecordingSummary = async (
      cameraID: string,
      cameraConfig: CameraConfig,
    ): Promise<void> => {
      if (!cameraConfig.frigate.camera_name) {
        return;
      }
      try {
        this._recordingSummary.set(
          cameraID,
          await getRecordingsSummary(
            hass,
            cameraConfig.frigate.client_id,
            cameraConfig.frigate.camera_name,
          ),
        );
      } catch (e) {
        // Recording failure should not disrupt the rest of the timeline
        // experience.
        errorToConsole(e as Error);
      }
    };

    await Promise.all(
      Array.from(this._cameras.keys()).map(async (cameraID) => {
        const cameraConfig = this._cameras.get(cameraID);
        if (cameraConfig) {
          await storeRecordingSummary(cameraID, cameraConfig);
        }
      }),
    );
  }

  /**
   * Fetch events for the timeline.
   * @param element The element to send error events from.
   * @param hass The HomeAssistant object.
   * @param start Fetch events that start later than this date.
   * @param end Fetch events that start earlier than this date.
   */
  protected async _fetchEvents(
    element: HTMLElement,
    hass: HomeAssistant,
    start: Date,
    end: Date,
  ): Promise<void> {
    const params: Map<string, FrigateGetEventsParameters> = new Map();

    this._cameras.forEach((cameraConfig, cameraID) => {
      if (
        cameraConfig.frigate.camera_name &&
        cameraConfig.frigate.camera_name !== CAMERA_BIRDSEYE
      ) {
        params.set(cameraID, {
          instance_id: cameraConfig.frigate.client_id,
          camera: cameraConfig.frigate.camera_name,
          ...(cameraConfig.frigate.label && { label: cameraConfig.frigate.label }),
          ...(cameraConfig.frigate.zone && { label: cameraConfig.frigate.zone }),
          before: Math.floor(end.getTime() / 1000),
          after: Math.floor(start.getTime() / 1000),
          limit: DATA_MANAGER_MAX_FETCH_COUNT,
        });
      }
    });

    let results: Map<string, FrigateEvents>;
    try {
      results = await getEventsMultiple(hass, params);
    } catch (e) {
      return dispatchFrigateCardErrorEvent(element, e as FrigateCardError);
    }
    results.forEach((params, cameraID) => this._addEvents(cameraID, params));
  }
}
