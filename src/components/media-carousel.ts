import { EmblaOptionsType } from 'embla-carousel';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import mediaCarouselStyle from '../scss/media-carousel.scss';
import type {
  MediaLoadedInfo,
  NextPreviousControlConfig,
  TitleControlConfig,
  TransitionEffect,
} from '../types.js';
import { dispatchFrigateCardEvent } from '../utils/basic';
import {
  dispatchExistingMediaLoadedInfoAsEvent,
  isValidMediaLoadedInfo,
} from '../utils/media-info.js';
import { CarouselSelect, EmblaCarouselPlugins, FrigateCardCarousel } from './carousel';
import { AutoMediaType } from './embla-plugins/automedia.js';
import './next-prev-control.js';
import './carousel.js';
import { FrigateCardNextPreviousControl } from './next-prev-control.js';
import { FrigateCardTitleControl } from './title-control.js';
import debounce from 'lodash-es/debounce';
import { Timer } from '../utils/timer';

interface CarouselMediaLoadedInfo {
  slide: number;
  mediaLoadedInfo: MediaLoadedInfo;
}

interface CarouselMediaUnloadedInfo {
  slide: number;
}

/**
 * Dispatch a carousel media loaded event.
 * @param target The target to send it from.
 * @param carouselMediaLoadedInfo The CarouselMediaLoadedInfo.
 */
const dispatchFrigateCardCarouselMediaLoaded = (
  target: EventTarget,
  carouselMediaLoadedInfo: CarouselMediaLoadedInfo,
): void => {
  dispatchFrigateCardEvent<CarouselMediaLoadedInfo>(
    target,
    'carousel:media:loaded',
    carouselMediaLoadedInfo,
  );
};

/**
 * Dispatch a carousel media UNloaded event.
 * @param target The target to send it from.
 * @param carouselMediaUnloadedInfo The CarouselMediaUnloadedInfo.
 */
const dispatchFrigateCardCarouselMediaUnloaded = (
  target: EventTarget,
  carouselMediaUnloadedInfo: CarouselMediaUnloadedInfo,
): void => {
  dispatchFrigateCardEvent<CarouselMediaUnloadedInfo>(
    target,
    'carousel:media:unloaded',
    carouselMediaUnloadedInfo,
  );
};

/**
 * Turn a MediaLoadedInfo into a CarouselMediaLoadedInfo.
 * @param slide The slide number.
 * @param event The MediaShowEvent.
 */
export const wrapMediaLoadedEventForCarousel = (
  slide: number,
  event: CustomEvent<MediaLoadedInfo>,
) => {
  event.stopPropagation();
  dispatchFrigateCardCarouselMediaLoaded(event.composedPath()[0], {
    slide: slide,
    mediaLoadedInfo: event.detail,
  });
};

/**
 * Turn a MediaUnloadedInfo into a CarouselMediaUnloadedInfo.
 * @param slide The slide number.
 * @param event The MediaUnloadedEvent.
 */
export const wrapMediaUnloadedEventForCarousel = (
  slide: number,
  event: CustomEvent<void>,
) => {
  event.stopPropagation();
  dispatchFrigateCardCarouselMediaUnloaded(event.composedPath()[0], {
    slide: slide,
  });
};

@customElement('frigate-card-media-carousel')
export class FrigateCardMediaCarousel extends LitElement {
  @property({ attribute: false })
  public nextPreviousConfig?: NextPreviousControlConfig;

  @property({ attribute: false })
  public carouselOptions?: EmblaOptionsType;

  @property({ attribute: false })
  public carouselPlugins?: EmblaCarouselPlugins;

  @property({ attribute: false, type: Number })
  public selected = 0;

  @property({ attribute: true })
  public transitionEffect?: TransitionEffect;

  @property({ attribute: false })
  public label?: string;

  @property({ attribute: false })
  public logo?: string;

  @property({ attribute: false })
  public titlePopupConfig?: TitleControlConfig;

  // A "map" from slide number to MediaLoadedInfo object.
  protected _mediaLoadedInfo: Record<number, MediaLoadedInfo> = {};
  protected _nextControlRef: Ref<FrigateCardNextPreviousControl> = createRef();
  protected _previousControlRef: Ref<FrigateCardNextPreviousControl> = createRef();
  protected _titleControlRef: Ref<FrigateCardTitleControl> = createRef();
  protected _titleTimer = new Timer();

  protected _boundAutoPlayHandler = this.autoPlay.bind(this);
  protected _boundAutoUnmuteHandler = this.autoUnmute.bind(this);
  protected _boundTitleHandler = this._titleHandler.bind(this);

  // Debounce multiple calls to adapt the container height.
  protected _debouncedAdaptContainerHeightToSlide = debounce(
    this._adaptContainerHeightToSlide.bind(this),
    1 * 100,
    {trailing: true});

  // This carousel may be resized by Lovelace resizes, window resizes,
  // fullscreen, etc. Always call the adaptive height handler when the size
  // changes.
  protected _slideResizeObserver: ResizeObserver;
  protected _intersectionObserver: IntersectionObserver;

