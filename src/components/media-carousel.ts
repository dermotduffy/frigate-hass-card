import { CSSResultGroup, unsafeCSS } from 'lit';
import { EmblaCarouselType } from 'embla-carousel';
import { createRef, Ref } from 'lit/directives/ref';
import { customElement } from 'lit/decorators.js';

import { FrigateCardCarousel } from './carousel.js';
import type { MediaShowInfo } from '../types.js';
import {
  dispatchExistingMediaShowInfoAsEvent,
  isValidMediaShowInfo,
} from '../common.js';

import './next-prev-control.js';

import mediaCarouselStyle from '../scss/media-carousel.scss';

import { FrigateCardNextPreviousControl } from './next-prev-control.js';

const getEmptyImageSrc = (width: number, height: number) =>
  `data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"%3E%3C/svg%3E`;
export const IMG_EMPTY = getEmptyImageSrc(16, 9);

@customElement('frigate-card-media-carousel')
export class FrigateCardMediaCarousel extends FrigateCardCarousel {
  // A "map" from slide number to MediaShowInfo object.
  protected _mediaShowInfo: Record<number, MediaShowInfo> = {};

  // Whether or not a given slide has been successfully lazily loaded.
  protected _slideHasBeenLazyLoaded: Record<number, boolean> = {};

  protected _nextControlRef: Ref<FrigateCardNextPreviousControl> = createRef();
  protected _previousControlRef: Ref<FrigateCardNextPreviousControl> = createRef();

  /**
   * Returns the number of slides to lazily load. 0 means all slides are lazy
   * loaded, 1 means that 1 slide on each side of the currently selected slide
   * should lazy load, etc. `null` means lazy loading is disabled and everything
   * should load simultaneously.
   * @returns
   */
  protected _getLazyLoadCount(): number | null {
    // Defaults to fully-lazy loading.
    return 0;
  }

  /**
   * Determine if lazy loading is being used.
   * @returns `true` is lazy loading is in use.
   */
  protected _isLazyLoading(): boolean {
    return this._getLazyLoadCount() !== null;
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
    // * this._slideHasBeenLazyLoaded: This is a performance optimization and
    //   can be safely reset.
    this._slideHasBeenLazyLoaded = {};
  }

  /**
   * Initializse the carousel with "slides" (clips or snapshots).
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

    // Adapt the height of the container to the media as the carousel is moved.
    carousel?.on('init', this._adaptiveHeightHandler.bind(this));
    carousel?.on('select', this._adaptiveHeightHandler.bind(this));
    carousel?.on('resize', this._adaptiveHeightHandler.bind(this));
    
    if (this._getLazyLoadCount() != null) {
      // Load media as the carousel is moved (if lazy loading is in use).
      carousel?.on('init', this._lazyLoadMediaHandler.bind(this));
      carousel?.on('select', this._lazyLoadMediaHandler.bind(this));
      carousel?.on('resize', this._lazyLoadMediaHandler.bind(this));
    }
  }

  /**
   * Adapt the height of the container to the height of the media (for cases
   * where the carousel has different media heights, e.g. live cameras with
   * different aspect ratios).
   */
  protected _adaptiveHeightHandler(): void {
    if (!this._carousel) {
      return;
    }
    const slides = this._carousel.slideNodes();
    const heights = this._carousel.slidesInView(true).map((index) => {
      const firstChild = slides[index].querySelector("*");
      return firstChild ? firstChild.getBoundingClientRect().height : 0;
    })
    const targetHeight = Math.max(...heights);
    if (targetHeight > 0) {
      this._carousel.containerNode().style.maxHeight = `${targetHeight}px`;
    } else {
      this._carousel.containerNode().style.removeProperty('max-height')
    }
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
    if (direction == 'previous') {
      this._carousel?.scrollPrev();
    } else if (direction == 'next') {
      this._carousel?.scrollNext();
    }
  }

  /**
   * Lazily load media in the carousel.
   */
  protected _lazyLoadMediaHandler(): void {
    if (!this._carousel) {
      return;
    }
    const lazyLoadCount = this._getLazyLoadCount();
    if (lazyLoadCount === null) {
      return;
    }

    const slides = this._carousel.slideNodes();
    const slidesInView = this._carousel.slidesInView(true);
    const slidesToLoad = new Set<number>();

    const minSlide = Math.min(...slidesInView);
    const maxSlide = Math.max(...slidesInView);

    // Lazily load 'lazyLoadCount' slides on either side of the slides in view.
    for (let i = 1; i <= lazyLoadCount && minSlide - i >= 0; i++) {
      slidesToLoad.add(minSlide - i);
    }
    slidesInView.forEach((index) => slidesToLoad.add(index));
    for (let i = 1; i <= lazyLoadCount && maxSlide + i < slides.length; i++) {
      slidesToLoad.add(maxSlide + i);
    }

    slidesToLoad.forEach((index) => {
      // Only lazy load slides that are not already loaded.
      if (this._slideHasBeenLazyLoaded[index]) {
        return;
      }
      this._slideHasBeenLazyLoaded[index] = true;
      this._lazyLoadSlide(index, slides[index]);
    });
  }

  /**
   * Lazy load a slide.
   * @param _index The index of the slide to lazy load.
   * @param _slide The slide to lazy load.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _lazyLoadSlide(_index: number, _slide: HTMLElement): void {
    // To be overridden in children.
  }

  /**
   * Fire a media show event when a slide is selected.
   */
  protected _selectSlideMediaShowHandler(): void {
    if (!this._carousel) {
      return;
    }

    this._carousel.slidesInView(true).forEach((slideIndex) => {
      if (slideIndex in this._mediaShowInfo) {
        dispatchExistingMediaShowInfoAsEvent(this, this._mediaShowInfo[slideIndex]);
      }
    });
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
      if (this._carousel && this._carousel?.slidesInView(true).includes(slideIndex)) {
        dispatchExistingMediaShowInfoAsEvent(this, mediaShowInfo);
      }

      // After media has been loaded, the height of the container may need to be
      // re-adjusted.
      this._adaptiveHeightHandler();
      /**
       * Images need a width/height from initial load, and browsers will assume
       * that the aspect ratio of the initial dummy-image load will persist. In
       * lazy-loading, this can cause a 1x1 pixel dummy image to cause the
       * browser to assume all images will be square, so the whole carousel will
       * have the wrong aspect-ratio until every single image has been lazily
       * loaded. Adaptive height helps in that the carousel gets resized on each
       * img display to the correct size, but it still causes a minor noticeable
       * flicker until the height change is complete.
       * 
       * To avoid this, we use a 16:9 dummy image at first (most
       * likely?) and once the first piece of real media has been loaded, all
       * dummy images are replaced with dummy images that match the aspect ratio
       * of the real image. It still might be wrong, but it's the best option
       * available.
       */
      const firstMediaLoad = !Object.keys(this._mediaShowInfo).length;
      if (firstMediaLoad && this._getLazyLoadCount() != null) {
        const replacementImageSrc = getEmptyImageSrc(
          mediaShowInfo.width,
          mediaShowInfo.height,
        );

        this.renderRoot.querySelectorAll('.embla__container img').forEach((img) => {
          const imageElement = img as HTMLImageElement;
          if (imageElement.src === IMG_EMPTY) {
            imageElement.src = replacementImageSrc;
          }
        });
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
