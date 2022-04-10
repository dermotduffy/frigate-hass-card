import { CSSResult, TemplateResult, html, unsafeCSS, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { format, fromUnixTime } from 'date-fns';

import type { FrigateBrowseMediaSource, FrigateEvent } from '../types.js';
import { View } from '../view.js';
import {
  getEventDurationString,
  prettifyFrigateName,
  stopEventFromActivatingCardWideActions,
} from '../common.js';
import { localize } from '../localize/localize.js';

import thumbnailStyle from '../scss/thumbnail.scss';

@customElement('frigate-card-thumbnail')
export class FrigateCardThumbnail extends LitElement {
  @property({ attribute: true, type: Boolean })
  public details = false;

  @property({ attribute: true, type: Boolean })
  public controls = false;

  @property({ attribute: true })
  set thumbnail_size(size: string) {
    this.style.setProperty('--frigate-card-thumbnail-size', String(size));
  }

  // ============================
  // Data-binding based interface
  // ============================
  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  public target?: FrigateBrowseMediaSource;

  @property({ attribute: false })
  public childIndex?: number;

  // =============================================================
  // Overrides that can be used if data bindings are not available
  // =============================================================
  @property({ attribute: true })
  public thumbnail?: string;

  @property({ attribute: true })
  public label?: string;

  @property({ attribute: true })
  public event?: string;

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    let event: FrigateEvent | null = null;
    let thumbnail: string | null = null;
    let label: string | null = null;

    // Take the event / thumbnail / label from the data-bound media (if specified).
    if (this.target && this.target.children && this.childIndex !== undefined) {
      const media = this.target.children[this.childIndex];
      event = media.frigate?.event ?? null;
      thumbnail = media.thumbnail;
      label = media.title;
    }

    // Always give the overrides preference (if specified).
    if (this.event) {
      event = JSON.parse(this.event);
    }
    thumbnail = this.thumbnail ? this.thumbnail : thumbnail;
    label = this.label ? this.label : label;

    if (!thumbnail) {
      return;
    }

    console.info;

    return html` <img
        aria-label="${label ?? ''}"
        src="${thumbnail}"
        title="${label ?? ''}"
      />
      ${this.controls && event?.retain_indefinitely
        ? html` <ha-icon
            class="favorite"
            icon="mdi:star"
            title=${localize('thumbnail.retain_indefinitely')}
          />`
        : ``}
      ${this.details && event
        ? html` <div class="details">
            <div class="left">
              <div class="larger">${prettifyFrigateName(event.label)}</div>
              <div>
                <span>
                  <span class="heading">${localize('event.start')}:</span>
                  ${format(fromUnixTime(event.start_time), 'HH:mm:ss')}
                </span>
              </div>
              <div>
                <span>
                  <span class="heading">${localize('event.duration')}:</span>
                  ${getEventDurationString(event)}
                </span>
              </div>
            </div>
            <div class="right">
              <div class="larger">${(event.top_score * 100).toFixed(2) + '%'}</div>
            </div>
          </div>`
        : html``}
      ${this.controls
        ? html`<ha-icon
            class="timeline"
            icon="mdi:target"
            title=${localize('thumbnail.timeline')}
            @click=${(ev: Event) => {
              stopEventFromActivatingCardWideActions(ev);
              this.view
                ?.evolve({
                  view: 'timeline',
                  target: this.target,
                  childIndex: this.childIndex ?? null,
                  context: {},
                })
                .dispatchChangeEvent(this);
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
