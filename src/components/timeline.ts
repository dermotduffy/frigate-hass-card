import {
  CSSResultGroup,
  LitElement,
  TemplateResult,
  html,
  unsafeCSS,
  PropertyValues,
} from 'lit';
import { DataSet } from 'vis-data/esnext';
import {
  DataGroupCollectionType,
  Timeline,
  TimelineEventPropertiesResult,
  TimelineItem,
  TimelineOptions,
  TimelineOptionsCluster,
  TimelineWindow,
} from 'vis-timeline/esnext';
import { HomeAssistant } from 'custom-card-helpers';
import { classMap } from 'lit/directives/class-map.js';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { add, fromUnixTime, sub } from 'date-fns';
import { isEqual } from 'lodash-es';

import { BrowseMediaUtil } from '../browse-media-util';
import {
  BrowseMediaQueryParameters,
  CameraConfig,
  FrigateBrowseMediaSource,
  TimelineConfig,
  FrigateEvent,
  frigateCardConfigDefaults,
} from '../types';
import { View, ViewContext } from '../view';
import {
  dispatchErrorMessageEvent,
  dispatchFrigateCardEvent,
  getCameraTitle,
  stopEventFromActivatingCardWideActions,
} from '../common.js';

import timelineCoreStyle from '../scss/timeline-core.scss';
import timelineStyle from '../scss/timeline.scss';

import './surround-thumbnails.js';

const TIMELINE_EVENT_MANAGER_MAX_AGE_SECONDS = 10;

interface FrigateCardGroupData {
  id: string;
  content: string;
}
interface FrigateCardTimelineItem extends TimelineItem {
  event: FrigateEvent;
  source?: FrigateBrowseMediaSource;
}

interface TimelineViewContext extends ViewContext {
  // The selected timeline window.
  window?: TimelineWindow;

  // The date of the last event fetch.
  dateFetch?: Date;
}

type TimelineMediaType = 'all' | 'clips' | 'snapshots';

const isHoverableDevice = window.matchMedia('(hover: hover) and (pointer: fine)');

/**
 * A manager to maintain/fetch timeline events.
 */
class TimelineEventManager {
  protected _dataset = new DataSet<FrigateCardTimelineItem>();

  // The earliest date managed.
  protected _dateStart?: Date;

  // The latest date managed.
  protected _dateEnd?: Date;

  // The last fetch date.
  protected _dateFetch?: Date;

