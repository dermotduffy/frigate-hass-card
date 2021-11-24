import {
  CSSResultGroup,
  LitElement,
  TemplateResult,
  html,
  unsafeCSS,
  PropertyValues,
} from 'lit';
import EmblaCarousel, { EmblaCarouselType, EmblaOptionsType } from 'embla-carousel';

import { dispatchFrigateCardEvent } from '../common';

import carouselStyle from '../scss/carousel.scss';

export interface CarouselTap {
  index: number;
}
export interface CarouselSelect {
  index: number;
}

export class FrigateCardCarousel extends LitElement {
  protected _options?: EmblaOptionsType;
  protected _carousel?: EmblaCarouselType;

  /**
   * Scroll to a particular slide.
   * @param index Slide number.
   */
  carouselScrollTo(index: number): void {
    this._carousel?.scrollTo(index);
  }

  /**
   * The updated lifecycle callback for this element.
   * @param changedProperties The properties that were changed in this render.
   */
  updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (!this._carousel) {
      this.updateComplete.then(() => {
        this._loadCarousel();
      });
    }
  }

  /**
   * Get slides to include in the render.
   * @returns The slides to include in the render.
   */
  protected _getSlides(): TemplateResult[] {
    return [];
  }

  /**
   * Load the carousel with "slides".
   */
  protected _loadCarousel(): void {
    const carouselNode = this.renderRoot.querySelector(
      '.embla__viewport',
    ) as HTMLElement;

    if (carouselNode && !this._carousel) {
      this._carousel = EmblaCarousel(carouselNode, this._options);
      this._carousel.on('init', () => dispatchFrigateCardEvent(this, 'carousel:init'));
      this._carousel.on('resize', () =>
        dispatchFrigateCardEvent(this, 'carousel:resize'),
      );
      this._carousel.on('select', () => {
        if (this._carousel) {
          dispatchFrigateCardEvent<CarouselSelect>(this, 'carousel:select', {
            index: this._carousel.selectedScrollSnap(),
          });
        }
      });
    }
  }

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    const slides = this._getSlides();
    if (!slides) {
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
    return unsafeCSS(carouselStyle);
  }
}
