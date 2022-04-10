import { BrowseMediaUtil } from '../browse-media-util.js';
import { CSSResultGroup, TemplateResult, html, unsafeCSS, PropertyValues } from 'lit';
import { EmblaOptionsType } from 'embla-carousel';
import { classMap } from 'lit/directives/class-map.js';
import { customElement, property, state } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { isEqual } from 'lodash-es';

import type {
  FrigateBrowseMediaSource,
  ThumbnailsControlConfig,
} from '../types.js';
import { FrigateCardCarousel } from './carousel.js';
import { View } from '../view.js';
import {
  contentsChanged,
  dispatchFrigateCardEvent,
  stopEventFromActivatingCardWideActions,
} from '../common.js';

import './thumbnail.js';

import thumbnailCarouselStyle from '../scss/thumbnail-carousel.scss';

export interface ThumbnailCarouselTap {
  slideIndex: number;
  target: FrigateBrowseMediaSource;
  childIndex: number;
}

@customElement('frigate-card-thumbnail-carousel')
export class FrigateCardThumbnailCarousel extends FrigateCardCarousel {
  @property({ attribute: false })
  protected view?: Readonly<View>;

  // Use contentsChanged here to avoid the carousel rebuilding and resetting in
  // front of the user, unless the contents have actually changed.
  @property({ attribute: false, hasChanged: contentsChanged })
  public target?: FrigateBrowseMediaSource | null;

  // Thumbnail carousels can expand (e.g. drawer-based carousels after the main
  // media loads). The carousel must be re-initialized in these cases, or the
  // dynamic sizing fails (and users can scroll past the end of the carousel).
  protected _resizeObserver: ResizeObserver;

  constructor() {
    super();
    this._resizeObserver = new ResizeObserver(this._resizeHandler.bind(this));
  }

  @property({ attribute: false })
  set selected(selected: number | null) {
    this._selected = selected;
    if (selected !== null) {
      // If there is a selection, 'dim' all the other slides.
      this.style.setProperty('--frigate-card-carousel-thumbnail-opacity', '0.4');
    }
  }

  @property({ attribute: false })
  set config(config: ThumbnailsControlConfig) {
    this.direction = ['left', 'right'].includes(config.mode) ? 'vertical' : 'horizontal';
    this._config = config;
  }

  @state()
  protected _config?: ThumbnailsControlConfig;

  @state()
  protected _selected?: number | null;

  /**
   * Handle gallery resize.
   */
  protected _resizeHandler(): void {
    if (this._carousel) {
      this._carousel.reInit();
      // Reinit will cause the scroll position to reset, so re-scroll to the
      // correct location.
      if (this._selected !== undefined && this._selected !== null) {
        this.carouselScrollTo(this._selected);
      }
    }
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    this._resizeObserver.observe(this);
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    this._resizeObserver.disconnect();
    super.disconnectedCallback();
  }

  /**
   * Get the Embla options to use.
   * @returns An EmblaOptionsType object or undefined for no options.
   */
  protected _getOptions(): EmblaOptionsType {
    return {
      containScroll: 'keepSnaps',
      dragFree: true,
      startIndex: this._selected ?? 0,
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

    if (changedProperties.has('_selected')) {
      this.updateComplete.then(() => {
        if (this._carousel) {
          if (this._selected !== undefined && this._selected !== null) {
            this.carouselScrollTo(this._selected);
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
    if (
      !parent.children ||
      !parent.children.length ||
      !BrowseMediaUtil.isTrueMedia(parent.children[childIndex])
    ) {
      return;
    }

    const classes = {
      embla__slide: true,
      'slide-selected': this._selected === childIndex,
    };

    return html` <frigate-card-thumbnail
      .view=${this.view}
      .target=${parent}
      .childIndex=${childIndex}
      ?details=${this._config?.show_details}
      ?controls=${this._config?.show_controls}
      thumbnail_size=${ifDefined(this._config?.size)}
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
