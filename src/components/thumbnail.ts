import { Task, TaskStatus } from '@lit-labs/task';
import { format } from 'date-fns';
import {
  CSSResult,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CameraManager } from '../camera-manager/manager.js';
import { CameraManagerCameraMetadata } from '../camera-manager/types.js';
import { RemoveContextViewModifier } from '../card-controller/view/modifiers/remove-context.js';
import { ViewManagerEpoch } from '../card-controller/view/types.js';
import { localize } from '../localize/localize.js';
import thumbnailDetailsStyle from '../scss/thumbnail-details.scss';
import thumbnailFeatureTextStyle from '../scss/thumbnail-feature-text.scss';
import thumbnailFeatureThumbnailStyle from '../scss/thumbnail-feature-thumbnail.scss';
import thumbnailStyle from '../scss/thumbnail.scss';
import type { ExtendedHomeAssistant } from '../types.js';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import {
  errorToConsole,
  formatDateAndTime,
  getDurationString,
  prettifyTitle,
} from '../utils/basic.js';
import { downloadMedia } from '../utils/download.js';
import { renderTask } from '../utils/task.js';
import { createFetchThumbnailTask, FetchThumbnailTaskArgs } from '../utils/thumbnail.js';
import { ViewMediaClassifier } from '../view/media-classifier.js';
import { EventViewMedia, RecordingViewMedia, ViewMedia } from '../view/media.js';
import { dispatchFrigateCardErrorEvent } from './message.js';

// The minimum width of a thumbnail with details enabled.
export const THUMBNAIL_DETAILS_WIDTH_MIN = 300;

@customElement('frigate-card-thumbnail-feature-thumbnail')
export class FrigateCardThumbnailFeatureThumbnail extends LitElement {
  @property({ attribute: false })
  public thumbnail?: string;

  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @state()
  protected _thumbnailError = false;

  protected _embedThumbnailTask?: Task<FetchThumbnailTaskArgs, string | null>;

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

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('thumbnail')) {
      this._embedThumbnailTask = createFetchThumbnailTask(
        this,
        () => this.hass,
        () => this.thumbnail,
        false,
      );
      // Reset the observer so the initial intersection handler call will set
      // the visibility correctly.
      this._intersectionObserver.unobserve(this);
      this._intersectionObserver.observe(this);
    }
  }

  /**
   * Called when the live view intersects with the viewport.
   * @param entries The IntersectionObserverEntry entries (should be only 1).
   */
  protected _intersectionHandler(entries: IntersectionObserverEntry[]): void {
    if (
      this._embedThumbnailTask?.status === TaskStatus.INITIAL &&
      entries.some((entry) => entry.isIntersecting)
    ) {
      this._embedThumbnailTask?.run();
    }
  }

  protected render(): TemplateResult | void {
    const imageOff = html`<frigate-card-icon
      .icon=${{ icon: 'mdi:image-off' }}
      title=${localize('thumbnail.no_thumbnail')}
    ></frigate-card-icon> `;

    if (!this._embedThumbnailTask || this._thumbnailError) {
      return imageOff;
    }

    return html`${this.thumbnail
      ? renderTask(
          this._embedThumbnailTask,
          (embeddedThumbnail: string | null) =>
            embeddedThumbnail ? html`<img src="${embeddedThumbnail}" />` : html``,
          {
            inProgressFunc: () => imageOff,
            errorFunc: () => {
              this._thumbnailError = true;
            },
          },
        )
      : imageOff} `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailFeatureThumbnailStyle);
  }
}

@customElement('frigate-card-thumbnail-feature-text')
export class FrigateCardThumbnailFeatureText extends LitElement {
  @property({ attribute: false })
  public date?: Date;

  @property({ attribute: false })
  public cameraMetadata?: CameraManagerCameraMetadata;

  @property({ attribute: false })
  public showCameraTitle?: boolean;