  protected _refCarousel: Ref<FrigateCardCarousel> = createRef();

  constructor() {
    super();
    // Need to watch both changes in this element (e.g. caused by a window
    // resize or fullscreen change) and changes in the selected slide itself
    // (e.g. changing from a progress indicator to a loaded media).
    this._slideResizeObserver = new ResizeObserver(
      this._reInitAndAdjustHeight.bind(this),
    );
    this._intersectionObserver = new IntersectionObserver(
      this._intersectionHandler.bind(this),
    );
  }

  /**
   * Get the underlying carousel.
   */
  public frigateCardCarousel(): FrigateCardCarousel | null {
    return this._refCarousel.value ?? null;
  }

  /**
   * Get the AutoMedia plugin (if any).
   * @returns The plugin or `null`.
   */
  protected _getAutoMediaPlugin(): AutoMediaType | null {
    return this.frigateCardCarousel()?.carousel()?.plugins().autoMedia ?? null;
  }

  /**
   * Play the media on the selected slide.
   */
  public autoPlay(): void {
    const automediaOptions = this._getAutoMediaPlugin()?.options;
    if (
      automediaOptions?.autoPlayCondition &&
      ['all', 'selected'].includes(automediaOptions?.autoPlayCondition)
    ) {
      this._getAutoMediaPlugin()?.play();
    }
  }

  /**
   * Pause the media on the selected slide.
   */
  public autoPause(): void {
    const automediaOptions = this._getAutoMediaPlugin()?.options;
    if (
      automediaOptions?.autoPauseCondition &&
      ['all', 'selected'].includes(automediaOptions.autoPauseCondition)
    ) {
      this._getAutoMediaPlugin()?.pause();
    }
  }

  /**
   * Unmute the media on the selected slide.
   */
  public autoUnmute(): void {
    const automediaOptions = this._getAutoMediaPlugin()?.options;
    if (
      automediaOptions?.autoUnmuteCondition &&
      ['all', 'selected'].includes(automediaOptions?.autoUnmuteCondition)
    ) {
      this._getAutoMediaPlugin()?.unmute();
    }
  }

  /**
   * Mute the media on the selected slide.
   */
  public autoMute(): void {
    const automediaOptions = this._getAutoMediaPlugin()?.options;
    if (
      automediaOptions?.autoMuteCondition &&
      ['all', 'selected'].includes(automediaOptions?.autoMuteCondition)
    ) {
      this._getAutoMediaPlugin()?.mute();
    }
  }

  /**
   * Show the media title after the media loads.
   */
  protected _titleHandler(): void {
    const show = () => {
      this._titleTimer.stop();
      this._titleControlRef.value?.show();
    };

    if (this._titleControlRef.value?.isVisible()) {
      // If it's already visible, update it immediately (but also update it
      // after the timer expires to ensure it re-positions if necessary, see
      // comment below).
      show();
    }

    // Allow a brief pause after the media loads, but before the title is
    // displayed. This allows for a pleasant appearance/disappear of the title,
    // and allows for the browser to finish rendering the carousel.
    this._titleTimer.start(0.5, show);
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();

    this.addEventListener('frigate-card:media:loaded', this._boundAutoPlayHandler);
    this.addEventListener('frigate-card:media:loaded', this._boundAutoUnmuteHandler);
    this.addEventListener(
      'frigate-card:media:loaded',
      this._debouncedAdaptContainerHeightToSlide,
    );
    this.addEventListener('frigate-card:media:loaded', this._boundTitleHandler);
    this._intersectionObserver.observe(this);
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    this.removeEventListener('frigate-card:media:loaded', this._boundAutoPlayHandler);
    this.removeEventListener('frigate-card:media:loaded', this._boundAutoUnmuteHandler);
    this.removeEventListener(
      'frigate-card:media:loaded',
      this._debouncedAdaptContainerHeightToSlide,
    );
    this.removeEventListener('frigate-card:media:loaded', this._boundTitleHandler);
    this._intersectionObserver.disconnect();

    this._mediaLoadedInfo = {};
    super.disconnectedCallback();
  }

  /**
   * ReInit the carousel and adapt the container height.
   */
  protected _reInitAndAdjustHeight(): void {
    this.frigateCardCarousel()?.carouselReInitWhenSafe();
    this._debouncedAdaptContainerHeightToSlide();
  }

  /**
   * Called when the carousel intersects with the viewport.
   * @param entries The IntersectionObserverEntry entries (should be only 1).
   */
  protected _intersectionHandler(entries: IntersectionObserverEntry[]): void {
    /**
     * - If the DOM that contains this carousel changes such that it causes
     *   slides to entirely appear/disappear (e.g. `display: none` or hidden),
     *   then the displayed slide sizes will significantly change and the
     *   carousel will need to be reinitialized. Without this, odd bugs may
     *   occur for some users in some circumstances causing the carousel to
     *   appear 'stuck'.
     * - Example bug when this reinitialization is not performed:
     *   https://github.com/dermotduffy/frigate-hass-card/issues/651
     */
    if (entries.some((entry) => entry.isIntersecting)) {
      this._reInitAndAdjustHeight();
    }
  }

