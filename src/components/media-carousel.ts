// TODO: Use the auto-height plugin instead of adaptive height

import { EmblaOptionsType } from 'embla-carousel';
import { EmblaPluginsType } from 'embla-carousel/components/Plugins';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import mediaCarouselStyle from '../scss/media-carousel.scss';
import type {
  AutoMuteCondition,
  AutoPauseCondition,
  AutoPlayCondition,
  AutoUnmuteCondition,
  MediaShowInfo,
  NextPreviousControlConfig,
  TitleControlConfig,
  TransitionEffect,
} from '../types.js';
import { dispatchFrigateCardEvent } from '../utils/basic';
import {
  createMediaShowInfo,
  dispatchExistingMediaShowInfoAsEvent,
  isValidMediaShowInfo,
} from '../utils/media-info.js';
import { EmblaCarouselPlugins, FrigateCardCarousel } from './carousel';
import { AutoMediaType } from './embla-plugins/automedia.js';
import './next-prev-control.js';
import './carousel.js';
import { FrigateCardNextPreviousControl } from './next-prev-control.js';
import { FrigateCardTitleControl } from './title-control.js';

const getEmptyImageSrc = (width: number, height: number) =>
  `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"%3E%3C/svg%3E`;
export const IMG_EMPTY = getEmptyImageSrc(16, 9);

export interface CarouselMediaShowInfo {
  slide: number;
  mediaShowInfo: MediaShowInfo;
}

/**
 * Dispatch a carousel media show event.
 * @param target The target to send it from.
 * @param carouselMediaShowInfo The CarouselMediaShowInfo.
 */
const dispatchFrigateCardCarouselMediaShow = (
  target: EventTarget,
  carouselMediaShowInfo: CarouselMediaShowInfo,
): void => {
  dispatchFrigateCardEvent<CarouselMediaShowInfo>(
    target,
    'carousel:media-show',
    carouselMediaShowInfo,
  );
};

/**
 * Turn a MediaShowEvent into a CarouselMediaShowInfo.
 * @param slide The slide number.
 * @param event The MediaShowEvent.
 */
export const wrapMediaShowEventForCarousel = (
  slide: number,
  event: CustomEvent<MediaShowInfo>,
) => {
  event.stopPropagation();
  dispatchFrigateCardCarouselMediaShow(event.composedPath()[0], {
    slide: slide,
    mediaShowInfo: event.detail,
  });
};

/**
 * Turn a (stock) media load event into a CarouselMediaShowInfo.
 * @param slide The slide number.
 * @param event The MediaShowEvent.
 */
export const wrapMediaLoadEventForCarousel = (slide: number, event: Event) => {
  const mediaShowInfo = createMediaShowInfo(event);
  if (mediaShowInfo) {
    dispatchFrigateCardCarouselMediaShow(event.composedPath()[0], {
      slide: slide,
      mediaShowInfo: mediaShowInfo,
    });
  }
};

@customElement('frigate-card-media-carousel')
export class FrigateCardMediaCarousel extends LitElement {
  @property({ attribute: false })
  public nextPreviousConfig?: NextPreviousControlConfig;

  @property({ attribute: false })
  public carouselOptions?: EmblaOptionsType;

  @property({ attribute: false })
  public carouselPlugins?: EmblaCarouselPlugins;

  @property({ attribute: true })
  public transitionEffect?: TransitionEffect;

  @property({ attribute: false })
  public label?: string;

  @property({ attribute: false })
  public titlePopupConfig?: TitleControlConfig;

  @property({ attribute: false })
  public autoPlayCondition?: AutoPlayCondition;

  @property({ attribute: false })
  public autoUnmuteCondition?: AutoUnmuteCondition;

  @property({ attribute: false })
  public autoPauseCondition?: AutoPauseCondition;

  @property({ attribute: false })
  public autoMuteCondition?: AutoMuteCondition;

  // A "map" from slide number to MediaShowInfo object.
  protected _mediaShowInfo: Record<number, MediaShowInfo> = {};
  protected _nextControlRef: Ref<FrigateCardNextPreviousControl> = createRef();
  protected _previousControlRef: Ref<FrigateCardNextPreviousControl> = createRef();
  protected _titleControlRef: Ref<FrigateCardTitleControl> = createRef();
  protected _titleTimerID: number | null = null;

  protected _boundAutoPlayHandler = this.autoPlay.bind(this);
  protected _boundAutoPauseHandler = this.autoPause.bind(this);
  protected _boundAutoMuteHandler = this.autoMute.bind(this);
  protected _boundAutoUnmuteHandler = this.autoUnmute.bind(this);

  // This carousel may be resized by Lovelace resizes, window resizes,
  // fullscreen, etc. Always call the adaptive height handler when the size
  // changes.
  protected _resizeObserver: ResizeObserver;
  protected _intersectionObserver: IntersectionObserver;

  protected _refCarousel: Ref<FrigateCardCarousel> = createRef();

  constructor() {
    super();
    this._resizeObserver = new ResizeObserver(this._adaptiveHeightHandler.bind(this));
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
    if (this.autoPlayCondition && ['all', 'selected'].includes(this.autoPlayCondition)) {
      this._getAutoMediaPlugin()?.play();
    }
  }

  /**
   * Pause the media on the selected slide.
   */
  public autoPause(): void {
    if (
      this.autoPauseCondition &&
      ['all', 'selected'].includes(this.autoPauseCondition)
    ) {
      this._getAutoMediaPlugin()?.pause();
    }
  }