  protected render(): TemplateResult | void {
    if (!this.date) {
      return;
    }
    return html`
      ${this.cameraMetadata?.engineIcon
        ? html`<frigate-card-icon
            class="background"
            .icon=${{ icon: this.cameraMetadata.engineIcon }}
          ></frigate-card-icon>`
        : ''}
      <div class="content">
        <div class="title">${format(this.date, 'HH:mm')}</div>
        <div class="subtitle">${format(this.date, 'MMM do')}</div>
        ${this.showCameraTitle && this.cameraMetadata?.title
          ? html`<div class="camera">${this.cameraMetadata.title}</div>`
          : html``}
      </div>
    `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailFeatureTextStyle);
  }
}

@customElement('frigate-card-thumbnail-details-event')
export class FrigateCardThumbnailDetailsEvent extends LitElement {
  @property({ attribute: false })
  public media?: EventViewMedia;

  @property({ attribute: false })
  public seek?: Date;

  @property({ attribute: false })
  public cameraTitle?: string;

  protected render(): TemplateResult | void {
    if (!this.media) {
      return;
    }
    const rawScore = this.media.getScore();
    const score = rawScore ? (rawScore * 100).toFixed(2) + '%' : null;
    const rawStartTime = this.media.getStartTime();
    const startTime = rawStartTime ? formatDateAndTime(rawStartTime) : null;

    const rawEndTime = this.media.getEndTime();
    const duration =
      rawStartTime && rawEndTime ? getDurationString(rawStartTime, rawEndTime) : null;
    const inProgress = this.media.inProgress() ? localize('event.in_progress') : null;

    const what = prettifyTitle(this.media.getWhat()?.join(', ')) ?? null;
    const where = prettifyTitle(this.media.getWhere()?.join(', ')) ?? null;
    const tags = prettifyTitle(this.media.getTags()?.join(', ')) ?? null;
    const whatWithTags =
      what || tags ? (what ?? '') + (what && tags ? ': ' : '') + (tags ?? '') : null;

    const seek = this.seek ? format(this.seek, 'HH:mm:ss') : null;

    return html`
      ${whatWithTags
        ? html` <div class="title">
            <span title=${whatWithTags}>${whatWithTags}</span>
            ${score ? html`<span title="${score}">${score}</span>` : ''}
          </div>`
        : ``}
      <div class="details">
        ${startTime
          ? html` <div>
                <frigate-card-icon
                  title=${localize('event.start')}
                  .icon=${{ icon: 'mdi:calendar-clock-outline' }}
                ></frigate-card-icon>
                <span title="${startTime}">${startTime}</span>
              </div>
              ${duration || inProgress
                ? html` <div>
                    <frigate-card-icon
                      title=${localize('event.duration')}
                      .icon=${{ icon: 'mdi:clock-outline' }}
                    ></frigate-card-icon>
                    ${duration ? html`<span title="${duration}">${duration}</span>` : ''}
                    ${inProgress
                      ? html`<span title="${inProgress}">${inProgress}</span>`
                      : ''}
                  </div>`
                : ''}`
          : ''}
        ${this.cameraTitle
          ? html` <div>
              <frigate-card-icon
                title=${localize('event.camera')}
                .icon=${{ icon: 'mdi:cctv' }}
              ></frigate-card-icon>
              <span title="${this.cameraTitle}">${this.cameraTitle}</span>
            </div>`
          : ''}
        ${where
          ? html` <div>
              <frigate-card-icon
                title=${localize('event.where')}
                .icon=${{ icon: 'mdi:map-marker-outline' }}
              ></frigate-card-icon>
              <span title="${where}">${where}</span>
            </div>`
          : html``}
        ${tags
          ? html` <div>
              <frigate-card-icon
                title=${localize('event.tag')}
                .icon=${{ icon: 'mdi:tag' }}
              ></frigate-card-icon>
              <span title="${tags}">${tags}</span>
            </div>`
          : html``}
        ${seek
          ? html` <div>
              <frigate-card-icon
                title=${localize('event.seek')}
                .icon=${{ icon: 'mdi:clock-fast' }}
              ></frigate-card-icon>
              <span title="${seek}">${seek}</span>
            </div>`
          : html``}
      </div>
    `;
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
  public seek?: Date;

  @property({ attribute: false })
  public cameraTitle?: string;

  protected render(): TemplateResult | void {
    if (!this.media) {
      return;
    }
    const rawStartTime = this.media.getStartTime();
    const startTime = rawStartTime ? formatDateAndTime(rawStartTime) : null;

    const rawEndTime = this.media.getEndTime();
    const duration =
      rawStartTime && rawEndTime ? getDurationString(rawStartTime, rawEndTime) : null;
    const inProgress = this.media.inProgress()
      ? localize('recording.in_progress')
      : null;

    const seek = this.seek ? format(this.seek, 'HH:mm:ss') : null;

    const eventCount = this.media.getEventCount();
    return html`
      ${this.cameraTitle
        ? html` <div class="title">
            <span title="${this.cameraTitle}">${this.cameraTitle}</span>
          </div>`
        : ``}
      <div class="details">
        ${startTime
          ? html` <div>
                <frigate-card-icon
                  title=${localize('recording.start')}
                  .icon=${{ icon: 'mdi:calendar-clock-outline' }}
                ></frigate-card-icon>
                <span title="${startTime}">${startTime}</span>
              </div>
              ${duration || inProgress
                ? html` <div>
                    <frigate-card-icon
                      title=${localize('recording.duration')}
                      .icon=${{ icon: 'mdi:clock-outline' }}
                    ></frigate-card-icon>
                    ${duration ? html`<span title="${duration}">${duration}</span>` : ''}
                    ${inProgress
                      ? html`<span title="${inProgress}">${inProgress}</span>`
                      : ''}
                  </div>`
                : ''}`
          : ''}
        ${seek
          ? html` <div>
              <frigate-card-icon
                title=${localize('event.seek')}
                .icon=${{ icon: 'mdi:clock-fast' }}
              ></frigate-card-icon>
              <span title="${seek}">${seek}</span>
            </div>`
          : html``}
        ${eventCount !== null
          ? html`<div>
              <frigate-card-icon
                title=${localize('recording.events')}
                .icon=${{ icon: 'mdi:shield-alert' }}
              ></frigate-card-icon>
              <span title="${eventCount}">${eventCount}</span>
            </div>`
          : ``}
      </div>
    `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailDetailsStyle);
  }
}

