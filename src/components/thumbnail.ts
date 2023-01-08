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
import { errorToConsole, getDurationString, prettifyTitle } from '../utils/basic.js';
import { getCameraTitle } from '../utils/camera.js';
import { renderTask } from '../utils/task.js';
import { createFetchThumbnailTask } from '../utils/thumbnail.js';
import { View } from '../view/view.js';
import type { MediaSeek } from './viewer.js';
import { TaskStatus } from '@lit-labs/task';

import type { CameraConfig, ExtendedHomeAssistant } from '../types.js';
import { EventViewMedia, RecordingViewMedia, ViewMedia } from '../view/media.js';
import { CameraManager } from '../camera/manager.js';
import { ViewMediaClassifier } from '../view/media-classifier.js';

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
  public media?: EventViewMedia;

  @property({ attribute: false })
  public mediaSeek?: MediaSeek;

  protected render(): TemplateResult | void {
    if (!this.media) {
      return;
    }
    const score = this.media.getScore();
    const startTime = this.media.getStartTime();
    const endTime = this.media.getEndTime();
    const what = this.media.getWhat();

    return html` <div class="left">
        ${what ? html`<div class="larger">${prettifyTitle(what.join(', '))}</div>` : ``}
        ${startTime
          ? html` <div>
                <span class="heading">${localize('event.start')}:</span>
                <span>${format(startTime, 'HH:mm:ss')}</span>
              </div>
              <div>
                <span class="heading">${localize('event.duration')}:</span>
                <span
                  >${endTime
                    ? getDurationString(startTime, endTime)
                    : localize('event.in_progress')}</span
                >
              </div>`
          : ``}
        ${this.mediaSeek
          ? html` <div>
              <span class="heading">${localize('event.seek')}</span>
              <span>${format(fromUnixTime(this.mediaSeek.seekTime), 'HH:mm:ss')}</span>
            </div>`
          : html``}
      </div>
      ${score
        ? html`<div class="right">
            <span class="larger">${(score * 100).toFixed(2) + '%'}</span>
          </div>`
        : ``}`;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailDetailsStyle);
  }
}

@customElement('frigate-card-thumbnail-details-recording')
export class FrigateCardThumbnailDetailsRecording extends LitElement {
  @property({ attribute: false })
  public media?: RecordingViewMedia;

  @property({ attribute: false })
  public mediaSeek?: MediaSeek;

  @property({ attribute: false })
  public cameraTitle?: string;

  protected render(): TemplateResult | void {
    if (!this.media) {
      return;
    }
    const eventCount = this.media.getEventCount();
    return html`<div class="left">
        <div class="larger">${this.cameraTitle ?? ''}</div>
        ${this.mediaSeek
          ? html` <div>
              <span class="heading">${localize('recording.seek')}</span>
              <span>${format(fromUnixTime(this.mediaSeek.seekTime), 'HH:mm:ss')}</span>
            </div>`
          : html``}
      </div>
      ${eventCount !== null
        ? html`<div class="right">
            <span class="larger">${eventCount}</span>
            <span>${localize('recording.events')}</span>
          </div>`
        : ``}`;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailDetailsStyle);
  }
}

