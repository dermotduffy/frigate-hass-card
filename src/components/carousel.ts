import { CSSResultGroup, LitElement, unsafeCSS, PropertyValues } from 'lit';
import EmblaCarousel, { EmblaCarouselType, EmblaOptionsType } from 'embla-carousel';

import { dispatchFrigateCardEvent } from '../common';

import carouselStyle from '../scss/carousel.scss';

export interface CarouselSelect {
  index: number;
}

export class FrigateCardCarousel extends LitElement {
  protected _carousel?: EmblaCarouselType;

  /**
   * Scroll to a particular slide.
   * @param index Slide number.
   */
  carouselScrollTo(index: number): void {
    this._carousel?.scrollTo(index);
  }

  /**
   * Get the selected slide.
   * @returns The slide index or undefined if the carousel is not loaded.
   */
  carouselSelected(): number | undefined {
    return this._carousel?.selectedScrollSnap();
  }

  /**
   * The updated lifecycle callback for this element.
   * @param changedProperties The properties that were changed in this render.
   */
  updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (this._shouldInitCarousel(changedProperties)) {
      this.updateComplete.then(() => {
        this._initCarousel();
      });
    }
  }

  /**
   * Whether or not the carousel should be (re-)initialized when the given
   * properties change.
   * @param changedProperties The properties that triggered the (re-)render.
   * @returns 
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _shouldInitCarousel(_: PropertyValues): boolean {
    return true;
  }

  /**
   * Get the Embla options to use.
   * @returns An EmblaOptionsType object or undefined for no options.
   */
  protected _getOptions(): EmblaOptionsType | undefined {
    return undefined;
  }

  /**
   * Load the carousel with "slides".
   */
  protected _initCarousel(): void {
    const carouselNode = this.renderRoot.querySelector(
      '.embla__viewport',
    ) as HTMLElement;

    if (carouselNode) {
      if (this._carousel) {
        this._carousel.destroy();
      }
      this._carousel = EmblaCarousel(carouselNode, this._getOptions());
      this._carousel.on('init', () => dispatchFrigateCardEvent(this, 'carousel:init'));
      this._carousel.on('select', () => {
        const selected = this.carouselSelected();
        if (selected !== undefined) {
          dispatchFrigateCardEvent<CarouselSelect>(this, 'carousel:select', {
            index: selected,
          });
        }
      });
    }
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(carouselStyle);
  }
}
