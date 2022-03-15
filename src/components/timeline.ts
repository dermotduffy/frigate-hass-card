import {
  CSSResultGroup,
  LitElement,
  TemplateResult,
  html,
  unsafeCSS,
  PropertyValues,
} from 'lit';
import { DataSet } from 'vis-data/esnext';
import { HomeAssistant } from 'custom-card-helpers';
import {
  DataGroupCollectionType,
  Timeline,
  TimelineOptions,
  TimelineOptionsCluster,
} from 'vis-timeline/esnext';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';

import { BrowseMediaUtil } from '../browse-media-util';
import {
  CameraConfig,
  ExtendedHomeAssistant,
  FrigateBrowseMediaSource,
  TimelineConfig,
  frigateCardConfigDefaults,
} from '../types';
import { View } from '../view';
import {
  contentsChanged,
  dispatchErrorMessageEvent,
  dispatchFrigateCardEvent,
  getCameraTitle,
} from '../common.js';

import timelineStyle from '../scss/timeline.scss';
import timelineEventStyle from '../scss/timeline-event.scss';

interface FrigateCardGroupData {
  id: string;
  content: string;
}
interface FrigateCardTimelineData {
  id: string;
  content: string;
  start: number;
}

@customElement('frigate-card-timeline-event')
export class FrigateCardTimelineEvent extends LitElement {
  @property({ attribute: true })
  protected media_id?: string;

  @property({ attribute: true })
  protected thumbnail?: string;

  @property({ attribute: true })
  protected label?: string;

  @property({ attribute: true, type: Number })
  protected thumbnail_size?: number;

  /**
   * Ensure there is a cached value before an update.
   * @param _changedProps The changed properties
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected willUpdate(_changedProps: PropertyValues): void {
    if (this.thumbnail_size !== undefined) {
      this.style.setProperty(
        '--frigate-card-timeline-thumbnail-size',
        `${this.thumbnail_size}px`,
      );
    }
  }

  protected render(): TemplateResult | void {
    if (!this.thumbnail) {
      return;
    }

    return html`<img
      @click=${() => {
        // The view is not accessible from here, since this element is created
        // from a string (see _buildEventContent below), so instead we emit an
        // intermediate event that is caught by the timeline.
        dispatchFrigateCardEvent(this, 'timeline-select', this.media_id);
      }}
      src="${this.thumbnail}"
      title="${this.label || ''}"
      aria-label="${this.label || ''}"
    />`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(timelineEventStyle);
  }
}

class TimelineEventManager {
  protected _dataset = new DataSet<FrigateCardTimelineData>();

  protected _contentCallback?: (FrigateBrowseMediaSource) => string;
  protected _tooltipCallback?: (FrigateBrowseMediaSource) => string;

  constructor(params: {
    contentCallback?: (source: FrigateBrowseMediaSource) => string;
    tooltipCallback?: (source: FrigateBrowseMediaSource) => string;
  }) {
    this._contentCallback = params.contentCallback;
    this._tooltipCallback = params.tooltipCallback;
  }

  get dataset(): DataSet<FrigateCardTimelineData> {
    return this._dataset;
  }

  public isEmpty(): boolean {
    return this._dataset.length === 0;
  }

  public clear(): void {
    this._dataset.clear();
  }

  protected _addMediaSource(camera: string, target: FrigateBrowseMediaSource): void {
    const items: FrigateCardTimelineData[] = [];
    target.children?.forEach((child) => {
      if (child.frigate) {
        const item = {
          id: child.media_content_id,
          group: camera,
          content: this._contentCallback?.(child) ?? '',
          title: this._tooltipCallback?.(child) ?? '',
          start: child.frigate.event.start_time * 1000,
        };
        if (child.frigate.event.end_time) {
          item['end'] = child.frigate.event.end_time * 1000;
          item['type'] = 'range';
        } else {
          item['type'] = 'point';
        }
        items.push(item);
      }
    });
    this._dataset.update(items);
  }

  public async fetchEvents(
    node: HTMLElement,
    hass: HomeAssistant & ExtendedHomeAssistant,
    cameras: Map<string, CameraConfig>,
    start: Date,
    end: Date,
  ): Promise<void> {
    console.info(`fetchEvents: ${start} -> ${end}`);

    // const output = new Map<string, FrigateBrowseMediaSource>();
    const fetchCameraEvents = async (camera: string): Promise<void> => {
      const cameraConfig = cameras.get(camera);
      if (!cameraConfig) {
        return;
      }
      const browseMediaQueryParameters = BrowseMediaUtil.getBrowseMediaQueryParameters(
        'clips',
        cameraConfig,
      );
      if (!browseMediaQueryParameters) {
        return;
      }

      try {
        this._addMediaSource(
          camera,
          await BrowseMediaUtil.browseMediaQuery(hass, {
            ...browseMediaQueryParameters,
            unlimited: true,
          }),
        );
      } catch (e) {
        return dispatchErrorMessageEvent(node, (e as Error).message);
      }
    };

    await Promise.all(Array.from(cameras.keys()).map(fetchCameraEvents.bind(this)));
  }
}

@customElement('frigate-card-timeline')
export class FrigateCardTimeline extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected cameras?: Map<string, CameraConfig>;

  /**
   * Set the timeline configuration.
   */
  set timelineConfig(timelineConfig: TimelineConfig) {
    this._timelineConfig = timelineConfig;
    this._setOptions();
  }

