import { HomeAssistant } from 'custom-card-helpers';
import { EmblaOptionsType, EmblaPluginType } from 'embla-carousel';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { CSSResultGroup, html, PropertyValues, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import thumbnailCarouselStyle from '../scss/thumbnail-carousel.scss';
import type { CameraConfig, FrigateBrowseMediaSource, ThumbnailsControlConfig } from '../types.js';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import { contentsChanged, dispatchFrigateCardEvent } from '../utils/basic.js';
import { isTrueMedia } from '../utils/ha/browse-media';
import { View } from '../view.js';
import { FrigateCardCarousel } from './carousel.js';
import './thumbnail.js';

export interface ThumbnailCarouselTap {
  slideIndex: number;
  target: FrigateBrowseMediaSource;
  childIndex: number;
}

@customElement('frigate-card-thumbnail-carousel')
export class FrigateCardThumbnailCarousel extends FrigateCardCarousel {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  // Use contentsChanged here to avoid the carousel rebuilding and resetting in
  // front of the user, unless the contents have actually changed.
  @property({ attribute: false, hasChanged: contentsChanged })
  public target?: FrigateBrowseMediaSource | null;

  @property({ attribute: false })
  public cameras?: Map<string, CameraConfig>;

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
   * Get the Embla plugins to use.
   * @returns A list of EmblaOptionsTypes.
   */
  protected _getPlugins(): EmblaPluginType[] {
    return [
      ...super._getPlugins(),
      // Only enable wheel plugin if there is more than one camera.
      WheelGesturesPlugin({
        // Whether the carousel is vertical or horizontal, interpret y-axis wheel
        // gestures as scrolling for the carousel.
        forceWheelAxis: 'y',
      }),
    ];
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
   * Called when an update will occur.
   * @param changedProps The changed properties
   */
  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('_config')) {
      if (this._config?.size) {
        this.style.setProperty(
          '--frigate-card-thumbnail-size',
          `${this._config.size}px`,
        );
      }
    }
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
      !isTrueMedia(parent.children[childIndex])
    ) {
      return;
    }

    const classes = {
      embla__slide: true,
      'slide-selected': this._selected === childIndex,
    };

    const cameraConfig = this.view?.camera ? this.cameras?.get(this.view.camera) : null;
    return html` <frigate-card-thumbnail
      .hass=${this.hass}
      .view=${this.view}
      .target=${parent}
      .childIndex=${childIndex}
      .clientID=${cameraConfig?.frigate.client_id}
      ?details=${this._config?.show_details}
      ?controls=${this._config?.show_controls}
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
    if (!slides.length || !this._config || this._config.mode == 'none') {
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

declare global {
	interface HTMLElementTagNameMap {
		"frigate-card-thumbnail-carousel": FrigateCardThumbnailCarousel
	}
}
