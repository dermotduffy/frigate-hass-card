import format from 'date-fns/format';
import fromUnixTime from 'date-fns/fromUnixTime';
import { CSSResult, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { localize } from '../localize/localize.js';
import thumbnailDetailsStyle from '../scss/thumbnail-details.scss';
import thumbnailFeatureEventStyle from '../scss/thumbnail-feature-event.scss';
import thumbnailFeatureRecordingStyle from '../scss/thumbnail-feature-recording.scss';
import thumbnailStyle from '../scss/thumbnail.scss';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import { errorToConsole, prettifyTitle } from '../utils/basic.js';
import { getCameraTitle } from '../utils/camera.js';
import { retainEvent } from '../utils/frigate.js';
import { getEventDurationString } from '../utils/frigate.js';
import { renderTask } from '../utils/task.js';
import { createFetchThumbnailTask } from '../utils/thumbnail.js';
import { View } from '../view.js';
import { MediaSeek } from './viewer.js';
import { TaskStatus } from '@lit-labs/task';

import type {
  CameraConfig,
  ExtendedHomeAssistant,
  FrigateBrowseMediaSource,
  FrigateEvent,
  FrigateRecording,
} from '../types.js';
// The minimum width of a thumbnail with details enabled.
export const THUMBNAIL_DETAILS_WIDTH_MIN = 300;

@customElement('frigate-card-thumbnail-feature-event')
export class FrigateCardThumbnailFeatureEvent extends LitElement {
  @property({ attribute: false })
  public thumbnail?: string;

  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  protected _embedThumbnailTask = createFetchThumbnailTask(
    this,
    () => this.hass,
    () => this.thumbnail,
    false,
  );

  // Only load thumbnails on view in case there is a very large number of them.
  protected _intersectionObserver: IntersectionObserver;

  constructor() {
    super();
    this._intersectionObserver = new IntersectionObserver(
      this._intersectionHandler.bind(this),
    );
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    this._intersectionObserver.observe(this);
    super.connectedCallback();
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._intersectionObserver.disconnect();
  }

  /**
   * Called when the live view intersects with the viewport.
   * @param entries The IntersectionObserverEntry entries (should be only 1).
   */
  protected _intersectionHandler(entries: IntersectionObserverEntry[]): void {
    if (
      this._embedThumbnailTask.status === TaskStatus.INITIAL &&
      entries.some((entry) => entry.isIntersecting)
    ) {
      this._embedThumbnailTask.run();
    }
  }

  protected render(): TemplateResult | void {
    const imageOff = html`<ha-icon
      icon="mdi:image-off"
      title=${localize('thumbnail.no_thumbnail')}
    ></ha-icon> `;

    return html`${this.thumbnail
      ? renderTask(
          this,
          this._embedThumbnailTask,
          (embeddedThumbnail: string | null) =>
            embeddedThumbnail ? html`<img src="${embeddedThumbnail}" />` : html``,
          { inProgressFunc: () => imageOff },
        )
      : imageOff} `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailFeatureEventStyle);
  }
}

@customElement('frigate-card-thumbnail-feature-recording')
export class FrigateCardThumbnailFeatureRecording extends LitElement {
  @property({ attribute: false })
  public date?: Date;

  @property({ attribute: false })
  public cameraTitle?: string;

  protected render(): TemplateResult | void {
    if (!this.date) {
      return;
    }
    return html`
      <div class="title">${format(this.date, 'HH:mm')}</div>
      <div class="subtitle">${format(this.date, 'MMM do')}</div>
      ${this.cameraTitle ? html`<div class="camera">${this.cameraTitle}</div>` : html``}
    `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailFeatureRecordingStyle);
  }
}

@customElement('frigate-card-thumbnail-details-event')
export class FrigateCardThumbnailDetailsEvent extends LitElement {
  @property({ attribute: false })
  public event?: FrigateEvent;

  @property({ attribute: false })
  public mediaSeek?: MediaSeek;

  protected render(): TemplateResult | void {
    if (!this.event) {
      return;
    }
    const score = (this.event.top_score * 100).toFixed(2) + '%';
    return html`<div class="left">
        <div class="larger">${prettifyTitle(this.event.label)}</div>
        <div>
          <span class="heading">${localize('event.start')}:</span>
          <span>${format(fromUnixTime(this.event.start_time), 'HH:mm:ss')}</span>
        </div>
        <div>
          <span class="heading">${localize('event.duration')}:</span>
          <span>${getEventDurationString(this.event)}</span>
        </div>
        ${this.mediaSeek
          ? html` <div>
              <span class="heading">${localize('event.seek')}</span>
              <span>${format(fromUnixTime(this.mediaSeek.seekTime), 'HH:mm:ss')}</span>
            </div>`
          : html``}
      </div>
      <div class="right">
        <span class="larger">${score}</span>
      </div>`;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailDetailsStyle);
  }
}

@customElement('frigate-card-thumbnail-details-recording')
export class FrigateCardThumbnailDetailsRecording extends LitElement {
  @property({ attribute: false })
  public recording?: FrigateRecording;

  @property({ attribute: false })
  public mediaSeek?: MediaSeek;

  protected render(): TemplateResult | void {
    if (!this.recording) {
      return;
    }
    return html`<div class="left">
        <div class="larger">${prettifyTitle(this.recording.camera) || ''}</div>
        ${this.mediaSeek
          ? html` <div>
              <span class="heading">${localize('recording.seek')}</span>
              <span>${format(fromUnixTime(this.mediaSeek.seekTime), 'HH:mm:ss')}</span>
            </div>`
          : html``}
      </div>
      <div class="right">
        <span class="larger">${this.recording.events}</span>
        <span>${localize('recording.events')}</span>
      </div>`;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailDetailsStyle);
  }
}

