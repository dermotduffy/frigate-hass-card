import {
  CSSResultGroup,
  LitElement,
  PropertyValues,
  TemplateResult,
  html,
  unsafeCSS,
} from 'lit';
import { BrowseMediaUtil } from '../browse-media-util.js';
import { EmblaOptionsType } from 'embla-carousel';
import { HomeAssistant } from 'custom-card-helpers';
import { Task } from '@lit-labs/task';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';

import type {
  BrowseMediaNeighbors,
  BrowseMediaQueryParameters,
  BrowseMediaSource,
  ExtendedHomeAssistant,
  MediaShowInfo,
  ViewerConfig,
} from '../types.js';
import { FrigateCardMediaCarousel, IMG_EMPTY } from './media-carousel.js';
import { FrigateCardNextPreviousControl } from './next-prev-control.js';
import {
  FrigateCardThumbnailCarousel,
  ThumbnailCarouselTap,
} from './thumbnail-carousel.js';
import { ResolvedMediaCache, ResolvedMediaUtil } from '../resolved-media.js';
import { View } from '../view.js';
import {
  createMediaShowInfo,
  dispatchErrorMessageEvent,
  dispatchMessageEvent,
} from '../common.js';
import { localize } from '../localize/localize.js';
import { renderProgressIndicator } from '../components/message.js';

import './next-prev-control.js';

import viewerStyle from '../scss/viewer.scss';
import viewerCoreStyle from '../scss/viewer-core.scss';

@customElement('frigate-card-viewer')
export class FrigateCardViewer extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected viewerConfig?: ViewerConfig;

  @property({ attribute: false })
  protected browseMediaQueryParameters?: BrowseMediaQueryParameters;

  @property({ attribute: false })
  protected resolvedMediaCache?: ResolvedMediaCache;

  /**
   * Asyncronously render the element.
   * @returns A rendered template.
   */
  protected async _fetchLatestMedia(): Promise<void> {
    if (!this.view || !this.hass || !this.browseMediaQueryParameters) {
      return;
    }
    let parent: BrowseMediaSource | null;
    try {
      parent = await BrowseMediaUtil.browseMediaQuery(
        this.hass,
        this.browseMediaQueryParameters,
      );
    } catch (e) {
      return dispatchErrorMessageEvent(this, (e as Error).message);
    }
    const childIndex = BrowseMediaUtil.getFirstTrueMediaChildIndex(parent);
    if (!parent || !parent.children || childIndex == null) {
      return dispatchMessageEvent(
        this,
        this.browseMediaQueryParameters.mediaType == 'clips'
          ? localize('common.no_clip')
          : localize('common.no_snapshot'),
        this.browseMediaQueryParameters.mediaType == 'clips'
          ? 'mdi:filmstrip-off'
          : 'mdi:camera-off',
      );
    }

    this.view
      .evolve({
        target: parent,
        childIndex: childIndex,
      })
      .dispatchChangeEvent(this);
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.view || !this.browseMediaQueryParameters) {
      return;
    }

    if (!this.view.target) {
      this._fetchLatestMedia();
      return renderProgressIndicator();
    }

    return html` <frigate-card-viewer-core
      .view=${this.view}
      .viewerConfig=${this.viewerConfig}
      .resolvedMediaCache=${this.resolvedMediaCache}
      .hass=${this.hass}
      .browseMediaQueryParameters=${this.browseMediaQueryParameters}
    >
    </frigate-card-viewer-core>`;
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerStyle);
  }
}

