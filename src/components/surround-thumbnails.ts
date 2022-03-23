import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { customElement, property } from 'lit/decorators.js';

import {
  ExtendedHomeAssistant,
  FrigateBrowseMediaSource,
  FrigateCardView,
  ThumbnailsControlConfig,
} from '../types.js';
import {
  FrigateCardThumbnailCarousel,
  ThumbnailCarouselTap,
} from './thumbnail-carousel.js';
import { View } from '../view.js';
import { dispatchFrigateCardEvent } from '../common.js';

import './surround.js';

import surroundThumbnailsStyle from '../scss/surround.scss';

interface FrigateCardThumbnailsSet {
  target: FrigateBrowseMediaSource;
  childIndex?: number;
}

@customElement('frigate-card-surround-thumbnails')
export class FrigateCardSurround extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected config?: ThumbnailsControlConfig;

  @property({ attribute: false })
  protected targetView?: FrigateCardView;

  protected _refThumbnails: Ref<FrigateCardThumbnailCarousel> = createRef();

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.view || !this.config) {
      return;
    }

    return html` <frigate-card-surround
      @frigate-card:thumbnails:set=${(ev: CustomEvent<FrigateCardThumbnailsSet>) => {
        if (this._refThumbnails.value) {
          this._refThumbnails.value.target = ev.detail.target;
          this._refThumbnails.value.selected = ev.detail.childIndex ?? undefined;
        }
      }}
      @frigate-card:thumbnails:open=${(ev: CustomEvent) => {
        if (this.config && ['left', 'right'].includes(this.config.mode)) {
          // Protects encapsulation: Catches the request to view thumbnails and
          // re-dispatches a request to open the drawer (if the thumbnails are
          // in a drawer). The new event needs to be dispatched from the origin
          // of the inbound event, so it can be handled by
          // <frigate-card-surround> .
          dispatchFrigateCardEvent(ev.composedPath()[0], 'drawer:open', {
            drawer: this.config.mode,
          });
        }
      }}
    >
      ${this.config?.mode !== 'none'
        ? html` <frigate-card-thumbnail-carousel
            slot=${this.config.mode}
            ${ref(this._refThumbnails)}
            .config=${this.config}
            .highlight_selected=${true}
            @frigate-card:carousel:tap=${(ev: CustomEvent<ThumbnailCarouselTap>) => {
              if (ev.detail.target && ev.detail.childIndex) {
                this.view
                  ?.evolve({
                    ...(this.targetView && { view: this.targetView }),
                    target: ev.detail.target,
                    childIndex: ev.detail.childIndex,
                  })
                  .dispatchChangeEvent(this);
              }
            }}
          >
          </frigate-card-thumbnail-carousel>`
        : ''}
      <slot></slot>
    </frigate-card-surround>`;
  }

  /**
   * Return compiled CSS styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(surroundThumbnailsStyle);
  }
}