@customElement('frigate-card-thumbnail')
export class FrigateCardThumbnail extends LitElement {
  @property({ attribute: true, type: Boolean })
  public details = false;

  @property({ attribute: true, type: Boolean })
  public show_favorite_control = false;

  @property({ attribute: true, type: Boolean })
  public show_timeline_control = false;

  // ======================
  // Target-based interface
  // ======================
  @property({ attribute: false })
  public target?: FrigateBrowseMediaSource | null;

  @property({ attribute: false })
  public childIndex?: number;

  @property({ attribute: false })
  public mediaSeek?: MediaSeek;

  // ===================================================
  // Raw interface (can override target-based interface)
  // ===================================================
  @property({ attribute: true })
  public thumbnail?: string;

  @property({ attribute: true })
  public label?: string;

  @property({ attribute: false })
  public event?: FrigateEvent;

  // ================================
  // Optional parameters for controls
  // ================================
  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    let event: FrigateEvent | null = null;
    let recording: FrigateRecording | null = null;
    let thumbnail: string | null = null;
    let label: string | null = null;

    // Take the event / thumbnail / label from the data-bound media (if specified).
    if (this.target && this.target.children && this.childIndex !== undefined) {
      const media = this.target.children[this.childIndex];
      event = media.frigate?.event ?? null;
      recording = media.frigate?.recording ?? null;
      thumbnail = media.thumbnail;
      label = media.title;
    }

    // Always give the overrides preference (if specified).
    if (this.event) {
      event = this.event;
    }
    thumbnail = this.thumbnail ? this.thumbnail : thumbnail;
    label = this.label ? this.label : label;

    if (!event && !recording) {
      return;
    }

    const starClasses = {
      star: true,
      starred: !!event?.retain_indefinitely,
    };

    const clientID = this.cameraConfig?.frigate.client_id;
    return html` ${event
      ? html`<frigate-card-thumbnail-feature-event
          aria-label="${label ?? ''}"
          title="${label ?? ''}"
          .hass=${this.hass}
          .thumbnail=${thumbnail ?? undefined}
          .label=${label ?? undefined}
        ></frigate-card-thumbnail-feature-event>`
      : recording
      ? html`<frigate-card-thumbnail-feature-recording
          aria-label="${label ?? ''}"
          title="${label ?? ''}"
          .cameraTitle=${this.details || !this.cameraConfig || !this.hass
            ? undefined
            : getCameraTitle(this.hass, this.cameraConfig)}
          .date=${recording ? fromUnixTime(recording.start_time) : undefined}
        ></frigate-card-thumbnail-feature-recording>`
      : html``}
    ${this.show_favorite_control && event && this.hass && clientID
      ? html` <ha-icon
            class="${classMap(starClasses)}"
            icon=${event?.retain_indefinitely ? 'mdi:star' : 'mdi:star-outline'}
            title=${localize('thumbnail.retain_indefinitely')}
            @click=${(ev: Event) => {
              stopEventFromActivatingCardWideActions(ev);
              if (event && this.hass && clientID) {
                retainEvent(this.hass, clientID, event.id, !event.retain_indefinitely)
                  .then(() => {
                    if (event) {
                      event.retain_indefinitely = !event.retain_indefinitely;
                      this.requestUpdate();
                    }
                  })
                  .catch((e) => {
                    errorToConsole(e);
                  });
              }
            }}
          /></ha-icon>`
      : ``}
    ${this.details && event
      ? html`<frigate-card-thumbnail-details-event
          .event=${event ?? undefined}
          .mediaSeek=${this.mediaSeek}
        ></frigate-card-thumbnail-details-event>`
      : this.details && recording
      ? html`<frigate-card-thumbnail-details-recording
          .recording=${recording ?? undefined}
          .mediaSeek=${this.mediaSeek}
        ></frigate-card-thumbnail-details-recording>`
      : html``}
    ${this.show_timeline_control
      ? html`<ha-icon
          class="timeline"
          icon="mdi:target"
          title=${localize('thumbnail.timeline')}
          @click=${(ev: Event) => {
            stopEventFromActivatingCardWideActions(ev);
            if (event) {
              this.view
                ?.evolve({
                  view: 'timeline',
                  target: this.target,
                  childIndex: this.childIndex ?? null,
                })
                .removeContext('timeline')
                .dispatchChangeEvent(this);
            } else if (recording) {
              // Specifically reset the media target/childIndex, as we cannot
              // 'select' an hour in the timeline rather we set the window to
              // matching values.
              this.view
                ?.evolve({
                  view: 'timeline',
                  target: null,
                  childIndex: null,
                })
                .mergeInContext({
                  timeline: {
                    window: {
                      start: fromUnixTime(recording.start_time),
                      end: fromUnixTime(recording.end_time),
                    },
                  },
                })
                .dispatchChangeEvent(this);
            }
          }}
        ></ha-icon>`
      : ''}`;
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResult {
    return unsafeCSS(thumbnailStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-thumbnail': FrigateCardThumbnail;
    'frigate-card-thumbnail-details-recording': FrigateCardThumbnailDetailsRecording;
    'frigate-card-thumbnail-details-event': FrigateCardThumbnailDetailsEvent;
    'frigate-card-thumbnail-feature-recording': FrigateCardThumbnailFeatureRecording;
    'frigate-card-thumbnail-feature-event': FrigateCardThumbnailFeatureEvent;
  }
}
