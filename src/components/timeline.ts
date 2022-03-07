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
import { Timeline } from 'vis-timeline/esnext';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref';

import { BrowseMediaUtil } from '../browse-media-util';
import { CameraConfig, ExtendedHomeAssistant, FrigateBrowseMediaSource } from '../types';
import { View } from '../view';
import { dispatchFrigateCardEvent } from '../common.js';
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
    return html` <div id="timeline" ${ref(this._timelineRef)}></div>`;
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

  protected _buildEventContent(source: FrigateBrowseMediaSource): string {
    return `
      <frigate-card-timeline-event
        media_id=${source.media_content_id}
        thumbnail="${source.thumbnail}"
        label="${source.title}"
      >
      </frigate-card-timeline-event>`;
  }

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected updated(_changedProperties: PropertyValues): void {
    // Configuration for the Timeline
    const options = {
      minHeight: '300px',
      margin: {
        item: 75 + 10,
        axis: 75 + 10,
      },
      xss: {
        disabled: false,
        filterOptions: {
          whiteList: {
            'frigate-card-timeline-event': ['thumbnail', 'label', 'media_id'],
          },
        },
      },
    };

    // Create a Timeline
    if (this._timelineRef.value && !this._timeline) {
      this._timeline = new Timeline(
        this._timelineRef.value,
        this._buildDataset(),
        options,
      );
    }
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(timelineStyle);
  }
}
