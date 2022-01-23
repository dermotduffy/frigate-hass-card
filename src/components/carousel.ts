import { CSSResultGroup, LitElement, unsafeCSS, PropertyValues } from 'lit';
import EmblaCarousel, {
  EmblaCarouselType,
  EmblaOptionsType,
  EmblaPluginType,
} from 'embla-carousel';

import { dispatchFrigateCardEvent } from '../common';

import carouselStyle from '../scss/carousel.scss';

export interface CarouselSelect {
  index: number;
}

export class FrigateCardCarousel extends LitElement {
  protected _carousel?: EmblaCarouselType;
  protected _plugins: Record<string, EmblaPluginType> = {};

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

    if (!this._carousel) {
      this.updateComplete.then(() => {
        // Re-check for the carousel to prevent a double init.
        if (!this._carousel) {
          this._initCarousel();
        }
      });
    }
  }

  /**
   * Get the Embla options to use.
   * @returns An EmblaOptionsType object or undefined for no options.
   */
  protected _getOptions(): EmblaOptionsType | undefined {
    return undefined;
  }

  /**
   * Get the Embla plugins to use.
   * @returns An EmblaOptionsType object or undefined for no options.
   */
  protected _getPlugins(): EmblaPluginType[] | undefined {
    return undefined;
  }

  protected _destroyCarousel(): void {
    if (this._carousel) {
      this._carousel.destroy();
    }
    this._plugins = {};
    this._carousel = undefined;
  }

  /**
   * Initialize the carousel.
   */
  protected _initCarousel(): void {
    const carouselNode = this.renderRoot.querySelector(
      '.embla__viewport',
    ) as HTMLElement;

    if (carouselNode) {
      const plugins = this._getPlugins() ?? [];
      this._plugins = plugins.reduce((acc, cur) => {
        acc[cur.name] = cur;
        return acc;
      }, {});

      this._carousel = EmblaCarousel(carouselNode, this._getOptions(), plugins);
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
