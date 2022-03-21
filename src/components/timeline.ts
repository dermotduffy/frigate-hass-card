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
import { classMap } from 'lit/directives/class-map.js';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';

import { BrowseMediaUtil } from '../browse-media-util';
import {
  CameraConfig,
  ExtendedHomeAssistant,
  FrigateBrowseMediaSource,
  ThumbnailsControlConfig,
  MEDIA_CLASS_PLAYLIST,
  MEDIA_TYPE_VIDEO,
  MEDIA_CLASS_VIDEO,
  TimelineConfig,
  frigateCardConfigDefaults,
} from '../types';
import { FrigateCardDrawer } from './drawer';
import {
  FrigateCardThumbnailCarousel,
  ThumbnailCarouselTap,
} from './thumbnail-carousel';
import { View } from '../view';
import {
  contentsChanged,
  dispatchErrorMessageEvent,
  getCameraTitle,
} from '../common.js';

import timelineStyle from '../scss/timeline.scss';

import './drawer.js';

interface FrigateCardGroupData {
  id: string;
  content: string;
}
interface FrigateCardTimelineData {
  id: string;
  content: string;
  start: number;
  end?: number;
  source: FrigateBrowseMediaSource;
}

class TimelineEventManager {
  protected _dataset = new DataSet<FrigateCardTimelineData>();

  protected _contentCallback?: (FrigateBrowseMediaSource) => string;

  constructor(params?: {
    contentCallback?: (source: FrigateBrowseMediaSource) => string;
  }) {
    this._contentCallback = params?.contentCallback;
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
          start: child.frigate.event.start_time * 1000,
          source: child,
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

  protected _drawerRef: Ref<FrigateCardDrawer> = createRef();
  protected _timelineRef: Ref<HTMLElement> = createRef();
  protected _thumbnailsRef: Ref<FrigateCardThumbnailCarousel> = createRef();
  protected _timeline?: Timeline;

  protected _events = new TimelineEventManager()

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.view) {
      return;
    }

    const config: ThumbnailsControlConfig = {
      mode: 'above',
      show_details: true,
    };

    // TODO move to configuration later.
    const drawerLocation: "left" | "right" = "left" as const;

    const timelineClasses = {
      "timeline": true,
      "left-margin": drawerLocation == "left",
      //"right-margin": drawerLocation == "right",
    }

    return html` <frigate-card-drawer location="${drawerLocation}" ${ref(this._drawerRef)}>
        <frigate-card-thumbnail-carousel
          ${ref(this._thumbnailsRef)}
          direction="vertical"
          .config=${config}
          .highlight_selected=${true}
          @frigate-card:carousel:tap=${(ev: CustomEvent<ThumbnailCarouselTap>) => {
            if (ev.detail.target && ev.detail.childIndex) {
              this.view
                ?.evolve({
                  target: ev.detail.target,
                  childIndex: ev.detail.childIndex,
                  view: 'clip',
                })
                .dispatchChangeEvent(this);
            }
          }}
        >
        </frigate-card-thumbnail-carousel>
      </frigate-card-drawer>
      <div class="${classMap(timelineClasses)}" ${ref(this._timelineRef)}></div>`;
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
      ).then(() => {
        this._updateThumbnails();
      })
    }
  }

  /**
   * Called when an object on the timeline is selected.
   * @param data The data about the selection.
   * @returns
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _timelineSelectHandler(_data: { items: string[]; event: Event }): void {
    this._updateThumbnails();
    if (this._drawerRef.value) {
      this._drawerRef.value.open = true;
    }
  }

  protected _updateThumbnails(): void {
    if (!this._timeline) {
      return;
    }

    const selected = this._timeline?.getSelection();

    const timelineWindow = this._timeline.getWindow();
    const start = timelineWindow.start.getTime();
    const end = timelineWindow.end.getTime();

    const children: FrigateBrowseMediaSource[] = [];
    let childIndex: number | null = null;

    // Fetch all the events that match the extent of the visible window (cannot
    // use getVisibleItems() since it does not return clustered items).
    this._events.dataset
      .get({
        filter: (item) =>
          // Start within the window.
          (item.start >= start && item.start <= end) ||
          // End within the window.
          (!!item.end && item.end >= start && item.end <= end) ||
          // Item lifetime extends past the window
          (item.start <= start && !!item.end && item.end >= end),
        order: 'start',
      })
      .forEach((item) => {
        if (item.source.can_play) {
          if (childIndex === null && selected.includes(item.id)) {
            childIndex = children.length;
          }
          children.push(item.source);
        }
      });

    if (!children.length) {
      return;
    }

    const target = {
      title: `Timeline ${start} - ${end}`,
      media_class: MEDIA_CLASS_PLAYLIST,
      media_content_type: MEDIA_TYPE_VIDEO,
      media_content_id: '',
      can_play: false,
      can_expand: true,
      children_media_class: MEDIA_CLASS_VIDEO,
      thumbnail: null,
      children: children,
    };

    if (this._drawerRef.value) {
      if (this._thumbnailsRef.value) {
        this._thumbnailsRef.value.target = target;
        this._thumbnailsRef.value.selected = childIndex ?? undefined;
      }
    }
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
              fitOnDoubleClick: true,
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
      selectable: true,
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
