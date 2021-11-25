import { BrowseMediaUtil } from '../browse-media-util.js';
import { CSSResultGroup, TemplateResult, html, unsafeCSS, LitElement } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { until } from 'lit/directives/until';

import type { BrowseMediaQueryParameters, BrowseMediaSource, ExtendedHomeAssistant, ThumbnailsControlConfig } from '../types.js';
import { FrigateCardCarousel } from './carousel.js';
import { HomeAssistant } from 'custom-card-helpers';
import { actionHandler } from '../action-handler-directive.js';
import { dispatchErrorMessageEvent, dispatchFrigateCardEvent } from '../common.js';
import { renderProgressIndicator } from './message.js';

import thumbnailCarouselStyle from '../scss/thumbnail-carousel.scss';

export interface ThumbnailCarouselTap {
  slideIndex: number;
  target: BrowseMediaSource;
  childIndex: number;
}

@customElement('frigate-card-thumbnail-carousel')
export class FrigateCardThumbnailCarousel extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected browseMediaQueryParameters?: BrowseMediaQueryParameters;

  @property({ attribute: false })
  protected config?: ThumbnailsControlConfig;

  @property({ attribute: false })
  protected highlightSelected = true;

  /**
   * Master render method.
   * @returns A rendered template.
   */
   protected render(): TemplateResult | void {
    return html`${until(this._render(), renderProgressIndicator())}`;
  }

  /**
   * Asyncronously render the element.
   * @returns A rendered template.
   */
   protected async _render(): Promise<TemplateResult | void> {
    if (!this.hass || !this.browseMediaQueryParameters) {
      return html``;
    }

    let parent: BrowseMediaSource | null = null;
    try {
      parent = await BrowseMediaUtil.browseMediaQuery(
        this.hass,
        this.browseMediaQueryParameters,
      );
    } catch (e) {
      return dispatchErrorMessageEvent(this, (e as Error).message);
    }
    return html` <frigate-card-thumbnail-carousel-core
      .target=${parent}
      .config=${this.config}
      .highlightSelected=${this.highlightSelected}
    >
    </frigate-card-thumbnail-carousel-core>`;
  }

  /**
   * Get element styles.
   */
  // static get styles(): CSSResultGroup {
  //   return unsafeCSS(viewerStyle);
  // }
}

@customElement('frigate-card-thumbnail-carousel-core')
export class FrigateCardThumbnailCarouselCore extends FrigateCardCarousel {
  @property({ attribute: false })
  protected target?: BrowseMediaSource;

  protected _tapSelected?;

  @property({ attribute: false })
  set config(config: ThumbnailsControlConfig | undefined) {
    if (config) {
      if (config && (config.size !== undefined && config.size != null)) {
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
      .actionHandler=${actionHandler({
        hasHold: false,
        hasDoubleClick: false,
      })}
      @action=${() => {
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