@customElement('frigate-card-thumbnail')
export class FrigateCardThumbnail extends LitElement {
  // HomeAssistant object may be required for thumbnail signing (for Frigate
  // events).
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  // CameraManager used for marking media as favorite.
  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: true })
  public media?: ViewMedia;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: true, type: Boolean })
  public details = false;

  @property({ attribute: true, type: Boolean })
  public show_favorite_control = false;

  @property({ attribute: true, type: Boolean })
  public show_timeline_control = false;

  @property({ attribute: false })
  public mediaSeek?: MediaSeek;

  @property({ attribute: false })
  public view?: Readonly<View>;

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    if (!this.media || !this.cameraConfig) {
      return;
    }

    const thumbnail = this.media.getThumbnail(this.cameraConfig);
    const title = this.media.getTitle(this.cameraConfig) ?? '';

    const starClasses = {
      star: true,
      starred: !!this.media?.isFavorite(),
    };

    const shouldShowTimelineControl =
      this.show_timeline_control &&
      this.view &&
      (!ViewMediaClassifier.isRecording(this.media) ||
        // Only show timeline control if the recording has a start & end time.
        (this.media.getStartTime() && this.media.getEndTime()));

    const clientID = this.cameraConfig?.frigate.client_id;
    return html` ${ViewMediaClassifier.isEvent(this.media)
      ? html`<frigate-card-thumbnail-feature-event
          aria-label="${title ?? ''}"
          title=${title}
          .hass=${this.hass}
          .thumbnail=${thumbnail ?? undefined}
        ></frigate-card-thumbnail-feature-event>`
      : ViewMediaClassifier.isRecording(this.media)
      ? html`<frigate-card-thumbnail-feature-recording
          aria-label="${title ?? ''}"
          title="${title ?? ''}"
          .cameraTitle=${this.details || !this.cameraConfig || !this.hass
            ? undefined
            : getCameraTitle(this.hass, this.cameraConfig)}
          .date=${this.media.getStartTime() ?? undefined}
        ></frigate-card-thumbnail-feature-recording>`
      : html``}
    ${this.show_favorite_control && this.media && this.hass && clientID
      ? html` <ha-icon
            class="${classMap(starClasses)}"
            icon=${this.media.isFavorite() ? 'mdi:star' : 'mdi:star-outline'}
            title=${localize('thumbnail.retain_indefinitely')}
            @click=${async (ev: Event) => {
              stopEventFromActivatingCardWideActions(ev);
              if (this.hass && this.cameraConfig && this.media) {
                try {
                  await this.cameraManager?.favoriteMedia(
                    this.hass,
                    this.cameraConfig,
                    this.media,
                    !this.media?.isFavorite(),
                  );
                } catch (e) {
                  errorToConsole(e as Error);
                  return;
                }
                this.requestUpdate();
              }
            }}
          /></ha-icon>`
      : ``}
    ${this.details && ViewMediaClassifier.isEvent(this.media)
      ? html`<frigate-card-thumbnail-details-event
          .media=${this.media ?? undefined}
          .mediaSeek=${this.mediaSeek}
        ></frigate-card-thumbnail-details-event>`
      : this.details && ViewMediaClassifier.isRecording(this.media)
      ? html`<frigate-card-thumbnail-details-recording
          .media=${this.media ?? undefined}
          .cameraTitle=${getCameraTitle(this.hass, this.cameraConfig)}
          .mediaSeek=${this.mediaSeek}
        ></frigate-card-thumbnail-details-recording>`
      : html``}
    ${shouldShowTimelineControl
      ? html`<ha-icon
          class="timeline"
          icon="mdi:target"
          title=${localize('thumbnail.timeline')}
          @click=${(ev: Event) => {
            stopEventFromActivatingCardWideActions(ev);
            if (!this.view || !this.media) {
              return;
            }
            if (ViewMediaClassifier.isEvent(this.media)) {
              this.view
                .evolve({
                  view: 'timeline',
                  queryResults: this.view.queryResults
                    ?.clone()
                    .selectResultIfFound((media) => media === this.media),
                })
                .removeContext('timeline')
                .dispatchChangeEvent(this);
            } else if (ViewMediaClassifier.isRecording(this.media)) {
              const startTime = this.media.getStartTime();
              const endTime = this.media.getStartTime();
              if (!startTime || !endTime) {
                return;
              }
              // Specifically reset the media target/childIndex, as we cannot
              // 'select' an hour in the timeline rather we set the window to
              // matching values.
              this.view
                ?.evolve({
                  view: 'timeline',
                  query: null,
                })
                .mergeInContext({
                  timeline: {
                    window: {
                      start: startTime,
                      end: endTime,
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