  // The maximum allowable age of fetch data (will not fetch more frequently
  // than this).
  protected _maxAgeSeconds: number = TIMELINE_EVENT_MANAGER_MAX_AGE_SECONDS;

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
        BrowseMediaUtil.isTrueMedia(child) &&
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
  public hasCoverage(start: Date, end?: Date): boolean {
    const now = new Date().getTime();

    // Never fetched: no coverage.
    if (!this._dateFetch || !this._dateStart || !this._dateEnd) {
      return false;
    }

    // If the most recent fetch is older than maxAgeSeconds: no coverage.
    if (
      this._maxAgeSeconds &&
      now - this._dateFetch.getTime() > this._maxAgeSeconds * 1000
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
    if (now - end.getTime() > this._maxAgeSeconds * 1000) {
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
  public async fetchEventsIfNecessary(
    element: HTMLElement,
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    media: TimelineMediaType,
    start: Date,
    end: Date,
  ): Promise<boolean> {
    if (this.hasCoverage(start, end)) {
      return false;
    }
    await this._fetchEvents(element, hass, cameras, media, start, end);
    return true;
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
    start?: Date,
    end?: Date,
  ): Promise<void> {
    if (!this._dateStart || (start && start < this._dateStart)) {
      this._dateStart = start;
    }
    if (!this._dateEnd || (end && end > this._dateEnd)) {
      this._dateEnd = end;
    }
    if (!this._dateStart || !this._dateEnd) {
      return;
    }
    this._dateFetch = new Date();

    const params: BrowseMediaQueryParameters[] = [];
    cameras.forEach((cameraConfig, cameraID) => {
      (media === 'all' ? ['clips', 'snapshots'] : [media]).forEach((mediaType) => {
        if (this._dateEnd && this._dateStart) {
          const param = BrowseMediaUtil.getBrowseMediaQueryParameters(
            hass,
            cameraID,
            cameraConfig,
            {
              // Events are always fetched for the maximum extent of the managed
              // range. This is because events may change at any point in time
              // (e.g. a long-running event that ends).
              before: this._dateEnd.getTime() / 1000,
              after: this._dateStart.getTime() / 1000,
              unlimited: true,
              mediaType: mediaType as 'clips' | 'snapshots',
            },
          );
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
      results = await BrowseMediaUtil.multipleBrowseMediaQuery(hass, params);
    } catch (e) {
      return dispatchErrorMessageEvent(element, (e as Error).message);
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
  protected hass?: HomeAssistant;

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
  protected hass?: HomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected cameras?: Map<string, CameraConfig>;

  @property({ attribute: false })
  protected timelineConfig?: TimelineConfig;

  protected _events = new TimelineEventManager({
    tooltipCallback: this._getTooltip.bind(this),
  });
  protected _refTimeline: Ref<HTMLElement> = createRef();
  protected _timeline?: Timeline;

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

    const thumbnailSizeAttr = this.timelineConfig
      ? `thumbnail_size="${this.timelineConfig.controls.thumbnails.size}"`
      : '';
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
        ${thumbnailSizeAttr}
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

  protected _timelineClickHandler(properties: TimelineEventPropertiesResult): void {
    if (properties.what === 'item') {
      // Prevent interaction with items on the timeline from activating card
      // wide actions.
      stopEventFromActivatingCardWideActions(properties.event);
    }
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
      this._events
        .fetchEventsIfNecessary(
          this,
          this.hass,
          this.cameras,
          this.timelineConfig.media,
          properties.start,
          properties.end,
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
          (child) => child.frigate?.event.id === data.items[0],
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
    this._events.dataset.get({ order: sortEvent }).forEach((item) => {
      if (item.source) {
        children.push(item.source);
        if (selected.includes(item.event.id)) {
          childIndex = children.length - 1;
        }
      }
    });
    if (!children.length) {
      return null;
    }

    const target = BrowseMediaUtil.createEventParentForChildren(
      'Timeline events',
      children,
    );
    return {
      target: target,
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
      groups.push({
        id: camera,
        content: getCameraTitle(this.hass, cameraConfig),
      });
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
                !!first.id &&
                first.id !== this.view?.media?.frigate?.event?.id &&
                !!second.id &&
                second.id != this.view?.media?.frigate?.event?.id &&
                (<FrigateCardTimelineItem>first).event.label ===
                  (<FrigateCardTimelineItem>second).event.label
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
              'thumbnail_size',
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
    if (
      !this.hass ||
      !this.cameras ||
      !this.view ||
      !this._timeline ||
      !this.timelineConfig
    ) {
      return;
    }

    const event = this.view?.media?.frigate?.event;
    const [windowStart, windowEnd] = event
      ? this._getStartEndFromEvent(event)
      : this._getStartEnd();

    await this._events.fetchEventsIfNecessary(
      this,
      this.hass,
      this.cameras,
      this.timelineConfig.media,
      windowStart,
      windowEnd,
    );

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
        const item = this._events.dataset.get(event.id);
        if (item) {
          this._events.dataset.updateOnly(item);
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
    if (currentContext?.dateFetch !== this._events.lastFetchDate) {
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
    if (this._events.lastFetchDate) {
      newContext.dateFetch = this._events.lastFetchDate;
    }
    return newContext || null;
  }

  /**
   * Called when the component is updated.
   * @param changedProperties The changed properties if any.
   */
  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (changedProperties.has('cameras')) {
      this._events.clear();
      this._timeline?.destroy();
      this._timeline = undefined;
    }

    const options = this._getOptions();
    if (changedProperties.has('timelineConfig') && this._refTimeline.value && options) {
      if (this._timeline) {
        this._timeline.setOptions(options);
      } else {
        this._timeline = new Timeline(
          this._refTimeline.value,
          this._events.dataset,
          this._getGroups(),
          options,
        );
        this._timeline.on('select', this._timelineSelectHandler.bind(this));
        this._timeline.on('rangechanged', this._timelineRangeHandler.bind(this));
        this._timeline.on('click', this._timelineClickHandler.bind(this));
        this._timeline.on('doubleclick', this._timelineClickHandler.bind(this));
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