  @state()
  protected _timelineConfig?: TimelineConfig;

  @state({ hasChanged: contentsChanged })
  protected _timelineOptions?: TimelineOptions;

  protected _timelineRef: Ref<HTMLElement> = createRef();
  protected _timeline?: Timeline;

  protected _events = new TimelineEventManager({
    tooltipCallback: this._generateTooltip.bind(this),
  });

  /**
   * Build the content of a single event on the timeline.
   * @param source The FrigateBrowseMediaSource object for this event.
   * @returns A string to include on the timeline.
   */
  protected _generateTooltip(source: FrigateBrowseMediaSource): string {
    return `
      <frigate-card-timeline-event
        media_id=${source.media_content_id}
        thumbnail="${source.thumbnail}"
        label="${source.title}"
        thumbnail_size="${
          this._timelineConfig?.controls.thumbnails.size_pixels ??
          frigateCardConfigDefaults.timeline.controls.thumbnails.size_pixels
        }"
      >
      </frigate-card-timeline-event>`;
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.view) {
      return;
    }
    return html` <div class="timeline" ${ref(this._timelineRef)}></div>`;
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    super.disconnectedCallback();
  }

  protected _timelineRangeHandler(properties: {
    start: Date;
    end: Date;
    byUser: boolean;
    event: Event;
  }): void {
    console.info(
      `Range changed: ${properties.start} -> ${properties.end} [${this._events.dataset.length}]`,
    );
    if (this.hass && this.cameras) {
      // This is not performant in that it refetches all events in the time
      // range, when some/all may already be fetched. A more optimal approach
      // would be to only fetch events in time windows that haven't already been
      // fetched PLUS events that did not previously have an end_time. That's
      // not trivial to implement, and it's not yet clear it's worth the extra
      // complexity.
      this._events.fetchEvents(
        this,
        this.hass,
        this.cameras,
        properties.start,
        properties.end,
      );
    }
  }

  /**
   * Called when an object on the timeline is selected.
   * @param data The data about the selection.
   * @returns
   */
  protected _timelineSelectHandler(data: { items: string[]; event: Event }): void {
    if (data.items.length <= 0) {
      return;
    }

    // TODO: Make a parent, attach a select bunch of children to it and evolve the view.
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
   * Handle timeline resize.
   */
  protected _setOptions(): void {
    if (!this._timelineConfig) {
      return;
    }

    const thumbnailConfig =
      this._timelineConfig?.controls.thumbnails ??
      frigateCardConfigDefaults.timeline.controls.thumbnails;

    // Configuration for the Timeline, see:
    // https://visjs.github.io/vis-timeline/docs/timeline/#Configuration_Options
    this._timelineOptions = {
      cluster:
        thumbnailConfig.clustering_threshold > 0
          ? {
              showStipes: true,
              // It would be better to automatically calculate `maxItems` from the
              // rendered height of the timeline (or group within the timeline) so
              // as to not waste vertical space (e.g. after the user changes to
              // fullscreen mode). Unfortunately this is not easy to do, as we
              // don't know the height of the timeline until after it renders --
              // and if we adjust `maxItems` then we can get into an infinite
              // resize loop. Adjusting the `maxItems` of a timeline, after it's
              // created, also does not appear to work as expected.
              maxItems: thumbnailConfig.clustering_threshold,
            }
          : (false as TimelineOptionsCluster),
      minHeight: '100%',
      maxHeight: '100%',
      tooltip: {
        followMouse: true,
        overflowMethod: 'cap',
      },
      zoomMax: 31 * 24 * 60 * 60 * 1000,
      zoomMin: 1 * 1000,
      start: this._getYesterday(),
      end: this._getToday(),
      groupHeightMode: 'fixed',
      xss: {
        disabled: false,
        filterOptions: {
          whiteList: {
            'frigate-card-timeline-event': [
              'thumbnail',
              'label',
              'media_id',
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
   * Get today date object.
   * @returns A date object for today.
   */
  protected _getToday(): Date {
    return new Date();
  }

  /**
   * Get yesterday date object.
   * @returns A date object for yesterday.
   */
  protected _getYesterday(): Date {
    const yesterday = new Date();
    yesterday.setDate(this._getToday().getDate() - 1);
    return yesterday;
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
   * Called on the first update.
   * @param changedProps The changed properties.
   */
  protected firstUpdated(changedProps: PropertyValues): void {
    super.firstUpdated(changedProps);

    if (changedProps.has('cameras')) {
      this._events.clear();
    }

    if (this._events.isEmpty() && this.hass && this.cameras) {
      // Fetch an initial 1-day worth of events.
      this._events.fetchEvents(
        this,
        this.hass,
        this.cameras,
        this._getToday(),
        this._getYesterday(),
      );
    }
  }

  /**
   * Called when the component is updated.
   * @param changedProps The changed properties if any.
   */
  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (this._timelineRef.value) {
      if (this._timeline) {
        this._timeline.destroy();
        this._timeline = undefined;
      }

      this._timeline = new Timeline(
        this._timelineRef.value,
        this._events.dataset,
        this._getGroups(),
        this._timelineOptions,
      );
      this._timeline.on('select', this._timelineSelectHandler.bind(this));
      this._timeline.on('rangechanged', this._timelineRangeHandler.bind(this));
    }
  }

  /**
   * Return compiled CSS styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(timelineStyle);
  }
}