  /**
   * Set the the height of the component on media load in case the dimensions
   * have changed. This handler is not triggered from carousel events, as it's
   * actually the media load/show that will change the dimensions, and that is
   * async from carousel actions (e.g. lazy-loaded media).
   *
   * This component does not use the stock Embla auto-height plugin as that
   * resizes the container only on selection rather than media load.
   */
  protected _adaptContainerHeightToSlide(): void {
    const selected = this.frigateCardCarousel()?.getCarouselSelected();
    if (selected) {
      this.style.removeProperty('max-height');
      const height = selected.element.getBoundingClientRect().height;
      if (height !== undefined && height > 0) {
        this.style.maxHeight = `${height}px`;
      }
    }
  }

  /**
   * Fire a media show event when a slide is selected.
   */
  protected _dispatchMediaLoadedInfo(selected: CarouselSelect): void {
    const slideIndex = selected.index;
    if (slideIndex !== undefined && slideIndex in this._mediaLoadedInfo) {
      dispatchExistingMediaLoadedInfoAsEvent(this, this._mediaLoadedInfo[slideIndex]);
    }
  }

  /**
   * Handle a media:loaded event that is generated by a child component, saving the
   * contents for future use when the relevant slide is actually shown.
   * @param slideIndex The relevant slide index.
   * @param event The media:loaded event from the child component.
   */
  protected _storeMediaLoadedInfo(event: CustomEvent<CarouselMediaLoadedInfo>): void {
    // Don't allow the inbound event to propagate upwards, that will be
    // automatically done at the appropriate time as the slide is shown.
    event.stopPropagation();
    const mediaLoadedInfo = event.detail.mediaLoadedInfo;
    const slideIndex = event.detail.slide;

    // isValidMediaLoadedInfo is used to prevent saving media info that will be
    // rejected upstream (empty 1x1 images will be rejected here).
    if (mediaLoadedInfo && isValidMediaLoadedInfo(mediaLoadedInfo)) {
      this._mediaLoadedInfo[slideIndex] = mediaLoadedInfo;
      if (this.frigateCardCarousel()?.getCarouselSelected()?.index === slideIndex) {
        dispatchExistingMediaLoadedInfoAsEvent(this, mediaLoadedInfo);
      }
    }
  }

  /**
   * Remove a media loaded info (i.e. a media item has unloaded).
   * @param event The CarouselMediaUnloadedInfo event.
   */
  protected _removeMediaLoadedInfo(event: CustomEvent<CarouselMediaUnloadedInfo>): void {
    const slideIndex = event.detail.slide;
    delete this._mediaLoadedInfo[slideIndex];

    // If the slide that unloaded is not visible, don't propagate the event upwards.
    if (this.frigateCardCarousel()?.getCarouselSelected()?.index !== slideIndex) {
      event.stopPropagation();
    }
  }

  protected render(): TemplateResult | void {
    const selectSlide = (ev: CustomEvent<CarouselSelect>): void => {
      this._slideResizeObserver.disconnect();
      const parent = this.getRootNode();
      if (parent && parent instanceof ShadowRoot) {
        this._slideResizeObserver.observe(parent.host);
      }

      const selected = ev.detail;
      this._slideResizeObserver.observe(selected.element);

      // Pass up the media-carousel select event first to allow parents to
      // initialize/reset before the media info is dispatched.
      dispatchFrigateCardEvent<CarouselSelect>(
        this,
        'media-carousel:select',
        selected,
      );

      // Dispatch media info.
      this._dispatchMediaLoadedInfo(selected);
    }

    return html` <frigate-card-carousel
        ${ref(this._refCarousel)}
        .selected=${this.selected ?? 0}
        .carouselOptions=${this.carouselOptions}
        .carouselPlugins=${this.carouselPlugins}
        transitionEffect=${ifDefined(this.transitionEffect)}
        @frigate-card:carousel:select=${(ev: CustomEvent<CarouselSelect>) => {
          selectSlide(ev);
        }}
        @frigate-card:carousel:media:loaded=${this._storeMediaLoadedInfo.bind(this)}
        @frigate-card:carousel:media:unloaded=${this._removeMediaLoadedInfo.bind(this)}
      >
        <slot slot="previous" name="previous"></slot>
        <slot></slot>
        <slot slot="next" name="next"></slot>
      </frigate-card-carousel>
      ${this.label && this.titlePopupConfig
        ? html`<frigate-card-title-control
            ${ref(this._titleControlRef)}
            .config=${this.titlePopupConfig}
            .text="${this.label}"
            .logo="${this.logo}"
            .fitInto=${this as HTMLElement}
          >
          </frigate-card-title-control> `
        : ``}`;
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(mediaCarouselStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-media-carousel': FrigateCardMediaCarousel;
  }
}
