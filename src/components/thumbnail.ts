import { Task } from '@lit-labs/task/task.js';
import { format, fromUnixTime } from 'date-fns';
import { CSSResult, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { localize } from '../localize/localize.js';
import thumbnailDetailsStyle from '../scss/thumbnail-details.scss';
import thumbnailFeatureEventStyle from '../scss/thumbnail-feature-event.scss';
import thumbnailFeatureRecordingStyle from '../scss/thumbnail-feature-recording.scss';
import thumbnailStyle from '../scss/thumbnail.scss';
import type {
  ExtendedHomeAssistant,
  FrigateBrowseMediaSource,
  FrigateEvent,
  FrigateRecording,
} from '../types.js';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import { errorToConsole, prettifyTitle } from '../utils/basic.js';
import { retainEvent } from '../utils/frigate.js';
import { getEventDurationString } from '../utils/ha/browse-media.js';
import { homeAssistantSignPath } from '../utils/ha/index.js';
import { View } from '../view.js';
import { dispatchFrigateCardErrorEvent, renderProgressIndicator } from './message.js';

// The minimum width of a thumbnail with details enabled.
export const THUMBNAIL_DETAILS_WIDTH_MIN = 300;

@customElement('frigate-card-thumbnail-feature-event')
export class FrigateCardThumbnailFeatureEvent extends LitElement {
  @property({ attribute: false })
  public thumbnail?: string;

  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  protected _signThumbnailTask = new Task(
    this,
    this._signThumbnail.bind(this),
    // Do not re-run the task if hass changes, unless it was previously undefined.
    (): [boolean, string | undefined] => [!!this.hass, this.thumbnail],
  );

  /**
   * Sign a thumbnail URL if necessary. May throw.
   * @param param0 A list of lit-task dependencies.
   * @returns A signed URL or null.
   */
  protected async _signThumbnail([haveHASS, thumbnail]: [
    boolean,
    string | undefined,
  ]): Promise<string | null> {
    this.count++;
    if (!haveHASS || !this.hass || !thumbnail) {
      return null;
    }
    if (this.thumbnail?.startsWith('data:')) {
      return this.thumbnail;
    }
    return await homeAssistantSignPath(this.hass, thumbnail);
  }

  protected render(): TemplateResult | void {
    return html`
      ${this.thumbnail
        ? html` ${this._signThumbnailTask.render({
            initial: () => renderProgressIndicator(),
            pending: () => renderProgressIndicator(),
            error: (e: unknown) => {
              errorToConsole(e as Error);
              dispatchFrigateCardErrorEvent(this, e as Error);
            },
            complete: (signedThumbnail: string | null) => {
              return signedThumbnail ? html`<img src="${signedThumbnail}" />` : html``;
            },
          })}`
        : html`<ha-icon
            icon="mdi:image-off"
            title=${localize('thumbnail.no_thumbnail')}
          ></ha-icon> `}
    `;
  }

  static get styles(): CSSResult {
    return unsafeCSS(thumbnailFeatureEventStyle);
  }
}

@customElement('frigate-card-thumbnail-feature-recording')
export class FrigateCardThumbnailFeatureRecording extends LitElement {
  @property({ attribute: false })
  public date?: Date;

  protected render(): TemplateResult | void {
    if (!this.date) {
      return;
    }
    return html`
      <div class="title">${format(this.date, 'HH:mm')}</div>
      <div class="subtitle">${format(this.date, 'MMM do')}</div>
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

  protected render(): TemplateResult | void {
    if (!this.recording) {
      return;
    }
    return html`<div class="left">
        <div class="larger">${prettifyTitle(this.recording.camera) || ''}</div>
        ${this.recording.seek_time
          ? html` <div>
              <span class="heading">${localize('recording.seek')}</span>
              <span>${format(fromUnixTime(this.recording.seek_time), 'HH:mm:ss')}</span>
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
  public clientID?: string;

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

    return html` ${event
      ? html`<frigate-card-thumbnail-feature-event
          aria-label="${label ?? ''}"
          title="${label ?? ''}"
          .hass=${this.hass}
          .thumbnail=${thumbnail ?? undefined}
          .label=${label ?? undefined}
        ></frigate-card-thumbnail-feature-event>`
      : html`<frigate-card-thumbnail-feature-recording
          aria-label="${label ?? ''}"
          title="${label ?? ''}"
          .date=${recording ? fromUnixTime(recording.start_time) : undefined}
        ></frigate-card-thumbnail-feature-recording>`}
    ${this.show_favorite_control && event && this.hass && this.clientID
      ? html` <ha-icon
            class="${classMap(starClasses)}"
            icon=${event?.retain_indefinitely ? 'mdi:star' : 'mdi:star-outline'}
            title=${localize('thumbnail.retain_indefinitely')}
            @click=${(ev: Event) => {
              stopEventFromActivatingCardWideActions(ev);
              if (event && this.hass && this.clientID) {
                retainEvent(
                  this.hass,
                  this.clientID,
                  event.id,
                  !event.retain_indefinitely,
                )
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
        ></frigate-card-thumbnail-details-event>`
      : this.details && recording
      ? html`<frigate-card-thumbnail-details-recording
          .recording=${recording ?? undefined}
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
                  context: {},
                })
                .dispatchChangeEvent(this);
            } else if (recording) {
              this.view
                ?.evolve({
                  view: 'timeline',
                  target: null,
                  childIndex: null,
                  context: {
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