@customElement('frigate-card-viewer-core')
export class FrigateCardViewerCore extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected viewerConfig?: ViewerConfig;

  @property({ attribute: false })
  protected browseMediaQueryParameters?: BrowseMediaQueryParameters;

  @property({ attribute: false })
  protected resolvedMediaCache?: ResolvedMediaCache;

  protected _viewerCarouselRef: Ref<FrigateCardViewerCarousel> = createRef();
  protected _thumbnailCarouselRef: Ref<FrigateCardThumbnailCarousel> = createRef();

  protected _syncThumbnailCarousel(): void {
    const mediaSelected = this._viewerCarouselRef.value?.carouselSelected();
    if (mediaSelected !== undefined) {
      this._thumbnailCarouselRef.value?.carouselScrollTo(mediaSelected);
    }
  }

  protected _renderThumbnails(): TemplateResult {
    if (!this.view || !this.viewerConfig) {
      return html``;
    }

    return html` <frigate-card-thumbnail-carousel
      ${ref(this._thumbnailCarouselRef)}
      .target=${this.view.target}
      .config=${this.viewerConfig.controls.thumbnails}
      @frigate-card:carousel:tap=${(ev: CustomEvent<ThumbnailCarouselTap>) => {
        this._viewerCarouselRef.value?.carouselScrollTo(ev.detail.slideIndex);
      }}
      @frigate-card:carousel:init=${this._syncThumbnailCarousel.bind(this)}
    >
    </frigate-card-thumbnail-carousel>`;
  }

  protected render(): TemplateResult | void {
    if (!this.view || !this.viewerConfig) {
      return html``;
    }
    return html` ${this.viewerConfig &&
      this.viewerConfig.controls.thumbnails.mode === 'above'
        ? this._renderThumbnails()
        : ''}
      <frigate-card-viewer-carousel
        ${ref(this._viewerCarouselRef)}
        .hass=${this.hass}
        .view=${this.view}
        .viewerConfig=${this.viewerConfig}
        .browseMediaQueryParameters=${this.browseMediaQueryParameters}
        .resolvedMediaCache=${this.resolvedMediaCache}
        @frigate-card:carousel:select=${this._syncThumbnailCarousel.bind(this)}
      >
      </frigate-card-viewer-carousel>
      ${this.viewerConfig && this.viewerConfig.controls.thumbnails.mode === 'below'
        ? this._renderThumbnails()
        : ''}`;
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerCoreStyle);
  }
}

@customElement('frigate-card-viewer-carousel')
export class FrigateCardViewerCarousel extends FrigateCardMediaCarousel {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected viewerConfig?: ViewerConfig;

  @property({ attribute: false })
  protected browseMediaQueryParameters?: BrowseMediaQueryParameters;

  @property({ attribute: false })
  protected resolvedMediaCache?: ResolvedMediaCache;

  // Mapping of slide # to BrowseMediaSource child #.
  // (Folders are not media items that can be rendered).
  protected _slideToChild: Record<number, number> = {};

  // A task to resolve target media if lazy loading is disabled.
  protected _mediaResolutionTask = new Task<[BrowseMediaSource | undefined], void>(
    this,
    async ([target]: (BrowseMediaSource | undefined)[]): Promise<void> => {
      for (
        let i = 0;
        !this._isLazyLoading() &&
        this.hass &&
        target &&
        target.children &&
        i < (target.children || []).length;
        ++i
      ) {
        if (BrowseMediaUtil.isTrueMedia(target.children[i])) {
          await ResolvedMediaUtil.resolveMedia(
            this.hass,
            target.children[i],
            this.resolvedMediaCache,
          );
        }
      }
    },
    () => [this.view?.target],
  );

