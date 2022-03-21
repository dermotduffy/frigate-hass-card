import { BrowseMediaUtil } from '../browse-media-util.js';
import { CSSResultGroup, TemplateResult, html, unsafeCSS, PropertyValues } from 'lit';
import { EmblaOptionsType } from 'embla-carousel';
import { classMap } from 'lit/directives/class-map.js';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import type { FrigateBrowseMediaSource, ThumbnailsControlConfig } from '../types.js';
import { FrigateCardCarousel } from './carousel.js';
import {
  contentsChanged,
  dispatchFrigateCardEvent,
  stopEventFromActivatingCardWideActions,
} from '../common.js';

import "./thumbnail.js";

import thumbnailCarouselStyle from '../scss/thumbnail-carousel.scss';

export interface ThumbnailCarouselTap {
  slideIndex: number;
  target: FrigateBrowseMediaSource;
  childIndex: number;
}

@customElement('frigate-card-thumbnail-carousel')
export class FrigateCardThumbnailCarousel extends FrigateCardCarousel {
  @property({ attribute: false, hasChanged: contentsChanged })
  public target?: FrigateBrowseMediaSource;

  @property({ attribute: false, reflect: true })
  public selected?: number | null;

  @property({ attribute: false })
  public config?: ThumbnailsControlConfig;

  @property({ attribute: false })
  set highlight_selected(value: boolean) {
    this.style.setProperty(
      '--frigate-card-carousel-thumbnail-opacity',
      value ? '0.6' : '1.0',
    );
  }

  /**
   * Get the Embla options to use.
   * @returns An EmblaOptionsType object or undefined for no options.
   */
  protected _getOptions(): EmblaOptionsType {
    return {
      containScroll: 'keepSnaps',
      dragFree: true,
    };
  }

  /**
   * Get slides to include in the render.
   * @returns The slides to include in the render.
   */
  protected _getSlides(): TemplateResult[] {
    if (!this.target || !this.target.children || !this.target.children.length) {
      return [];
    }

    const slides: TemplateResult[] = [];
    for (let i = 0; i < this.target.children.length; ++i) {
      const thumbnail = this._renderThumbnail(this.target, i, slides.length);
      if (thumbnail) {
        slides.push(thumbnail);
      }
    }
    return slides;
  }

  /**
   * The updated lifecycle callback for this element.
   * @param changedProperties The properties that were changed in this render.
   */
  updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('target')) {
      this._destroyCarousel();
    }
    super.updated(changedProperties);

    if (changedProperties.has('selected')) {
      this.updateComplete.then(() => {
        if (this._carousel) {
          if (this.selected !== undefined && this.selected !== null) {
            this.carouselScrollTo(this.selected);
          }
        }
      });
    }
  }

  /**
   * Render a given thumbnail.
   * @param mediaToRender The media item to render.
   * @returns A template or void if the item could not be rendered.
   */
  protected _renderThumbnail(
    parent: FrigateBrowseMediaSource,
    childIndex: number,
    slideIndex: number,
  ): TemplateResult | void {
    if (!parent.children || !parent.children.length) {
      return;
    }

    const mediaToRender = parent.children[childIndex];
    if (!BrowseMediaUtil.isTrueMedia(mediaToRender)) {
      return;
    }

    const classes = {
      embla__slide: true,
      'slide-selected': this.selected == childIndex,
    };

    return html`
      <frigate-card-thumbnail
        .media=${mediaToRender}
        ?details=${this.config?.show_details}
        thumbnail_size=${ifDefined(this.config?.size)}
        class="${classMap(classes)}"
        @click=${(ev) => {
          if (this._carousel && this._carousel.clickAllowed()) {
            dispatchFrigateCardEvent<ThumbnailCarouselTap>(this, 'carousel:tap', {
              slideIndex: slideIndex,
              target: parent,
              childIndex: childIndex,
            });
          }
          stopEventFromActivatingCardWideActions(ev);
        }}
      >
      </frigate-card-thumbnail>`;
  }

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    const slides = this._getSlides();
    if (!slides || !this.config || this.config.mode == 'none') {
      return;
    }

    return html` <div class="embla">
      <div class="embla__viewport">
        <div class="embla__container">${slides}</div>
      </div>
    </div>`;
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResultGroup {
    return [super.styles, unsafeCSS(thumbnailCarouselStyle)];
  }
}
