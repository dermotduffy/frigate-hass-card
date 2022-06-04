import { HomeAssistant } from 'custom-card-helpers';
import {
  add,
  endOfHour,
  format,
  fromUnixTime,
  getUnixTime,
  startOfHour,
  sub
} from 'date-fns';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { isEqual } from 'lodash-es';
import { DataSet } from 'vis-data/esnext';
import {
  DataGroupCollectionType,
  Timeline,
  TimelineEventPropertiesResult,
  TimelineItem,
  TimelineOptions,
  TimelineOptionsCluster,
  TimelineWindow
} from 'vis-timeline/esnext';
import { CAMERA_BIRDSEYE } from '../const';
import { localize } from '../localize/localize';
import timelineCoreStyle from '../scss/timeline-core.scss';
import timelineStyle from '../scss/timeline.scss';
import {
  BrowseMediaQueryParameters,
  CameraConfig,
  ExtendedHomeAssistant,
  FrigateBrowseMediaSource,
  frigateCardConfigDefaults,
  FrigateCardError,
  FrigateEvent,
  TimelineConfig
} from '../types';
import { stopEventFromActivatingCardWideActions } from '../utils/action';
import { dispatchFrigateCardEvent, prettifyTitle } from '../utils/basic';
import { getCameraTitle } from '../utils/camera.js';
import {
  getRecordingSegments,
  getRecordingsSummary,
  RecordingSegments,
  RecordingSummary
} from '../utils/frigate';
import {
  createEventParentForChildren,
  createVideoChild,
  generateRecordingIdentifier,
  getBrowseMediaQueryParameters,
  isTrueMedia,
  multipleBrowseMediaQuery
} from '../utils/ha/browse-media';
import { View, ViewContext } from '../view';
import { dispatchFrigateCardErrorEvent, dispatchMessageEvent } from './message.js';
import './surround-thumbnails.js';

const TIMELINE_DATA_MANAGER_MAX_AGE_SECONDS = 10;

interface FrigateCardGroupData {
  id: string;
  content: string;
}
interface FrigateCardTimelineItem extends TimelineItem {
  start: number;
  end?: number;
  event?: FrigateEvent;
  source?: FrigateBrowseMediaSource;
}

interface TimelineViewContext extends ViewContext {
  // The selected timeline window.
  window?: TimelineWindow;

  // The date of the last event fetch.
  dateFetch?: Date;
}

type TimelineMediaType = 'all' | 'clips' | 'snapshots';

interface CameraRecordings {
  segments: RecordingSegments;
  summary: RecordingSummary;
}

const isHoverableDevice = window.matchMedia('(hover: hover) and (pointer: fine)');

/**
 * A manager to maintain/fetch timeline events.
 */
class TimelineDataManager {
  protected _dataset = new DataSet<FrigateCardTimelineItem>();

  // The earliest date managed.
  protected _dateStart?: Date;

  // The latest date managed.
  protected _dateEnd?: Date;

  // The last fetch date.
  protected _dateFetch?: Date;

  // The maximum allowable age of fetch data (will not fetch more frequently
  // than this).
  protected _maxAgeSeconds: number = TIMELINE_DATA_MANAGER_MAX_AGE_SECONDS;

  protected _contentCallback?: (source: FrigateBrowseMediaSource) => string;
  protected _tooltipCallback?: (source: FrigateBrowseMediaSource) => string;

  constructor(params?: {
    contentCallback?: (source: FrigateBrowseMediaSource) => string;
    tooltipCallback?: (source: FrigateBrowseMediaSource) => string;
  }) {
    this._contentCallback = params?.contentCallback;
    this._tooltipCallback = params?.tooltipCallback;
  }

  // Get the last event fetch date.
  get lastFetchDate(): Date | null {
    return this._dateFetch ?? null;
  }

  /**
   * Retrieve the underlying dataset.
   */
  get dataset(): DataSet<FrigateCardTimelineItem> {
    return this._dataset;
  }