  /**
   * The updated lifecycle callback for this element.
   * @param changedProperties The properties that were changed in this render.
   */
  updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('viewerConfig')) {
      this._destroyCarousel();
    }

    if (changedProperties.has('view')) {
      const oldView = changedProperties.get('view') as View | undefined;
      if (oldView) {
        if (oldView.target != this.view?.target) {
          // If the media target is different entirely, reset the carousel.
          this._destroyCarousel();
        } else if (this._carousel && this.view?.childIndex != oldView.childIndex) {
          const slide = this._getSlideForChild(this.view?.childIndex);
          if (slide !== undefined && slide !== this.carouselSelected()) {
            // If the media target is the same as already loaded, but isn't of
            // the selected slide, scroll to that slide.
            this.carouselScrollTo(slide);
          }
        }
      }
    }

    super.updated(changedProperties);
  }

  protected _destroyCarousel(): void {
    super._destroyCarousel();

    // Notes on instance variables:
    // * this._slideToChild: This is set as part of each render and does not
    //   need to be destroyed here.
  }

  protected _getSlideForChild(childIndex: number | undefined): number | undefined {
    if (childIndex === undefined) {
      return undefined;
    }
    const slideIndex = Object.keys(this._slideToChild).find(
      (key) => this._slideToChild[key] === childIndex,
    );
    return slideIndex !== undefined ? Number(slideIndex) : undefined;
  }

  /**
   * Get the Embla options to use.
   * @returns An EmblaOptionsType object or undefined for no options.
   */
  protected _getOptions(): EmblaOptionsType {
    return {
      // Start the carousel on the selected child number.
      startIndex: this._getSlideForChild(this.view?.childIndex),
      draggable: this.viewerConfig?.draggable,
    };
  }

  /**
   * Returns the number of slides to lazily load. 0 means all slides are lazy
   * loaded, 1 means that 1 slide on each side of the currently selected slide
   * should lazy load, etc. `null` means lazy loading is disabled and everything
   * should load simultaneously.
   * @returns
   */
  protected _getLazyLoadCount(): number | null {
    // Defaults to fully-lazy loading.
    return this.viewerConfig?.lazy_load === false ? null : 0;
  }

  /**
   * Get the previous and next true media items from the current view.
   * @returns A BrowseMediaNeighbors with indices and objects of true media
   * neighbors.
   */
  protected _getMediaNeighbors(): BrowseMediaNeighbors | null {
    if (
      !this.view ||
      !this.view.target ||
      !this.view.target.children ||
      this.view.childIndex === undefined
    ) {
      return null;
    }

    // Work backwards from the index to get the previous real media.
    let prevIndex: number | null = null;
    for (let i = this.view.childIndex - 1; i >= 0; i--) {
      const media = this.view.target.children[i];
      if (media && BrowseMediaUtil.isTrueMedia(media)) {
        prevIndex = i;
        break;
      }
    }

    // Work forwards from the index to get the next real media.
    let nextIndex: number | null = null;
    for (let i = this.view.childIndex + 1; i < this.view.target.children.length; i++) {
      const media = this.view.target.children[i];
      if (media && BrowseMediaUtil.isTrueMedia(media)) {
        nextIndex = i;
        break;
      }
    }

    return {
      previousIndex: prevIndex,
      previous: prevIndex != null ? this.view.target.children[prevIndex] : null,
      nextIndex: nextIndex,
      next: nextIndex != null ? this.view.target.children[nextIndex] : null,
    };
  }

  /**
   * Get a clip view that matches a given snapshot. Includes clips within the
   * same range as the current view.
   * @param snapshot The snapshot to find a matching clip for.
   * @returns The view that would show the matching clip.
   */
  protected async _findRelatedClipView(
    snapshot: BrowseMediaSource,
  ): Promise<View | null> {
    if (
      !this.hass ||
      !this.view ||
      !this.view.target ||
      !this.view.target.children ||
      !this.view.target.children.length ||
      !this.browseMediaQueryParameters
    ) {
      return null;
    }

    const snapshotStartTime = BrowseMediaUtil.extractEventStartTime(snapshot);
    if (!snapshotStartTime) {
      return null;
    }

    // Heuristic: At this point, the user has a particular snapshot that they
    // are interested in and want to see a related clip, yet the viewer code
    // does not know the exact search criteria that led to that snapshot (e.g.
    // it could be a 10-deep folder in the gallery). To give the user to ability
    // to 'navigate' in the clips view once they change into that mode, this
    // heuristic finds the earliest and latest snapshot that the user is
    // currently viewing and mirrors that range into the clips view. Then,
    // within the results see if there's a clip that matches the same time as
    // the snapshot.
    let earliest: number | null = null;
    let latest: number | null = null;
    for (let i = 0; i < this.view.target.children.length; i++) {
      const child = this.view.target.children[i];
      if (!BrowseMediaUtil.isTrueMedia(child)) {
        continue;
      }
      const startTime = BrowseMediaUtil.extractEventStartTime(child);

      if (startTime && (earliest === null || startTime < earliest)) {
        earliest = startTime;
      }
      if (startTime && (latest === null || startTime > latest)) {
        latest = startTime;
      }
    }
    if (!earliest || !latest) {
      return null;
    }

    let clips: BrowseMediaSource | null;

    try {
      clips = await BrowseMediaUtil.browseMediaQuery(this.hass, {
        ...this.browseMediaQueryParameters,
        mediaType: 'clips',
        before: latest,
        after: earliest,
      });
    } catch (e) {
      // This is best effort.
      return null;
    }

    if (!clips || !clips.children || !clips.children.length) {
      return null;
    }

    for (let i = 0; i < clips.children.length; i++) {
      const child = clips.children[i];
      if (!BrowseMediaUtil.isTrueMedia(child)) {
        continue;
      }
      const clipStartTime = BrowseMediaUtil.extractEventStartTime(child);
      if (clipStartTime && clipStartTime === snapshotStartTime) {
        return new View({
          view: 'clip',
          camera: this.view.camera,
          target: clips,
          childIndex: i,
          previous: this.view,
        });
      }
    }
    return null;
  }

  /**
   * Handle the user selecting a new slide in the carousel.
   */
  protected _selectSlideSetViewHandler(): void {
    if (!this._carousel || !this.view) {
      return;
    }

    // Update the childIndex in the view.
    const slidesInView = this._carousel.slidesInView(true);
    if (slidesInView.length) {
      const childIndex = this._slideToChild[slidesInView[0]];
      if (childIndex !== undefined) {
        this.view
          .evolve({
            childIndex: childIndex,
            previous: this.view,
          })
          .dispatchChangeEvent(this);
      }
    }
  }

  /**
   * Lazy load a slide.
   * @param index The index of the slide to lazy load.
   * @param slide The slide to lazy load.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _lazyLoadSlide(index: number, slide: HTMLElement): void {
    const childIndex: number | undefined = this._slideToChild[index];

    if (
      childIndex == undefined ||
      !this.hass ||
      !this.view ||
      !this.view.target ||
      !this.view.target.children ||
      !BrowseMediaUtil.isTrueMedia(this.view.target.children[childIndex])
    ) {
      return;
    }

    ResolvedMediaUtil.resolveMedia(
      this.hass,
      this.view.target.children[childIndex],
      this.resolvedMediaCache,
    ).then((resolvedMedia) => {
      if (!resolvedMedia) {
        return;
      }

      // Snapshots.
      const img = slide.querySelector('img') as HTMLImageElement;

      // Frigate >= 0.9.0+ clips.
      const hls_player = slide.querySelector(
        'frigate-card-ha-hls-player',
      ) as HTMLElement & { url: string };

      if (img) {
        img.src = resolvedMedia.url;
      } else if (hls_player) {
        hls_player.url = resolvedMedia.url;
      }
    });
  }

  /**
   * Handle updating of the next/previous controls when the carousel is moved.
   */
  protected _selectSlideNextPreviousHandler(): void {
    const updateNextPreviousControl = (
      control: FrigateCardNextPreviousControl,
      direction: 'previous' | 'next',
    ): void => {
      const neighbors = this._getMediaNeighbors();
      const [prev, next] = [neighbors?.previous, neighbors?.next];
      const target = direction == 'previous' ? prev : next;

      control.disabled = target == null;
      control.title = target && target.title ? target.title : '';
      control.thumbnail = target && target.thumbnail ? target.thumbnail : undefined;
    };

    if (this._previousControlRef.value) {
      updateNextPreviousControl(this._previousControlRef.value, 'previous');
    }
    if (this._nextControlRef.value) {
      updateNextPreviousControl(this._nextControlRef.value, 'next');
    }
  }

  /**
   * Get slides to include in the render.
   * @returns The slides to include in the render and an index keyed by slide
   * number that maps to child number.
   */
  protected _getSlides(): [TemplateResult[], Record<number, number>] {
    if (
      !this.view ||
      !this.view.target ||
      !this.view.target.children ||
      !this.view.target.children.length
    ) {
      return [[], {}];
    }

    const slideToChild: Record<number, number> = {};
    const slides: TemplateResult[] = [];
    for (let i = 0; i < this.view.target.children?.length; ++i) {
      const slide = this._renderMediaItem(this.view.target.children[i], slides.length);

      if (slide) {
        slideToChild[slides.length] = i;
        slides.push(slide);
      }
    }
    return [slides, slideToChild];
  }

  /**
   * Determine if all the media in the carousel are resolved.
   */
  protected _isMediaFullyResolved(): boolean {
    for (const child of this.view?.target?.children || []) {
      if (!this.resolvedMediaCache?.has(child.media_content_id)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Render the element, resolving the media first if necessary.
   */
  protected render(): TemplateResult | void {
    this._slideToChild = {};

    // If lazy loading is not enabled, wait for the media resolver task to
    // complete and show a progress indictator until this.
    if (!this._isLazyLoading() && !this._isMediaFullyResolved()) {
      return html`${this._mediaResolutionTask.render({
        initial: () => renderProgressIndicator(),
        pending: () => renderProgressIndicator(),
        error: (e: unknown) => dispatchErrorMessageEvent(this, (e as Error).message),
        complete: () => this._render(),
      })}`;
    }
    return this._render();
  }

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected _render(): TemplateResult | void {
    const [slides, slideToChild] = this._getSlides();
    this._slideToChild = slideToChild;
    if (!slides) {
      return;
    }

    const neighbors = this._getMediaNeighbors();
    const [prev, next] = [neighbors?.previous, neighbors?.next];

    return html`<div class="embla">
      <frigate-card-next-previous-control
        ${ref(this._previousControlRef)}
        .direction=${'previous'}
        .controlConfig=${this.viewerConfig?.controls.next_previous}
        .thumbnail=${prev && prev.thumbnail ? prev.thumbnail : undefined}
        .title=${prev ? prev.title : ''}
        ?disabled=${!prev}
        @click=${() => {
          this._nextPreviousHandler('previous');
        }}
      ></frigate-card-next-previous-control>
      <div class="embla__viewport">
        <div class="embla__container">${slides}</div>
      </div>
      <frigate-card-next-previous-control
        ${ref(this._nextControlRef)}
        .direction=${'next'}
        .controlConfig=${this.viewerConfig?.controls.next_previous}
        .thumbnail=${next && next.thumbnail ? next.thumbnail : undefined}
        .title=${next ? next.title : ''}
        ?disabled=${!next}
        @click=${() => {
          this._nextPreviousHandler('next');
        }}
      ></frigate-card-next-previous-control>
    </div>`;
  }

  protected _renderMediaItem(
    mediaToRender: BrowseMediaSource,
    slideIndex: number,
  ): TemplateResult | void {
    // Skip folders as they cannot be rendered by this viewer.
    if (
      !this.view ||
      !this.viewerConfig ||
      !BrowseMediaUtil.isTrueMedia(mediaToRender)
    ) {
      return;
    }

    const lazyLoad = this._isLazyLoading();
    const resolvedMedia = this.resolvedMediaCache?.get(mediaToRender.media_content_id);
    if (!resolvedMedia && !lazyLoad) {
      return;
    }

    // In this block, no clip has been manually selected, so this is loading
    // the most recent clip on card load. In this mode, autoplay of the clip
    // may be disabled by configuration. If does not make sense to disable
    // autoplay when the user has explicitly picked an event to play in the
    // gallery.
    let autoplay = true;
    if (this.view.is('clip') || this.view.is('snapshot')) {
      autoplay = this.viewerConfig.autoplay_clip;
    }

    return html`
      <div class="embla__slide">
        ${this.view.isClipRelatedView()
          ? html`<frigate-card-ha-hls-player
              .hass=${this.hass}
              url=${ifDefined(lazyLoad ? undefined : resolvedMedia?.url)}
              title="${mediaToRender.title}"
              muted
              controls
              playsinline
              allow-exoplayer
              ?autoplay="${autoplay}"
              @frigate-card:media-show=${(e: CustomEvent<MediaShowInfo>) =>
                this._mediaShowEventHandler(slideIndex, e)}
            >
            </frigate-card-ha-hls-player>`
          : html`<img
              src=${ifDefined(lazyLoad ? IMG_EMPTY : resolvedMedia?.url)}
              title="${mediaToRender.title}"
              @click=${() => {
                if (this._carousel?.clickAllowed()) {
                  this._findRelatedClipView(mediaToRender).then((view) => {
                    if (view) {
                      view.dispatchChangeEvent(this);
                    }
                  });
                }
              }}
              @load="${(e: Event) => {
                if (
                  // This handler will be called on the empty image (including
                  // an updated empty image that is the same dimensions large as
                  // the previously fully loaded image -- see the note on dummy
                  // images in media-carousel.ts). Here we need to only call the
                  // media load handler on a 'real' load.
                  !lazyLoad ||
                  this._slideHasBeenLazyLoaded[slideIndex]
                ) {
                  this._mediaLoadedHandler(slideIndex, createMediaShowInfo(e));
                }
              }}"
            />`}
      </div>
    `;
  }
}