  /**
   * Unmute the media on the selected slide.
   */
  public autoUnmute(): void {
    if (
      this.autoUnmuteCondition &&
      ['all', 'selected'].includes(this.autoUnmuteCondition)
    ) {
      this._getAutoMediaPlugin()?.unmute();
    }
  }

  /**
   * Mute the media on the selected slide.
   */
  public autoMute(): void {
    if (this.autoMuteCondition && ['all', 'selected'].includes(this.autoMuteCondition)) {
      this._getAutoMediaPlugin()?.mute();
    }
  }

  /**
   * Show the media title after the media loads.
   */
  protected _titleHandler(): void {
    const show = () => {
      this._titleTimerID = null;
      this._titleControlRef.value?.show();
    };

    if (this._titleTimerID) {
      window.clearTimeout(this._titleTimerID);
    }
    if (this._titleControlRef.value?.isVisible()) {
      // If it's already visible, update it immediately (but also update it
      // after the timer expires to ensure it re-positions if necessary, see
      // comment below).
      show();
    }

    // Allow a brief pause after the media loads, but before the title is
    // displayed. This allows for a pleasant appearance/disappear of the title,
    // and allows for the browser to finish rendering the carousel.
    this._titleTimerID = window.setTimeout(show, 0.5 * 1000);
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('frigate-card:media-show', this.autoPlay);
    this.addEventListener('frigate-card:media-show', this.autoUnmute);
    this.addEventListener('frigate-card:media-show', this._adaptiveHeightHandler);
    this.addEventListener('frigate-card:media-show', this._titleHandler);
    this._resizeObserver.observe(this);
    this._intersectionObserver.observe(this);
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('frigate-card:media-show', this.autoPlay);
    this.removeEventListener('frigate-card:media-show', this.autoUnmute);
    this.removeEventListener('frigate-card:media-show', this._adaptiveHeightHandler);
    this.removeEventListener('frigate-card:media-show', this._titleHandler);
    this._resizeObserver.disconnect();
    this._intersectionObserver.disconnect();
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

    const reInit = (): void => {
      this.frigateCardCarousel()?.carouselReInit();
    };

    if (entries.some((entry) => entry.isIntersecting)) {
      // For performance, run the reinit in idle cycles if the browser supports
      // it, but only give it 400ms before running as it may otherwise be
      // noticeable to the user.
      if (window.requestIdleCallback !== undefined) {
        window.requestIdleCallback(reInit, { timeout: 400 });
      } else {
        reInit();
      }
    }
  }

  /**
   * Set the the height of the component on media load in case the dimensions
   * have changed. This handler is not triggered from carousel events, as it's
   * actually the media load/show that will change the dimensions, and that is
   * async from carousel actions (e.g. lazy-loaded media).
   */
  protected _adaptiveHeightHandler(): void {
    const adaptCarouselHeight = (): void => {
      const slide = this.frigateCardCarousel()?.carouselSelected();
      if (slide !== undefined) {
        this.style.removeProperty('max-height');
        const currentSlide = this.frigateCardCarousel()?.carouselSelectedElement();
        const height = currentSlide?.getBoundingClientRect().height;
        if (height !== undefined && height > 0) {
          this.style.maxHeight = `${height}px`;
        }
      }
    };

    // Hack: This method attempts to measure the height of the selected slide in
    // order to set the overall carousel height to match. This method is
    // triggered from `frigate-card:media-show` events, which are usually in
    // turn triggered from media/metadata load events from media players.
    // Sufficient time needs to be allowed after these metadata load events to
    // allow the browser to repaint the element heights, so that we can get the
    // right values here. requestAnimationFrame() works well for this.
    window.requestAnimationFrame(adaptCarouselHeight);
  }

  /**
   * Fire a media show event when a slide is selected.
   */
  protected _dispatchMediaShowInfo(): void {
    const slideIndex = this.frigateCardCarousel()?.carouselSelected();
    if (slideIndex !== undefined && slideIndex in this._mediaShowInfo) {
      dispatchExistingMediaShowInfoAsEvent(this, this._mediaShowInfo[slideIndex]);
    }
  }

  /**
   * Handle a media-show event that is generated by a child component, saving the
   * contents for future use when the relevant slide is actually shown.
   * @param slideIndex The relevant slide index.
   * @param event The media-show event from the child component.
   */
  protected _storeMediaShowInfo(event: CustomEvent<CarouselMediaShowInfo>): void {
    // Don't allow the inbound event to propagate upwards, that will be
    // automatically done at the appropriate time as the slide is shown.
    event.stopPropagation();
    const mediaShowInfo = event.detail.mediaShowInfo;
    const slideIndex = event.detail.slide;

    // isValidMediaShowInfo is used to prevent saving media info that will be
    // rejected upstream (empty 1x1 images will be rejected here).
    if (mediaShowInfo && isValidMediaShowInfo(mediaShowInfo)) {
      this._mediaShowInfo[slideIndex] = mediaShowInfo;
      if (this.frigateCardCarousel()?.carouselSelected() === slideIndex) {
        dispatchExistingMediaShowInfoAsEvent(this, mediaShowInfo);
      }
    }
  }

  protected render(): TemplateResult | void {
    return html` <frigate-card-carousel
        ${ref(this._refCarousel)}
        .carouselOptions=${this.carouselOptions}
        .carouselPlugins=${this.carouselPlugins}
        transitionEffect=${ifDefined(this.transitionEffect)}
        @frigate-card:carousel:init=${this._dispatchMediaShowInfo.bind(this)}
        @frigate-card:carousel:select=${this._dispatchMediaShowInfo.bind(this)}
        @frigate-card:carousel:media-show=${this._storeMediaShowInfo.bind(this)}
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