@customElement('frigate-card-thumbnail')
export class FrigateCardThumbnail extends LitElement {
  // Performance: During timeline scrubbing, hass may be updated continuously.
  // As it is not needed for the thumbnail rendering itself, it does not trigger
  // a re-render. The HomeAssistant object may be required for thumbnail signing
  // (after initial signing the thumbnail is stored in a data URL, so the
  // signing will not expire).
  public hass?: ExtendedHomeAssistant;

  // Performance: During timeline scrubbing, the view will be updated
  // continuously. As it is not needed for the thumbnail rendering itself, it
  // does not trigger a re-render.
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public media?: ViewMedia;

  @property({ attribute: true, type: Boolean })
  public details = false;

  @property({ attribute: true, type: Boolean })
  public show_favorite_control = false;

  @property({ attribute: true, type: Boolean })
  public show_timeline_control = false;

  @property({ attribute: true, type: Boolean })
  public show_download_control = false;

  @property({ attribute: false })
  public seek?: Date;

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    if (!this.media || !this.cameraManager || !this.hass) {
      return;
    }

    const thumbnail = this.media.getThumbnail();
    const title = this.media.getTitle() ?? '';

    const starClasses = {
      star: true,
      starred: !!this.media?.isFavorite(),
    };

    const shouldShowTimelineControl =
      this.show_timeline_control &&
      (!ViewMediaClassifier.isRecording(this.media) ||
        // Only show timeline control if the recording has a start & end time.
        (this.media.getStartTime() && this.media.getEndTime()));

    const mediaCapabilities = this.cameraManager?.getMediaCapabilities(this.media);

    const shouldShowFavoriteControl =
      this.show_favorite_control &&
      this.media &&
      this.hass &&
      mediaCapabilities?.canFavorite;

