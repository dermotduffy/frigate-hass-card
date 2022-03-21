import { CSSResult, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { format, fromUnixTime } from 'date-fns';

import type { FrigateBrowseMediaSource } from '../types.js';
import { FrigateCardCarousel } from './carousel.js';
import { getEventDurationString, prettifyFrigateName } from '../common.js';
import { localize } from '../localize/localize.js';

import thumbnailStyle from '../scss/thumbnail.scss';

@customElement('frigate-card-thumbnail')
export class FrigateCardThumbnail extends FrigateCardCarousel {
  @property({ attribute: false })
  public media?: FrigateBrowseMediaSource;

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
    if (!this.media || !this.media.thumbnail) {
      return;
    }
    const event = this.media.frigate?.event;
    return html`
      <img
        aria-label="${this.media.title}"
        src="${this.media.thumbnail}"
        title="${this.media.title}"
      />
      ${event?.retain_indefinitely
        ? html` <ha-icon
            class="favorite"
            icon="mdi:star"
            title=${localize('event.retain_indefinitely')}
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
    `;
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResult {
    return unsafeCSS(thumbnailStyle);
  }
}
