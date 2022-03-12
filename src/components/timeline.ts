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
import { Timeline, TimelineOptions, TimelineOptionsCluster } from 'vis-timeline/esnext';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref';

import { BrowseMediaUtil } from '../browse-media-util';
import {
  CameraConfig,
  ExtendedHomeAssistant,
  FrigateBrowseMediaSource,
  TimelineConfig,
  frigateCardConfigDefaults,
} from '../types';
import { View } from '../view';
import { contentsChanged, dispatchFrigateCardEvent } from '../common.js';
import { renderProgressIndicator } from './message';

import timelineStyle from '../scss/timeline.scss';
import timelineEventStyle from '../scss/timeline-event.scss';

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

@customElement('frigate-card-timeline')
export class FrigateCardTimeline extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected cameraConfig?: CameraConfig;

  /**
   * Set the Home Assistant object.
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
  protected _boundTimelineSelectHandler = this._timelineSelectHandler.bind(this);

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.view || !this.cameraConfig) {
      return;
    }

    if (!this.view.target) {
      const browseMediaQueryParameters =
        BrowseMediaUtil.getBrowseMediaQueryParametersOrDispatchError(
          this,
          this.view,
          this.cameraConfig,
        );
      if (!browseMediaQueryParameters) {
        return;
      }

      BrowseMediaUtil.fetchLatestMediaAndDispatchViewChange(
        this,
        this.hass,
        this.view,
        browseMediaQueryParameters,
      );
      return renderProgressIndicator();
    }
    return html` <div class="timeline" ${ref(this._timelineRef)}></div>`;
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener(
      'frigate-card:timeline-select',
      this._boundTimelineSelectHandler,
    );
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    document.removeEventListener(
      'frigate-card:timeline-select',
      this._boundTimelineSelectHandler,
    );
    super.disconnectedCallback();
  }

  /**
   * Called when an item on the timeline is selected.
   * @param ev The click event.
   */
  protected _timelineSelectHandler(ev: Event): void {
    const id = (ev as CustomEvent<string>).detail;
    const index =
      this.view?.target?.children?.findIndex((item) => item.media_content_id == id) ??
      -1;
    if (index >= 0) {
      this.view
        ?.evolve({
          view: 'clip',
          childIndex: index,
        })
        .dispatchChangeEvent(this);
    }
  }

  /**
   * Build the content of a single event on the timeline.
   * @param source The FrigateBrowseMediaSource object for this event.
   * @returns A string to include on the timeline.
   */
  protected _buildEventContent(source: FrigateBrowseMediaSource): string {
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
   * Build the visjs dataset to render on the timeline.
   * @returns The dataset.
   */
  protected _buildDataset(): DataSet<FrigateCardTimelineData> {
    const items: FrigateCardTimelineData[] = [];

    this.view?.target?.children?.forEach((child) => {
      if (child.frigate) {
        const item = {
          id: child.media_content_id,
          content: this._buildEventContent(child),
          start: child.frigate.event.start_time * 1000,
          selectable: false,
        };
        if (child.frigate.event.end_time) {
          //item['end'] = child.frigate.event.end_time * 1000;
        }
        items.push(item);
      }
    });
    return new DataSet(items);
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
    const gap = 5;

    // Configuration for the Timeline, see:
    // https://visjs.github.io/vis-timeline/docs/timeline/#Configuration_Options
    this._timelineOptions = {
      cluster: thumbnailConfig.clustering_threshold > 0
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
        : false as TimelineOptionsCluster,
      minHeight: '100%',
      maxHeight: '100%',
      margin: {
        item: thumbnailConfig.size_pixels - thumbnailConfig.overlap_pixels + gap,
        axis: thumbnailConfig.size_pixels + gap,
      },
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
          },
        },
      },
    };
  }

  /**
   * Called when the component is updated.
   * @param changedProps The changed properties if any.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (this._timelineRef.value) {
      if (this._timeline) {
        this._timeline.destroy();
      }
      this._timeline = new Timeline(
        this._timelineRef.value,
        this._buildDataset(),
        this._timelineOptions,
      );
    }
  }

  /**
   * Return compiled CSS styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(timelineStyle);
  }
}