    const shouldShowDownloadControl =
      this.show_download_control &&
      this.hass &&
      this.media.getID() &&
      mediaCapabilities?.canDownload;

    const cameraMetadata = this.cameraManager.getCameraMetadata(
      this.media.getCameraID(),
    );

    return html`
      ${ViewMediaClassifier.isEvent(this.media) && thumbnail
        ? html`<frigate-card-thumbnail-feature-thumbnail
            aria-label="${title ?? ''}"
            title=${title}
            .hass=${this.hass}
            .date=${this.media.getStartTime() ?? undefined}
            .thumbnail=${thumbnail ?? undefined}
          ></frigate-card-thumbnail-feature-thumbnail>`
        : ViewMediaClassifier.isEvent(this.media) ||
            ViewMediaClassifier.isRecording(this.media)
          ? html`<frigate-card-thumbnail-feature-text
              aria-label="${title ?? ''}"
              title="${title ?? ''}"
              .cameraMetadata=${cameraMetadata}
              .showCameraTitle=${!this.details}
              .date=${this.media.getStartTime() ?? undefined}
            ></frigate-card-thumbnail-feature-text>`
          : html``}
      ${shouldShowFavoriteControl
        ? html` <frigate-card-icon
            class="${classMap(starClasses)}"
            title=${localize('thumbnail.retain_indefinitely')}
            .icon=${{ icon: this.media.isFavorite() ? 'mdi:star' : 'mdi:star-outline' }}
            @click=${async (ev: Event) => {
              stopEventFromActivatingCardWideActions(ev);
              if (this.hass && this.media) {
                try {
                  await this.cameraManager?.favoriteMedia(
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
          /></frigate-card-icon>`
        : ``}
      ${this.details && ViewMediaClassifier.isEvent(this.media)
        ? html`<frigate-card-thumbnail-details-event
            .media=${this.media ?? undefined}
            .cameraTitle=${cameraMetadata?.title}
            .seek=${this.seek}
          ></frigate-card-thumbnail-details-event>`
        : this.details && ViewMediaClassifier.isRecording(this.media)
          ? html`<frigate-card-thumbnail-details-recording
              .media=${this.media ?? undefined}
              .cameraTitle=${cameraMetadata?.title}
              .seek=${this.seek}
            ></frigate-card-thumbnail-details-recording>`
          : html``}
      ${shouldShowTimelineControl
        ? html`<frigate-card-icon
            class="timeline"
            .icon=${{ icon: 'mdi:target' }}
            title=${localize('thumbnail.timeline')}
            @click=${(ev: Event) => {
              stopEventFromActivatingCardWideActions(ev);
              if (!this.viewManagerEpoch || !this.media) {
                return;
              }
              this.viewManagerEpoch.manager.setViewByParameters({
                params: {
                  view: 'timeline',
                  queryResults: this.viewManagerEpoch?.manager
                    .getView()
                    ?.queryResults?.clone()
                    .selectResultIfFound((media) => media === this.media),
                },
                modifiers: [new RemoveContextViewModifier(['timeline'])],
              });
            }}
          ></frigate-card-icon>`
        : ''}
      ${shouldShowDownloadControl
        ? html` <frigate-card-icon
            class="download"
            .icon=${{ icon: 'mdi:download' }}
            title=${localize('thumbnail.download')}
            @click=${async (ev: Event) => {
              stopEventFromActivatingCardWideActions(ev);
              if (this.hass && this.cameraManager && this.media) {
                try {
                  await downloadMedia(this.hass, this.cameraManager, this.media);
                } catch (error: unknown) {
                  dispatchFrigateCardErrorEvent(this, error);
                }
              }
            }}
          ></frigate-card-icon>`
        : ``}
    `;
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
    'frigate-card-thumbnail-feature-text': FrigateCardThumbnailFeatureText;
    'frigate-card-thumbnail-feature-thumbnail': FrigateCardThumbnailFeatureThumbnail;
  }
}
