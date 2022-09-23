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
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import thumbnailCarouselStyle from '../scss/thumbnail-carousel.scss';
import {
  CameraConfig,
  ExtendedHomeAssistant,
  FrigateBrowseMediaSource,
  ThumbnailsControlConfig,
} from '../types.js';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import { contentsChanged, dispatchFrigateCardEvent } from '../utils/basic.js';
import { isTrueMedia } from '../utils/ha/browse-media';
import { View } from '../view.js';
import { FrigateCardCarousel } from './carousel.js';
import './thumbnail.js';
import './carousel.js';
import { ifDefined } from 'lit/directives/if-defined.js';

export interface ThumbnailCarouselTap {
  slideIndex: number;
  target: FrigateBrowseMediaSource;
  childIndex: number;
}

@customElement('frigate-card-thumbnail-carousel')
export class FrigateCardThumbnailCarousel extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  // Use contentsChanged here to avoid the carousel rebuilding and resetting in
  // front of the user, unless the contents have actually changed.
  @property({ attribute: false, hasChanged: contentsChanged })
  public target?: FrigateBrowseMediaSource | null;

  @property({ attribute: false })
  public cameras?: Map<string, CameraConfig>;

  protected _refCarousel: Ref<FrigateCardCarousel> = createRef();

  // Thumbnail carousels can expand (e.g. drawer-based carousels after the main
  // media loads). The carousel must be re-initialized in these cases, or the
  // dynamic sizing fails (and users can scroll past the end of the carousel).
  protected _resizeObserver: ResizeObserver;

  @property({ attribute: false })
  public config?: ThumbnailsControlConfig;

  @state()
  protected _selected: number | null = null;

  protected _carouselOptions?: EmblaOptionsType;
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

  @property({ attribute: false })
  set selected(selected: number | null) {
    this._selected = selected;
    this.style.setProperty(
      '--frigate-card-carousel-thumbnail-opacity',
      selected === null ? '1.0' : '0.4',
    );
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

    if (!this._carouselOptions) {
      // Want to set the initial carousel options just before the first render
      // in order to get the startIndex correct in the options. It is not safe
      // to rely on carouselScrollTo() post update, since the nested carousel
      // may not yet be actual rendered/created.
      this._carouselOptions = this._getOptions();
    }
  }

  /**
   * The updated lifecycle callback for this element.
   * @param changedProperties The properties that were changed in this render.
   */
  updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (changedProperties.has('_selected')) {
      this.updateComplete.then(() => {
        if (this._selected !== null) {
          this._refCarousel.value?.carouselScrollTo(this._selected);
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
      ?details=${this.config?.show_details}
      ?show_favorite_control=${this.config?.show_favorite_control}
      ?show_timeline_control=${this.config?.show_timeline_control}
      class="${classMap(classes)}"
      @click=${(ev) => {
        if (this._refCarousel.value?.carouselClickAllowed()) {
          dispatchFrigateCardEvent<ThumbnailCarouselTap>(
            this,
            'thumbnail-carousel:tap',
            {
              slideIndex: slideIndex,
              target: parent,
              childIndex: childIndex,
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
