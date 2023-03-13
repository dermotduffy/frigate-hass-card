import { EmblaOptionsType, EmblaPluginType } from 'embla-carousel';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import thumbnailCarouselStyle from '../scss/thumbnail-carousel.scss';
import { ExtendedHomeAssistant, ThumbnailsControlConfig } from '../types.js';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import { dispatchFrigateCardEvent } from '../utils/basic.js';
import { View } from '../view/view.js';
import { MediaQueriesResults } from '../view/media-queries-results';
import { FrigateCardCarousel } from './carousel.js';
import './thumbnail.js';
import './carousel.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { CameraManager } from '../camera-manager/manager.js';

export interface ThumbnailCarouselTap {
  queryResults: MediaQueriesResults;
}

@customElement('frigate-card-thumbnail-carousel')
export class FrigateCardThumbnailCarousel extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  protected _refCarousel: Ref<FrigateCardCarousel> = createRef();

  // Thumbnail carousels can expand (e.g. drawer-based carousels after the main
  // media loads). The carousel must be re-initialized in these cases, or the
  // dynamic sizing fails (and users can scroll past the end of the carousel).
  protected _resizeObserver: ResizeObserver;

  @property({ attribute: false })
  public config?: ThumbnailsControlConfig;

  @property({ attribute: false })
  public selected? = 0;

  protected _carouselOptions?: EmblaOptionsType = {
    containScroll: 'keepSnaps',
    dragFree: true,
  };

  protected _carouselPlugins: EmblaPluginType[] = [
    WheelGesturesPlugin({
      // Whether the carousel is vertical or horizontal, interpret y-axis wheel
      // gestures as scrolling for the carousel.
      forceWheelAxis: 'y',
    }),
  ];

  constructor() {
    super();
    this._resizeObserver = new ResizeObserver(this._resizeHandler.bind(this));
  }

  /**
   * Handle gallery resize.
   */
  protected _resizeHandler(): void {
    this._refCarousel.value?.carouselReInitWhenSafe();
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
   * Get slides to include in the render.
   * @returns The slides to include in the render.
   */
  protected _getSlides(): TemplateResult[] {
    if (!this.view?.query || !this.view.queryResults?.hasResults()) {
      return [];
    }

    const slides: TemplateResult[] = [];
    for (let i = 0; i < this.view.queryResults.getResultsCount(); ++i) {
      const thumbnail = this._renderThumbnail(i);
      if (thumbnail) {
        slides[i] = thumbnail;
      }
    }
    return slides;
  }

  /**
   * Called when an update will occur.
   * @param changedProps The changed properties
   */
  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('config')) {
      if (this.config?.size) {
        this.style.setProperty('--frigate-card-thumbnail-size', `${this.config.size}px`);
      }
      const direction = this._getDirection();
      if (direction) {
        this.setAttribute('direction', direction);
      } else {
        this.removeAttribute('direction');
      }
    }

    if (changedProps.has('selected')) {
      this.style.setProperty(
        '--frigate-card-carousel-thumbnail-opacity',
        this.selected === undefined ? '1.0' : '0.4',
      );
    }
  }

  /**
   * Render a given thumbnail.
   * @param mediaToRender The media item to render.
   * @returns A template or void if the item could not be rendered.
   */
  protected _renderThumbnail(index: number): TemplateResult | void {
    const media = this.view?.queryResults?.getResult(index) ?? null;
    if (!media || !this.view) {
      return;
    }

    const classes = {
      embla__slide: true,
      'slide-selected': this.selected === index,
    };

    const seekTarget = this.view?.context?.mediaViewer?.seek;
    return html` <frigate-card-thumbnail
      class="${classMap(classes)}"
      .cameraManager=${this.cameraManager}
      .hass=${this.hass}
      .media=${media}
      .view=${this.view}
      .seek=${seekTarget && media.includesTime(seekTarget) ? seekTarget : undefined}
      ?details=${!!this.config?.show_details}
      ?show_favorite_control=${this.config?.show_favorite_control}
      ?show_timeline_control=${this.config?.show_timeline_control}
      ?show_download_control=${this.config?.show_download_control}
      @click=${(ev: Event) => {
        if (this.view && this.view.queryResults) {
          dispatchFrigateCardEvent<ThumbnailCarouselTap>(
            this,
            'thumbnail-carousel:tap',
            {
              queryResults: this.view.queryResults.clone().selectResult(index),
            },
          );
        }
        stopEventFromActivatingCardWideActions(ev);
      }}
    >
    </frigate-card-thumbnail>`;
  }

  /**
   * Get the direction of the thumbnail carousel.
   * @returns `vertical`, `horizontal` or undefined.
   */
  protected _getDirection(): 'horizontal' | 'vertical' | undefined {
    if (this.config?.mode === 'left' || this.config?.mode === 'right') {
      return 'vertical';
    } else if (this.config?.mode === 'above' || this.config?.mode === 'below') {
      return 'horizontal';
    }
    return undefined;
  }

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    const slides = this._getSlides();
    if (!slides.length || !this.config || this.config.mode === 'none') {
      return;
    }

    return html`<frigate-card-carousel
      ${ref(this._refCarousel)}
      direction=${ifDefined(this._getDirection())}
      .selected=${this.selected ?? 0}
      .carouselOptions=${this._carouselOptions}
      .carouselPlugins=${this._carouselPlugins}
    >
      ${slides}
    </frigate-card-carousel>`;
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(thumbnailCarouselStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-thumbnail-carousel': FrigateCardThumbnailCarousel;
  }
}
