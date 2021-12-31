import { BrowseMediaUtil } from '../browse-media-util.js';
import { CSSResultGroup, TemplateResult, html, unsafeCSS } from 'lit';
import { EmblaOptionsType } from 'embla-carousel';
import { customElement, property } from 'lit/decorators.js';

import type { BrowseMediaSource, ThumbnailsControlConfig } from '../types.js';
import { FrigateCardCarousel } from './carousel.js';
import { dispatchFrigateCardEvent } from '../common.js';

import thumbnailCarouselStyle from '../scss/thumbnail-carousel.scss';

export interface ThumbnailCarouselTap {
  slideIndex: number;
  target: BrowseMediaSource;
  childIndex: number;
}

@customElement('frigate-card-thumbnail-carousel')
export class FrigateCardThumbnailCarousel extends FrigateCardCarousel {
  @property({ attribute: false })
  protected target?: BrowseMediaSource;

  protected _tapSelected?;

  @property({ attribute: false })
  set config(config: ThumbnailsControlConfig | undefined) {
    if (config) {
      if (config && (config.size !== undefined && config.size !== null)) {
        this.style.setProperty('--frigate-card-carousel-thumbnail-size', config.size);
      }
      this._config = config;
    }
  }
  protected _config?: ThumbnailsControlConfig;

  @property({ attribute: false })
  set highlightSelected(value: boolean) {
    this.style.setProperty('--frigate-card-carousel-thumbnail-opacity', value ? '0.6' : '1.0');
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
   * Scroll to a particular slide.
   * @param index Slide number.
   */
  carouselScrollTo(index: number): void {
    if (!this._carousel) {
      return;
    }

    if (this._tapSelected !== undefined) {
      this._carousel.slideNodes()[this._tapSelected].classList.remove('slide-selected');
    }

    super.carouselScrollTo(index);

    this._carousel.slideNodes()[index].classList.add('slide-selected');
    this._tapSelected = index;
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
      const thumbnail = this._renderThumbnail(
        this.target,
        i,
        slides.length);
      if (thumbnail) {
        slides.push(thumbnail);
      }
    }
    return slides;
  }

  /**
   * Render a given thumbnail.
   * @param mediaToRender The media item to render.
   * @returns A template or void if the item could not be rendered.
   */
  protected _renderThumbnail(
    parent: BrowseMediaSource,
    childIndex: number,
    slideIndex: number,
  ): TemplateResult | void {
    if (!parent.children || !parent.children.length) {
      return;
    }

    const mediaToRender = parent.children[childIndex];
    if (!BrowseMediaUtil.isTrueMedia(mediaToRender) || !mediaToRender.thumbnail) {
      return;
    }

    return html`<div
      class="embla__slide"
      @click=${() => {
        if (this._carousel && this._carousel.clickAllowed()) {
          dispatchFrigateCardEvent<ThumbnailCarouselTap>(this, 'carousel:tap', {
            slideIndex: slideIndex,
            target: parent,
            childIndex: childIndex,
          });
        }
      }}
    >
      <img src="${mediaToRender.thumbnail}" title="${mediaToRender.title}" />
    </div>`;
  }

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    const slides = this._getSlides();
    if (!slides || !this._config || this._config.mode == 'none') {
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
