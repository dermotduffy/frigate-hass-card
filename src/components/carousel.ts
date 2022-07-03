import EmblaCarousel, {
  EmblaCarouselType,
  EmblaOptionsType,
  EmblaPluginType
} from 'embla-carousel';
import { CSSResultGroup, LitElement, PropertyValues, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';
import carouselStyle from '../scss/carousel.scss';
import { TransitionEffect } from '../types';
import { dispatchFrigateCardEvent } from '../utils/basic.js';

export interface CarouselSelect {
  index: number;
}

export class FrigateCardCarousel extends LitElement {
  @property({ attribute: true, reflect: true })
  public direction: 'vertical' | 'horizontal' = 'horizontal';

  protected _carousel?: EmblaCarouselType;

  /**
   * Scroll to a particular slide.
   * @param index Slide number.
   */
  carouselScrollTo(index: number): void {
    this._carousel?.scrollTo(index, this._getTransitionEffect() === 'none');
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
   * Get the transition effect to use.
   * @returns An TransitionEffect object.
   */
  protected _getTransitionEffect(): TransitionEffect | undefined {
    return 'slide';
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
   * @returns A list of EmblaOptionsTypes.
   */
  protected _getPlugins(): EmblaPluginType[] {
    return [];
  }

  protected _destroyCarousel(): void {
    if (this._carousel) {
      this._carousel.destroy();
    }
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
      this._carousel = EmblaCarousel(
        carouselNode,
        {
          axis: this.direction == 'horizontal' ? 'x' : 'y',
          ...this._getOptions(),
        },
        this._getPlugins() ?? [],
      );
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
