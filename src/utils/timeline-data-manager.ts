import { HomeAssistant } from 'custom-card-helpers';
import { DataSet, DataView } from 'vis-data/esnext';
import { IdType, TimelineItem } from 'vis-timeline/esnext';
import { CAMERA_BIRDSEYE } from '../const.js';
import {
  BrowseMediaQueryParameters,
  CameraConfig,
  ExtendedHomeAssistant,
  FrigateBrowseMediaSource,
  FrigateCardError,
  FrigateEvent,
} from '../types.js';
import { errorToConsole } from '../utils/basic.js';
import {
  getRecordingSegments,
  getRecordingsSummary,
  RecordingSegments,
  RecordingSummary,
} from './frigate.js';
import {
  getBrowseMediaQueryParameters,
  isTrueMedia,
  multipleBrowseMediaQuery,
} from './ha/browse-media.js';
import { dispatchFrigateCardErrorEvent } from '../components/message.js';

const RECORDING_SEGMENT_TOLERANCE = 60;
const TIMELINE_DATA_MANAGER_MAX_AGE_SECONDS = 10;

export interface FrigateCardTimelineItem extends TimelineItem {
  // DataView has issues using datasets with Date objects, so avoid them and use
  // numbers instead.
  start: number;
  end?: number;
  event?: FrigateEvent;
  source?: FrigateBrowseMediaSource;
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
export const sortTimelineItemsYoungestToOldest = (
  a: FrigateCardTimelineItem,
  b: FrigateCardTimelineItem,
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
export const sortSegmentsOldestToYoungest = (
  a: RecordingSegmentsItem,
  b: RecordingSegmentsItem,
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
export class TimelineDataManager {
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
  protected _maxAgeSeconds: number = TIMELINE_DATA_MANAGER_MAX_AGE_SECONDS;

  protected _cameras: Map<string, CameraConfig>;
  protected _mediaType: TimelineMediaType;

  constructor(cameras: Map<string, CameraConfig>, mediaType: TimelineMediaType) {
    this._cameras = cameras;
    this._mediaType = mediaType;
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
   * @returns 
   */
  public createDataView(
    cameraIDs: Set<string>,
    showRecordings: boolean,
  ): DataView<FrigateCardTimelineItem> {
    return new DataView(this._dataset, {
      filter: (item: FrigateCardTimelineItem) =>
        !!item.group &&
        cameraIDs.has(String(item.group)) &&
        (showRecordings || item.type !== 'background'),
    });
  }

  /**
   * Create a dataview for segments.
   * @returns 
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
   * Add a FrigateBrowseMediaSource object to the managed timeline.
   * @param cameraID The id the camera this object is from.
   * @param target The FrigateBrowseMediaSource to add.
   */
  protected _addMediaSource(target: FrigateBrowseMediaSource): void {
    const items: FrigateCardTimelineItem[] = [];
    target.children?.forEach((child) => {
      const event = child.frigate?.event;
      const cameraID = child.frigate?.cameraID;
      if (
        cameraID &&
        event &&
        isTrueMedia(child) &&
        ['video', 'image'].includes(child.media_content_type)
      ) {
        let item = this._dataset.get(event.id);
        if (!item) {
          item = {
            id: event.id,
            group: cameraID,
            content: '',
            start: event.start_time * 1000,
            event: event,
          };
        }
        if (
          (child.media_content_type === 'video' &&
            ['all', 'clips'].includes(this._mediaType)) ||
          (!item.source &&
            child.media_content_type === 'image' &&
            ['all', 'snapshots'].includes(this._mediaType))
        ) {
          item.source = child;
        }
        if (event.end_time) {
          item['end'] = event.end_time * 1000;
          item['type'] = 'range';
        } else {
          item['type'] = 'point';
        }
        items.push(item);
      }
    });

    this._dataset.update(items);
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
    return true;
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
        order: sortSegmentsOldestToYoungest,
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
    const params: BrowseMediaQueryParameters[] = [];
    this._cameras.forEach((cameraConfig, cameraID) => {
      (this._mediaType === 'all' ? ['clips', 'snapshots'] : [this._mediaType]).forEach(
        (mediaType) => {
          if (cameraConfig?.frigate.camera_name !== CAMERA_BIRDSEYE) {
            const param = getBrowseMediaQueryParameters(hass, cameraID, cameraConfig, {
              before: end.getTime() / 1000,
              after: start.getTime() / 1000,
              unlimited: true,
              mediaType: mediaType as 'clips' | 'snapshots',
            });
            if (param) {
              params.push(param);
            }
          }
        },
      );
    });

    if (!params.length) {
      return;
    }

    let results: Map<BrowseMediaQueryParameters, FrigateBrowseMediaSource>;
    try {
      results = await multipleBrowseMediaQuery(hass, params);
    } catch (e) {
      return dispatchFrigateCardErrorEvent(element, e as FrigateCardError);
    }
    for (const result of results.values()) {
      this._addMediaSource(result);
    }
  }
}
