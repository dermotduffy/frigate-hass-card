import { CSSResult, TemplateResult, html, unsafeCSS, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { format, fromUnixTime } from 'date-fns';

import type { FrigateBrowseMediaSource } from '../types.js';
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
  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  public target?: FrigateBrowseMediaSource;

  @property({ attribute: false })
  public childIndex?: number;

  @property({ attribute: true, type: Boolean, reflect: true })
  public details = false;

  @property({ attribute: false })
  set thumbnail_size(size: number) {
    this.style.setProperty('--frigate-card-thumbnail-size', String(size));
  }

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    if (!this.target || !this.target.children || this.childIndex === undefined) {
      return;
    }
    const media = this.target.children[this.childIndex];
    if (!media.thumbnail) {
      return;
    }

    const event = media.frigate?.event;
    return html` <img
        aria-label="${media.title}"
        src="${media.thumbnail}"
        title="${media.title}"
      />
      ${event?.retain_indefinitely
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
      <ha-icon
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
      ></ha-icon>`;
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResult {
    return unsafeCSS(thumbnailStyle);
  }
}