  /**
   * Determine if the dataset is empty.
   * @returns
   */
  public isEmpty(): boolean {
    return this._dataset.length === 0;
  }

  /**
   * Clear the dataset.
   */
  public clear(): void {
    this._dataset.clear();
  }

  /**
   * Add a FrigateBrowseMediaSource object to the managed timeline.
   * @param camera The id the camera this object is from.
   * @param target The FrigateBrowseMediaSource to add.
   */
  protected _addMediaSource(
    camera: string,
    mediaPriority: TimelineMediaType,
    target: FrigateBrowseMediaSource,
  ): void {
    const items: FrigateCardTimelineItem[] = [];
    target.children?.forEach((child) => {
      const event = child.frigate?.event;
      if (
        event &&
        isTrueMedia(child) &&
        ['video', 'image'].includes(child.media_content_type)
      ) {
        let item = this._dataset.get(event.id);
        if (!item) {
          item = {
            id: event.id,
            group: camera,
            content: this._contentCallback?.(child) ?? '',
            title: this._tooltipCallback?.(child) ?? '',
            start: event.start_time * 1000,
            event: event,
          };
        }
        if (
          (child.media_content_type === 'video' &&
            ['all', 'clips'].includes(mediaPriority)) ||
          (!item.source &&
            child.media_content_type === 'image' &&
            ['all', 'snapshots'].includes(mediaPriority))
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
   * @param cameras The cameras map.
   * @param start Fetch events that start later than this date.
   * @param end Fetch events that start earlier than this date.
   * @returns `true` if events were fetched, `false` otherwise.
   */
  public async fetchIfNecessary(
    element: HTMLElement,
    hass: ExtendedHomeAssistant,
    cameras: Map<string, CameraConfig>,
    eventMedia: TimelineMediaType,
    start: Date,
    end: Date,
    recordings?: boolean,
  ): Promise<boolean> {
    const now = new Date();
    if (this.hasCoverage(now, start, end)) {
      return false;
    }

    // Cannot fetch the future.
    end = end > now ? now : end;

    if (!this._dateStart || start < this._dateStart) {
      this._dateStart = start;
    }
    if (!this._dateEnd || end > this._dateEnd) {
      this._dateEnd = end;
    }
    this._dateFetch = new Date();

    await Promise.all([
      // Events are always fetched for the maximum extent of the managed
      // range. This is because events may change at any point in time
      // (e.g. a long-running event that ends).
      this._fetchEvents(
        element,
        hass,
        cameras,
        eventMedia,
        this._dateStart,
        this._dateEnd,
      ),
      ...(recordings ? [this._fetchRecordings(element, hass, cameras)] : []),
    ]);

    return true;
  }

  /**
   * Fetch recording hours for the timeline.
   * @param element The element to send error events from.
   * @param hass The HomeAssistant object.
   * @param cameras The cameras map.
   * @param start Fetch events that start later than this date.
   * @param end Fetch events that start earlier than this date.
   */
  protected async _fetchRecordings(
    element: HTMLElement,
    hass: ExtendedHomeAssistant,
    cameras: Map<string, CameraConfig>,
  ): Promise<void> {
    const items: FrigateCardTimelineItem[] = [];
    const now = new Date();

    const storeRecordings = async (
      camera: string,
      config: CameraConfig,
    ): Promise<void> => {
      if (!config.camera_name) {
        return;
      }
      let summary: RecordingSummary;
      try {
        summary = await getRecordingsSummary(hass, config.client_id, config.camera_name);
      } catch (e) {
        return dispatchFrigateCardErrorEvent(element, e as FrigateCardError);
      }

      for (const dayData of summary) {
        for (const hourData of dayData.hours) {
          const hour = add(dayData.day, { hours: hourData.hour });
          const endHour = endOfHour(hour);
          items.push({
            id: `recording-${camera}-${format(hour, 'yyyy-MM-dd-HH')}`,
            group: camera,
            start: getUnixTime(startOfHour(hour)) * 1000,

            // Don't let the recordings show off into the future (even though it
            // is intended to be indicative of any recordings within that hour
            // -- it still looks strange!)
            end: (endHour > now ? getUnixTime(now) : getUnixTime(endHour)) * 1000,
            type: 'background',
            content: '',
          });
        }
      }
    };

    await Promise.all(
      Array.from(cameras.entries()).map(([camera, config]: [string, CameraConfig]) =>
        storeRecordings(camera, config),
      ),
    );

    this._dataset.update(items);
  }

  /**
   * Fetch events for the timeline.
   * @param element The element to send error events from.
   * @param hass The HomeAssistant object.
   * @param cameras The cameras map.
   * @param start Fetch events that start later than this date.
   * @param end Fetch events that start earlier than this date.
   */
  protected async _fetchEvents(
    element: HTMLElement,
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    media: TimelineMediaType,
    start: Date,
    end: Date,
  ): Promise<void> {
    const params: BrowseMediaQueryParameters[] = [];
    cameras.forEach((cameraConfig, cameraID) => {
      (media === 'all' ? ['clips', 'snapshots'] : [media]).forEach((mediaType) => {
        if (cameraConfig.camera_name !== CAMERA_BIRDSEYE) {
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
      });
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

    for (const [query, result] of results.entries()) {
      if (query.cameraID) {
        this._addMediaSource(query.cameraID, media, result);
      }
    }
  }
}

@customElement('frigate-card-timeline')
export class FrigateCardTimeline extends LitElement {
  @property({ attribute: false })
  protected hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected cameras?: Map<string, CameraConfig>;

  @property({ attribute: false })
  protected timelineConfig?: TimelineConfig;

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.timelineConfig) {
      return html``;
    }

    return html` <frigate-card-surround-thumbnails
      .hass=${this.hass}
      .view=${this.view}
      .config=${this.timelineConfig.controls.thumbnails}
    >
      <frigate-card-timeline-core
        .hass=${this.hass}
        .view=${this.view}
        .cameras=${this.cameras}
        .timelineConfig=${this.timelineConfig}
      >
      </frigate-card-timeline-core>
    </frigate-card-surround-thumbnails>`;
  }

  /**
   * Return compiled CSS styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(timelineStyle);
  }
}

@customElement('frigate-card-timeline-core')
export class FrigateCardTimelineCore extends LitElement {
  @property({ attribute: false })
  protected hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected cameras?: Map<string, CameraConfig>;

  @property({ attribute: false })
  protected timelineConfig?: TimelineConfig;

  protected _data = new TimelineDataManager({
    tooltipCallback: this._getTooltip.bind(this),
  });
  protected _refTimeline: Ref<HTMLElement> = createRef();
  protected _timeline?: Timeline;

  // Need a way to separate when a user clicks (to pan the timeline) vs when a
  // user clicks (to choose a recording (non-event) to play). On pan,
  // _wasDragged will be set to true, and the click subsequently ignored.
  protected _wasDragged = false;

  /**
   * Get a tooltip for a given timeline event.
   * @param source The FrigateBrowseMediaSource in question.
   * @returns The tooltip as a string to render.
   */
  protected _getTooltip(source: FrigateBrowseMediaSource): string {
    if (!isHoverableDevice.matches) {
      // Don't display tooltips on touch devices, they just get in the way of
      // the drawer.
      return '';
    }

    const eventAttr = source.frigate?.event
      ? `event='${JSON.stringify(source.frigate.event)}'`
      : '';
    const detailsAttr = this.timelineConfig?.controls.thumbnails.show_details
      ? 'details'
      : '';

    // Cannot use Lit data-bindings as visjs requires a string for tooltips.
    // Note that changes to attributes here must be mirrored in the xss
    // whitelist in `_getOptions()` .
    return `
      <frigate-card-thumbnail
        ${detailsAttr}
        thumbnail="${source.thumbnail}"
        label="${source.title}"
        ${eventAttr}
      >
      </frigate-card-thumbnail>`;
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.view || !this.timelineConfig) {
      return;
    }

    const thumbnailsConfig = this.timelineConfig.controls.thumbnails;
    const timelineClasses = {
      timeline: true,
      'left-margin': thumbnailsConfig.mode === 'left',
      'right-margin': thumbnailsConfig.mode === 'right',
    };

    return html`<div
      class="${classMap(timelineClasses)}"
      ${ref(this._refTimeline)}
    ></div>`;
  }

  /**
   * Get the number of seconds to seek into a video stream consisting of the
   * provided segments to reach the target time provided.
   * @param time Target time.
   * @param segments A RecordingSegments object.
   * @returns
   */
  protected _getSeekTime(time: Date, segments: RecordingSegments): number | null {
    if (!segments.length) {
      return null;
    }
    const target = getUnixTime(time);
    const hourStart = getUnixTime(startOfHour(time));
    let seekSeconds = 0;

    // Inspired by: https://github.com/blakeblackshear/frigate/blob/release-0.11.0/web/src/routes/Recording.jsx#L27
    for (const segment of segments) {
      if (segment.start_time > target) {
        break;
      }
      const start = segment.start_time < hourStart ? hourStart : segment.start_time;
      const end = segment.end_time > target ? target : segment.end_time;
      seekSeconds += end - start;
    }
    return seekSeconds;
  }

  /**
   * Create recording objects.
   * @param results A map of camera ID to a CameraRecordings object.
   * @param time The target time for the recordings.
   * @param onlyMatchingHour If `true` only shows the hour matching the target
   * for the provided cameras, otherwise shows all hours.
   * @returns
   */
  protected _createRecordingChildren(
    results: Map<string, CameraRecordings>,
    time: Date,
    onlyMatchingHour: boolean,
  ): FrigateBrowseMediaSource[] {
    const children: FrigateBrowseMediaSource[] = [];
    const processedCameras: Set<string> = new Set();

    for (const [camera, recording] of results.entries()) {
      const config = this.cameras?.get(camera);
      if (!config?.camera_name) {
        continue;
      }

      // There is a single set of recordings for a given Frigate camera name.
      // Zones on that same camera do not get separate recordings. The card may
      // have multiple instances of the same camera for different zoness, so
      // need to enforce uniqueness here.
      const uniqueID = `${config.client_id}/${config.camera_name}`;
      if (processedCameras.has(uniqueID)) {
        continue;
      }
      processedCameras.add(uniqueID);

      const seekSeconds = this._getSeekTime(time, recording.segments);
      if (seekSeconds === null) {
        continue;
      }

      for (const dayData of recording.summary) {
        for (const hourData of dayData.hours) {
          const hour = add(dayData.day, { hours: hourData.hour });
          const startHour = startOfHour(hour);
          const endHour = endOfHour(hour);
          const isMatchingHour = time >= startHour && time <= endHour;

          if (!onlyMatchingHour || isMatchingHour) {
            children.push(
              createVideoChild(
                `${prettifyTitle(config.camera_name)} ${format(
                  hour,
                  'yyyy-MM-dd HH:mm',
                )}`,
                generateRecordingIdentifier({
                  clientId: config.client_id,
                  year: dayData.day.getFullYear(),
                  month: dayData.day.getMonth() + 1,
                  day: dayData.day.getDate(),
                  hour: hourData.hour,
                  cameraName: config.camera_name,
                }),
                {
                  recording: {
                    camera: config.camera_name,
                    start_time: getUnixTime(startHour),
                    end_time: getUnixTime(endHour),
                    events: hourData.events,
                    ...(isMatchingHour && {
                      seek_seconds: seekSeconds,
                      seek_time: time.getTime() / 1000,
                    }),
                  },
                },
              ),
            );
          }
        }
      }
    }
    return children;
  }

  /**
   * Change the view to a recording.
   * @param time The time of the recording to show.
   * @param camera An optional camera to show a recording of, otherwise all
   * cameras are shown at the given time.
   */
  protected async _changeViewToRecording(time: Date, camera?: string): Promise<void> {
    if (!this.hass) {
      return;
    }

    const before = endOfHour(time);
    const after = startOfHour(time);
    const results: Map<string, CameraRecordings> = new Map();

    const fetch = async (camera: string, config?: CameraConfig): Promise<void> => {
      if (!config || !config.camera_name || !this.hass) {
        return;
      }

      try {
        const cameraResults = await Promise.all([
          getRecordingSegments(
            this.hass,
            config.client_id,
            config.camera_name,
            before,
            after,
          ),
          getRecordingsSummary(this.hass, config.client_id, config.camera_name),
        ]);
        results.set(camera, { segments: cameraResults[0], summary: cameraResults[1] });
      } catch (e) {}
    };
    const cameras = camera ? [camera] : [...(this.cameras?.keys() ?? [])];
    await Promise.all(cameras.map((camera) => fetch(camera, this.cameras?.get(camera))));

    const children = this._createRecordingChildren(results, time, !camera);
    if (!children.length) {
      return;
    }

    let childIndex = 0;
    if (camera) {
      childIndex = children.findIndex(
        (child) =>
          child.frigate?.recording &&
          child.frigate.recording.start_time * 1000 === after.getTime(),
      );
      if (childIndex < 0) {
        return;
      }
    }

    this.view
      ?.evolve({
        view: 'event',
        target: createEventParentForChildren(localize('common.recordings'), children),
        childIndex: childIndex,
      })
      .dispatchChangeEvent(this);
  }

  /**
   * Called whenever the range is in the process of being changed.
   * @param properties
   */
  protected _timelineRangeChangeHandler(
    properties: TimelineEventPropertiesResult,
  ): void {
    if (properties.event) {
      // When a human changes the range, an event will be set.
      this._wasDragged = true;
    }
  }

  /**
   * Called whenever the timeline is clicked.
   * @param properties The properties of the timeline click event.
   */
  protected _timelineClickHandler(properties: TimelineEventPropertiesResult): void {
    if (properties.what && ['item', 'background'].includes(properties.what)) {
      // Prevent interaction with items on the timeline from activating card
      // wide actions.
      stopEventFromActivatingCardWideActions(properties.event);
    }

    if (!this._wasDragged && properties.what) {
      if (['background', 'group-label'].includes(properties.what)) {
        this._changeViewToRecording(properties.time, String(properties.group));
      } else if (properties.what === 'axis') {
        this._changeViewToRecording(properties.time);
      }
    }

    this._wasDragged = false;
  }

  /**
   * Handle a range change in the timeline.
   * @param properties vis.js provided range information.
   */
  protected _timelineRangeHandler(properties: {
    start: Date;
    end: Date;
    byUser: boolean;
    event: Event;
  }): void {
    if (!properties.byUser) {
      return;
    }
    if (this.hass && this.cameras && this._timeline && this.timelineConfig) {
      this._data
        .fetchIfNecessary(
          this,
          this.hass,
          this.cameras,
          this.timelineConfig.media,
          properties.start,
          properties.end,
          this.timelineConfig.show_recordings,
        )
        .then(() => {
          if (this._timeline) {
            const thumbnails = this._generateThumbnails();
            // Update the view to reflect the new thumbnails and the timeline
            // window in the context.
            this.view
              ?.evolve({
                target: thumbnails?.target ?? null,
                childIndex: thumbnails?.childIndex ?? null,
                context: this._generateViewContext(true),
              })
              .dispatchChangeEvent(this);
          }
        });
    }
  }

  /**
   * Called when an object on the timeline is selected.
   * @param data The data about the selection.
   * @returns
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _timelineSelectHandler(data: { items: string[]; event: Event }): void {
    if (!this.view?.target || !this.view?.target.children) {
      return;
    }

    const childIndex = data.items.length
      ? this.view.target.children.findIndex(
          (child) => child.frigate?.event?.id === data.items[0],
        )
      : null;

    this.view
      ?.evolve({
        childIndex: childIndex,
      })
      .dispatchChangeEvent(this);

    if (childIndex !== null && childIndex >= 0) {
      dispatchFrigateCardEvent(this, 'thumbnails:open');
    } else {
      dispatchFrigateCardEvent(this, 'thumbnails:close');
    }
  }

  /**
   * Regenerate the thumbnails from the timeline events.
   * @returns An object with two keys, or null on error. The keys are `target`
   * containing all the thumbnails, and `childIndex` to refer to the currently
   * selected thumbnail.
   */
  protected _generateThumbnails(): {
    target: FrigateBrowseMediaSource;
    childIndex: number | null;
  } | null {
    if (!this._timeline) {
      return null;
    }

    /**
     * Sort the timeline items most recent to least recent.
     * @param a The first item.
     * @param b The second item.
     * @returns -1, 0, 1 (standard array sort function configuration).
     */
    const sortEvent = (
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

    const selected = this._timeline.getSelection();
    let childIndex = -1;
    const children: FrigateBrowseMediaSource[] = [];
    this._data.dataset.get({ order: sortEvent }).forEach((item) => {
      if (item.event && item.source) {
        children.push(item.source);
        if (selected.includes(item.event.id)) {
          childIndex = children.length - 1;
        }
      }
    });
    if (!children.length) {
      return null;
    }

    return {
      target: createEventParentForChildren('Timeline events', children),
      childIndex: childIndex < 0 ? null : childIndex,
    };
  }

  /**
   * Build the visjs dataset to render on the timeline.
   * @returns The dataset.
   */
  protected _getGroups(): DataGroupCollectionType {
    const groups: FrigateCardGroupData[] = [];
    this.cameras?.forEach((cameraConfig, camera) => {
      if (cameraConfig.camera_name && cameraConfig.camera_name !== CAMERA_BIRDSEYE) {
        groups.push({
          id: camera,
          content: getCameraTitle(this.hass, cameraConfig),
        });
      }
    });
    return new DataSet(groups);
  }

  /**
   * Given an event get an appropriate start/end time window around the event.
   * @param event The FrigateEvent to consider.
   * @returns A tuple of start/end date.
   */
  protected _getStartEndFromEvent(event: FrigateEvent): [Date, Date] {
    const windowSeconds = this._getConfiguredWindowSeconds();
    if (event.end_time) {
      if (event.end_time - event.start_time > windowSeconds) {
        // If the event is larger than the configured window, only show the most
        // recent portion of the event that fits in the window.
        return [
          sub(fromUnixTime(event.end_time), { seconds: windowSeconds }),
          fromUnixTime(event.end_time),
        ];
      } else {
        // If the event is shorter than the configured window, center the event
        // in the window.
        const gap = windowSeconds - (event.end_time - event.start_time);
        return [
          sub(fromUnixTime(event.start_time), { seconds: gap / 2 }),
          add(fromUnixTime(event.end_time), { seconds: gap / 2 }),
        ];
      }
    }
    // If there's no end-time yet, place the start-time in the center of the
    // time window.
    return [
      sub(fromUnixTime(event.start_time), { seconds: windowSeconds / 2 }),
      add(fromUnixTime(event.start_time), { seconds: windowSeconds / 2 }),
    ];
  }

  /**
   * Get the configured window length in seconds.
   */
  protected _getConfiguredWindowSeconds(): number {
    return (
      this.timelineConfig?.window_seconds ??
      frigateCardConfigDefaults.timeline.window_seconds
    );
  }

  /**
   * Get desired timeline start/end time.
   * @returns A tuple of start/end date.
   */
  protected _getStartEnd(): [Date, Date] {
    const event = this.view?.target?.frigate?.event;
    if (event) {
      return this._getStartEndFromEvent(event);
    }
    const end = new Date();
    const start = sub(end, {
      seconds: this._getConfiguredWindowSeconds(),
    });
    return [start, end];
  }

  /**
   * Determine if the timeline should use clustering.
   * @returns `true` if the timeline should cluster, `false` otherwise.
   */
  protected _isClustering(): boolean {
    return (
      !!this.timelineConfig?.clustering_threshold &&
      this.timelineConfig.clustering_threshold > 0
    );
  }

  /**
   * Handle timeline resize.
   */
  protected _getOptions(): TimelineOptions | void {
    if (!this.timelineConfig) {
      return;
    }

    const [start, end] = this._getStartEnd();

    // Configuration for the Timeline, see:
    // https://visjs.github.io/vis-timeline/docs/timeline/#Configuration_Options
    return {
      cluster: this._isClustering()
        ? {
            // It would be better to automatically calculate `maxItems` from the
            // rendered height of the timeline (or group within the timeline) so
            // as to not waste vertical space (e.g. after the user changes to
            // fullscreen mode). Unfortunately this is not easy to do, as we
            // don't know the height of the timeline until after it renders --
            // and if we adjust `maxItems` then we can get into an infinite
            // resize loop. Adjusting the `maxItems` of a timeline, after it's
            // created, also does not appear to work as expected.
            maxItems: this.timelineConfig.clustering_threshold,

            clusterCriteria: (first: TimelineItem, second: TimelineItem): boolean => {
              // Never include the target media in a cluster, and never group
              // different object types together (e.g. person and car).
              return (
                [first.type, second.type].every((type) => type !== 'background') &&
                first.type === second.type &&
                !!first.id &&
                first.id !== this.view?.media?.frigate?.event?.id &&
                !!second.id &&
                second.id != this.view?.media?.frigate?.event?.id &&
                (<FrigateCardTimelineItem>first).event?.label ===
                  (<FrigateCardTimelineItem>second).event?.label
              );
            },
          }
        : (false as TimelineOptionsCluster),
      minHeight: '100%',
      maxHeight: '100%',
      zoomMax: 1 * 24 * 60 * 60 * 1000,
      zoomMin: 1 * 1000,
      selectable: true,
      start: start,
      end: end,
      groupHeightMode: 'fixed',
      tooltip: {
        followMouse: true,
        overflowMethod: 'cap',
      },
      xss: {
        disabled: false,
        filterOptions: {
          whiteList: {
            'frigate-card-thumbnail': [
              'details',
              'thumbnail',
              'label',
              'event',
            ],
            div: ['title'],
            span: ['style'],
          },
        },
      },
    };
  }

  /**
   * Determine if the component should be updated.
   * @param _changedProps The changed properties.
   * @returns
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldUpdate(_changedProps: PropertyValues): boolean {
    return !!this.hass && !!this.cameras && this.cameras.size > 0;
  }

  /**
   * Update the timeline from the view object.
   */
  protected async _updateTimelineFromView(): Promise<void> {
    if (!this.hass || !this.cameras || !this.view || !this.timelineConfig) {
      return;
    }

    const event = this.view?.media?.frigate?.event;
    const [windowStart, windowEnd] = event
      ? this._getStartEndFromEvent(event)
      : this._getStartEnd();

    await this._data.fetchIfNecessary(
      this,
      this.hass,
      this.cameras,
      this.timelineConfig.media,
      windowStart,
      windowEnd,
      this.timelineConfig.show_recordings,
    );

    if (!this._timeline) {
      return;
    }

    this._timeline.setSelection(event ? [event.id] : [], {
      focus: false,
      animation: {
        animation: false,
        zoom: false,
      },
    });

    // Regenerate the thumbnails after the selection, to allow the new selection
    // to be in the generated view.
    const context = this.view.context as TimelineViewContext | null;
    const timelineWindow = this._timeline.getWindow();

    if (context?.window) {
      if (!isEqual(context.window, timelineWindow)) {
        this._timeline.setWindow(context.window.start, context.window.end);
      }
    } else if (event) {
      const eventStart = new Date(event.start_time * 1000);
      const eventEnd = event.end_time ? new Date(event.end_time * 1000) : 0;

      if (
        eventStart < timelineWindow.start ||
        eventStart > timelineWindow.end ||
        (eventEnd && (eventEnd < timelineWindow.start || eventEnd > timelineWindow.end))
      ) {
        this._timeline.setWindow(windowStart, windowEnd);
      }

      if (this._isClustering()) {
        // Hack: Clustering may not update unless the dataset changes, artifically
        // update the dataset to ensure the newly selected item cannot be included
        // in a cluster.
        const item = this._data.dataset.get(event.id);
        if (item) {
          this._data.dataset.updateOnly(item);
        }
      }
    } else {
      this._timeline.setWindow(windowStart, windowEnd);
    }

    // Compare last date of fetch with that of inbound view to avoid a loop.
    // Without this comparison it would be:
    //
    // Timeline receives a new `view`
    //  -> Events fetched
    //    -> Thumbnails generated
    //      -> New view dispatched (to load thumbnails into outer carousel).
    //  -> New view received ... [loop]
    const currentContext = this.view.context as TimelineViewContext | null;
    if (currentContext?.dateFetch !== this._data.lastFetchDate) {
      const thumbnails = this._generateThumbnails();
      this.view
        ?.evolve({
          target: thumbnails?.target ?? null,
          childIndex: thumbnails?.childIndex ?? null,
          context: this._generateViewContext(false),
        })
        .dispatchChangeEvent(this);
    }
  }

  /**
   * Generate the context for timeline views.
   * @param addWindow Whether or not to include the timeline window. If `false`
   * the window is preserved if it is already in the context.
   * @returns The TimelineViewContext object.
   */
  protected _generateViewContext(addWindow: boolean): TimelineViewContext {
    const currentContext = this.view?.context as TimelineViewContext | undefined;
    const newContext: TimelineViewContext = {};
    if (addWindow && this._timeline) {
      newContext.window = this._timeline.getWindow();
    } else if (currentContext?.window) {
      newContext.window = currentContext.window;
    }
    if (this._data.lastFetchDate) {
      newContext.dateFetch = this._data.lastFetchDate;
    }
    return newContext || null;
  }

  /**
   * Called when an update will occur.
   * @param changedProps The changed properties
   */
   protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('timelineConfig')) {
      if (this.timelineConfig?.controls.thumbnails.size) {
        this.style.setProperty(
          '--frigate-card-thumbnail-size',
          `${this.timelineConfig.controls.thumbnails.size}px`,
        );
      }
    }
  }

  /**
   * Called when the component is updated.
   * @param changedProperties The changed properties if any.
   */
  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (changedProperties.has('cameras')) {
      this._data.clear();
      this._timeline?.destroy();
      this._timeline = undefined;
    }

    const options = this._getOptions();
    if (changedProperties.has('timelineConfig') && this._refTimeline.value && options) {
      if (this._timeline) {
        this._timeline.setOptions(options);
      } else {
        // Don't show an empty timeline, show a message instead.
        const groups = this._getGroups();
        if (!groups.length) {
          dispatchMessageEvent(
            this,
            localize('error.timeline_no_cameras'),
            'mdi:chart-gantt',
          );
          return;
        }

        this._timeline = new Timeline(
          this._refTimeline.value,
          this._data.dataset,
          groups,
          options,
        );
        this._timeline.on('select', this._timelineSelectHandler.bind(this));
        this._timeline.on('rangechanged', this._timelineRangeHandler.bind(this));
        this._timeline.on('click', this._timelineClickHandler.bind(this));
        this._timeline.on('rangechange', this._timelineRangeChangeHandler.bind(this));
      }
    }

    if (changedProperties.has('view')) {
      this._updateTimelineFromView();
    }
  }

  /**
   * Return compiled CSS styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(timelineCoreStyle);
  }
}
