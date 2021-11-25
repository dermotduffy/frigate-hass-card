import { BrowseMediaUtil } from '../browse-media-util.js';
import { CSSResultGroup, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import type { BrowseMediaSource, ThumbnailsControlConfig } from '../types.js';
import { CarouselTap, FrigateCardCarousel } from './carousel.js';
import { actionHandler } from '../action-handler-directive.js';
import { dispatchFrigateCardEvent } from '../common.js';

import thumbnailCarouselStyle from '../scss/thumbnail-carousel.scss';

@customElement('frigate-card-thumbnail-carousel')
export class FrigateCardThumbnailCarousel extends FrigateCardCarousel {
  @property({ attribute: false })
  protected target?: BrowseMediaSource;

  protected _tapSelected?;

  @property({ attribute: false })
  set config(config: ThumbnailsControlConfig) {
    this._config = config;
    if (config) {
      this.style.setProperty('--frigate-card-viewer-thumbnail-size', config.size);
    }
  }
  protected _config?: ThumbnailsControlConfig;

  constructor() {
    super();
    this._options = {
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
      const thumbnail = this._renderThumbnail(this.target.children[i], slides.length);
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
    mediaToRender: BrowseMediaSource,
    slideIndex: number,
  ): TemplateResult | void {
    if (!BrowseMediaUtil.isTrueMedia(mediaToRender) || !mediaToRender.thumbnail) {
      return;
    }

    return html`<div
      class="embla__slide"
      .actionHandler=${actionHandler({
        hasHold: false,
        hasDoubleClick: false,
      })}
      @action=${() => {
        if (this._carousel && this._carousel.clickAllowed()) {
          dispatchFrigateCardEvent<CarouselTap>(this, 'carousel:tap', {
            index: slideIndex,
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
