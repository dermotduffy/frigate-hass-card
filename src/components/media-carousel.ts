import { EmblaCarouselType } from 'embla-carousel';
import { CSSResultGroup, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { createRef, Ref } from 'lit/directives/ref.js';
import mediaCarouselStyle from '../scss/media-carousel.scss';
import type { MediaShowInfo } from '../types.js';
import {
  dispatchExistingMediaShowInfoAsEvent,
  isValidMediaShowInfo
} from '../utils/media-info.js';
import { FrigateCardCarousel } from './carousel.js';
import { AutoMediaPluginType } from './embla-plugins/automedia.js';
import './next-prev-control.js';
import { FrigateCardNextPreviousControl } from './next-prev-control.js';
import { FrigateCardTitleControl } from './title-control.js';

const getEmptyImageSrc = (width: number, height: number) =>
  `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"%3E%3C/svg%3E`;
export const IMG_EMPTY = getEmptyImageSrc(16, 9);

@customElement('frigate-card-media-carousel')
export class FrigateCardMediaCarousel extends FrigateCardCarousel {
  // A "map" from slide number to MediaShowInfo object.
  protected _mediaShowInfo: Record<number, MediaShowInfo> = {};
  protected _nextControlRef: Ref<FrigateCardNextPreviousControl> = createRef();
  protected _previousControlRef: Ref<FrigateCardNextPreviousControl> = createRef();
  protected _titleControlRef: Ref<FrigateCardTitleControl> = createRef();
  protected _titleTimerID: number | null = null;
  protected _needReInit = false;

  // This carousel may be resized by Lovelace resizes, window resizes,
  // fullscreen, etc. Always call the adaptive height handler when the size
  // changes.
  protected _resizeObserver: ResizeObserver;
  protected _intersectionObserver: IntersectionObserver;

  constructor() {
    super();
    this._resizeObserver = new ResizeObserver(this._adaptiveHeightHandler.bind(this));
    this._intersectionObserver = new IntersectionObserver(
      this._intersectionHandler.bind(this),
    );
  }

  /**
   * Play the media on the selected slide. May be overridden to control when
   * autoplay should happen.
   */
  protected _autoPlayHandler(): void {
    (this._plugins['AutoMediaPlugin'] as AutoMediaPluginType | undefined)?.play();
  }

  /**
   * Unmute the media on the selected slide. May be overridden to control when
   * autoplay should happen.
   */
  protected _autoUnmuteHandler(): void {
    (this._plugins['AutoMediaPlugin'] as AutoMediaPluginType | undefined)?.unmute();
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
    // and allows for the browser to finish rendering the carousel (inc.
    // adaptive height which has `0.5s ease`, see `media-carousel.scss`).
    this._titleTimerID = window.setTimeout(show, 0.5 * 1000);
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('frigate-card:media-show', this._autoPlayHandler);
    this.addEventListener('frigate-card:media-show', this._autoUnmuteHandler);
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
    this.removeEventListener('frigate-card:media-show', this._autoPlayHandler);
    this.removeEventListener('frigate-card:media-show', this._autoUnmuteHandler);
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

    const reinit = (): void => {
      this._carousel?.reInit();
    };

    if (entries.some((entry) => entry.isIntersecting)) {
      // For performance, run the reinit in idle cycles if the browser supports
      // it, but only give it 400ms before running as it may otherwise be
      // noticeable to the user.
      if (window.requestIdleCallback !== undefined) {
        window.requestIdleCallback(reinit, { timeout: 400 });
      } else {
        reinit();
      }
    }
  }

  protected _destroyCarousel(): void {
    super._destroyCarousel();

    // Notes on instance variables:
    // * this._mediaShowInfo: This is set when the media in the DOM loads. If a
    //   new View included the same media, the DOM would not change and so the
    //   prior contents would still be valid and would not re-appear (as the
    //   media would not reload) -- as such, leave this alone on carousel
    //   destroy. New media in that slide will replace the prior contents on
    //   load.
  }

  /**
   * Initialize the carousel.
   */
  protected _initCarousel(): void {
    super._initCarousel();

    // Necessary because typescript local type narrowing is not paying attention
    // to the side-effect of the call to super._initCarousel().
    const carousel = this._carousel as EmblaCarouselType | undefined;

    // Update the view object as the carousel is moved.
    carousel?.on('select', this._selectSlideSetViewHandler.bind(this));

    // Update the next/previous controls as the carousel is moved.
    carousel?.on('select', this._selectSlideNextPreviousHandler.bind(this));

    // Dispatch MediaShow events as the carousel is moved.
    carousel?.on('init', this._selectSlideMediaShowHandler.bind(this));
    carousel?.on('select', this._selectSlideMediaShowHandler.bind(this));
  }

  /**
   * Set the the height of the container on media load in case the dimensions
   * have changed. This handler is not triggered from carousel events, as it's
   * actually the media load/show that will change the dimensions, and that is
   * async from carousel actions (e.g. lazy-loaded media).
   */
  protected _adaptiveHeightHandler(): void {
    const adaptCarouselHeight = (): void => {
      if (!this._carousel) {
        return;
      }
      const slide = this._carousel?.selectedScrollSnap();
      if (slide !== undefined) {
        this._carousel.containerNode().style.removeProperty('max-height');
        const slides = this._carousel.slideNodes();
        const height = slides[slide].getBoundingClientRect().height;
        if (height > 0) {
          this._carousel.containerNode().style.maxHeight = `${height}px`;
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
   * Handle the user selecting a new slide in the carousel.
   */
  protected _selectSlideSetViewHandler(): void {
    // To be overridden in children.
  }

  /**
   * Handle updating of the next/previous controls when the carousel is moved.
   */
  protected _selectSlideNextPreviousHandler(): void {
    // To be overridden in children.
  }

  /**
   * Handle a next/previous control interaction.
   * @param direction The direction requested, previous or next.
   */
  protected _nextPreviousHandler(direction: 'previous' | 'next'): void {
    if (direction === 'previous') {
      this._carousel?.scrollPrev(this._getTransitionEffect() === 'none');
    } else if (direction === 'next') {
      this._carousel?.scrollNext(this._getTransitionEffect() === 'none');
    }
  }

  /**
   * Fire a media show event when a slide is selected.
   */
  protected _selectSlideMediaShowHandler(): void {
    if (!this._carousel) {
      return;
    }

    const slideIndex = this._carousel.selectedScrollSnap();
    if (slideIndex in this._mediaShowInfo) {
      dispatchExistingMediaShowInfoAsEvent(this, this._mediaShowInfo[slideIndex]);
    }
  }

  /**
   * Handle a media-show event that is generated by a child component, saving the
   * contents for future use when the relevant slide is actually shown.
   * @param slideIndex The relevant slide index.
   * @param event The media-show event from the child component.
   */
  protected _mediaShowEventHandler(
    slideIndex: number,
    event: CustomEvent<MediaShowInfo>,
  ): void {
    // Don't allow the inbound event to propagate upwards, that will be
    // automatically done at the appropriate time as the slide is shown.
    event.stopPropagation();
    this._mediaLoadedHandler(slideIndex, event.detail);
  }

  /**
   * Handle a MediaShowInfo object that is generated on media load, by saving it
   * for future, or immediate use, when the relevant slide is displayed.
   * @param slideIndex The relevant slide index.
   * @param mediaShowInfo The MediaShowInfo object generated by the media.
   */
  protected _mediaLoadedHandler(
    slideIndex: number,
    mediaShowInfo?: MediaShowInfo | null,
  ): void {
    // isValidMediaShowInfo is used to prevent saving media info that will be
    // rejected upstream (empty 1x1 images will be rejected here).
    if (mediaShowInfo && isValidMediaShowInfo(mediaShowInfo)) {
      this._mediaShowInfo[slideIndex] = mediaShowInfo;
      if (this._carousel && this._carousel?.selectedScrollSnap() === slideIndex) {
        dispatchExistingMediaShowInfoAsEvent(this, mediaShowInfo);
      }
    }
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResultGroup {
    return [super.styles, unsafeCSS(mediaCarouselStyle)];
  }
}
