import {
  CSSResultGroup,
  LitElement,
  TemplateResult,
  html,
  unsafeCSS,
  PropertyValues,
} from 'lit';
import { BrowseMediaUtil } from '../browse-media-util.js';
import EmblaCarousel, { EmblaCarouselType } from 'embla-carousel';
import { HomeAssistant } from 'custom-card-helpers';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit-html/directives/if-defined.js';
import { until } from 'lit/directives/until.js';

import type {
  BrowseMediaNeighbors,
  BrowseMediaQueryParameters,
  BrowseMediaSource,
  ExtendedHomeAssistant,
  MediaShowInfo,
  NextPreviousControlStyle,
} from '../types.js';
import { ResolvedMediaCache, ResolvedMediaUtil } from '../resolved-media.js';
import { View } from '../view.js';
import {
  createMediaShowInfo,
  dispatchErrorMessageEvent,
  dispatchMessageEvent,
  dispatchPauseEvent,
  dispatchPlayEvent,
  dispatchExistingMediaShowInfoAsEvent,
  isValidMediaShowInfo,
} from '../common.js';
import { localize } from '../localize/localize.js';
import { renderProgressIndicator } from '../components/message.js';

import './next-prev-control.js';

import viewerStyle from '../scss/viewer.scss';

const IMG_TRANSPARENT_1x1 =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';

@customElement('frigate-card-viewer')
export class FrigateCardViewer extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: View;

  @property({ attribute: false })
  protected browseMediaQueryParameters?: BrowseMediaQueryParameters;

  @property({ attribute: false })
  protected nextPreviousControlStyle?: NextPreviousControlStyle;

  @property({ attribute: false })
  protected autoplayClip?: boolean;

  @property({ attribute: false })
  protected resolvedMediaCache?: ResolvedMediaCache;

  @property({ attribute: false })
  protected lazyLoad?: boolean;

  /**
   * Resolve all the given media for a target.
   * @param target The target to resolve media from.
   * @returns True if the resolutions were all error free.
   */
  protected async _resolveAllMediaForTarget(
    target: BrowseMediaSource,
  ): Promise<boolean> {
    if (!this.hass) {
      return false;
    }

    let errorFree = true;
    for (let i = 0; target.children && i < (target.children || []).length; ++i) {
      if (BrowseMediaUtil.isTrueMedia(target.children[i])) {
        errorFree &&= !!(await ResolvedMediaUtil.resolveMedia(
          this.hass,
          target.children[i],
          this.resolvedMediaCache,
        ));
      }
    }
    return errorFree;
  }

  protected render(): TemplateResult | void {
    return html`${until(this._render(), renderProgressIndicator())}`;
  }

  /**
   * Asyncronously render the element.
   * @returns A template to render.
   */
  protected async _render(): Promise<TemplateResult | void> {
    if (!this.hass || !this.view || !this.browseMediaQueryParameters) {
      return html``;
    }

    let autoplay = true;

    if (this.view.is('clip') || this.view.is('snapshot')) {
      let parent: BrowseMediaSource | null = null;
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
          this.view.is('clip')
            ? localize('common.no_clip')
            : localize('common.no_snapshot'),
          this.view.is('clip') ? 'mdi:filmstrip-off' : 'mdi:camera-off',
        );
      }
      this.view.target = parent;
      this.view.childIndex = childIndex;

      // In this block, no clip has been manually selected, so this is loading
      // the most recent clip on card load. In this mode, autoplay of the clip
      // may be disabled by configuration. If does not make sense to disable
      // autoplay when the user has explicitly picked an event to play in the
      // gallery.
      autoplay = this.autoplayClip ?? true;
    }

    if (this.view.target && !(await this._resolveAllMediaForTarget(this.view.target))) {
      return dispatchErrorMessageEvent(this, localize('error.could_not_resolve'));
    }

    return html` <frigate-card-viewer-core
      .view=${this.view}
      .nextPreviousControlStyle=${this.nextPreviousControlStyle}
      .resolvedMediaCache=${this.resolvedMediaCache}
      .autoplayClip=${autoplay}
      .hass=${this.hass}
      .browseMediaQueryParameters=${this.browseMediaQueryParameters}
      .lazyLoad=${this.lazyLoad}
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
  protected view?: View;

  @property({ attribute: false })
  protected nextPreviousControlStyle?: NextPreviousControlStyle;

  @property({ attribute: false })
  protected resolvedMediaCache?: ResolvedMediaCache;

  @property({ attribute: false })
  protected autoplayClip?: boolean;

  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected browseMediaQueryParameters?: BrowseMediaQueryParameters;

  @property({ attribute: false })
  protected lazyLoad?: boolean;

  // Media carousel object.
  protected _carousel?: EmblaCarouselType;
  protected _loadedCarousel = false;

  // Mapping of slide # to BrowseMediaSource child #.
  // (Folders are not media items that can be rendered).
  protected _slideToChild: Record<number, number> = {};

  // A "map" from slide number to MediaShowInfo object or null if the slide has
  // been lazy loaded, but the MediaShowInfo object is not yet available.
  protected _mediaShowInfo: Record<number, MediaShowInfo | null> = {};

  /**
   * The updated lifecycle callback for this element.
   * @param changedProperties The properties that were changed in this render.
   */
  updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (!this._loadedCarousel) {
      this.updateComplete.then(() => {
        this._loadCarousel();
      });
    }
  }

  /**
   * Load the carousel with "slides" (clips or snapshots).
   */
  protected _loadCarousel(): void {
    const carouselNode = this.renderRoot.querySelector(
      '.embla__viewport',
    ) as HTMLElement;

    if (carouselNode) {
      this._loadedCarousel = true;

      // Start the carousel on the selected child number.
      const startIndex = Number(
        Object.keys(this._slideToChild).find(
          (key) => this._slideToChild[key] === this.view?.childIndex,
        ),
      );

      this._carousel = EmblaCarousel(carouselNode, {
        startIndex: isNaN(startIndex) ? undefined : startIndex,
      });
      // Update views and dispatch media-show events based on slide selections.
      this._carousel.on('select', this._selectSlideSetViewHandler.bind(this));
      this._carousel.on('select', this._selectSlideMediaShowHandler.bind(this));

      // Lazily load media that is displayed. These handlers are registered
      // regardless of the value of this.lazyLoad to allow that value to change
      // after the carousel has been initialized.
      this._carousel.on('init', this._lazyLoadMediaHandler.bind(this));
      this._carousel.on('select', this._lazyLoadMediaHandler.bind(this));
      this._carousel.on('resize', this._lazyLoadMediaHandler.bind(this));
    }
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
          view: 'clip-specific',
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
        // Update the currently live view in place.
        this.view.childIndex = childIndex;
        this.requestUpdate();
      }
    }
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
    if (!this.lazyLoad || !this._carousel) {
      return;
    }
    const slides = this._carousel.slideNodes();
    const slidesInView = this._carousel.slidesInView(true);
    const slidesToLoad = new Set<number>();

    // Lazily load the selected slide and the one on each side of it to improve
    // the user navigation experience.
    for (let i = 0; i < slidesInView.length; i++) {
      const index = slidesInView[i];
      if (index > 0) {
        slidesToLoad.add(index - 1);
      }
      slidesToLoad.add(index);
      if (index < slides.length - 1) {
        slidesToLoad.add(index + 1);
      }
    }

    slidesToLoad.forEach((index) => {
      // Only lazy loads slides that are not already loaded.
      if (index in this._mediaShowInfo) {
        return;
      }
      this._mediaShowInfo[index] = null;

      const slide = slides[index];

      // Snapshots.
      const img = slide.querySelector('img');

      // Frigate >= 0.9.0+ clips.
      const hls_player = slide.querySelector(
        'frigate-card-ha-hls-player',
      ) as HTMLElement & { url: string };

      // Frigate < 0.9.0 clips. frigate-card-ha-hls-player will also have a
      // video source element, so search for that first.
      const video_source = slide.querySelector('video source') as HTMLElement & {
        src: string;
      };

      if (img) {
        img.src = img.getAttribute('data-src') || img.src;
      } else if (hls_player) {
        hls_player.url = hls_player.getAttribute('data-url') || hls_player.url;
      } else if (video_source) {
        video_source.src = video_source.getAttribute('data-src') || video_source.src;
      }
    });
  }

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    if (
      !this.view ||
      !this.view.target ||
      !this.view.target.children ||
      !this.view.target.children.length ||
      this.view.childIndex === undefined ||
      !this.resolvedMediaCache
    ) {
      return html``;
    }

    const slides: TemplateResult[] = [];
    this._slideToChild = {};

    for (let i = 0; i < this.view.target.children?.length; ++i) {
      const slide = this._renderMediaItem(this.view.target.children[i], slides.length);
      if (slide) {
        this._slideToChild[slides.length] = i;
        slides.push(slide);
      }
    }

    const neighbors = this._getMediaNeighbors();

    return html`<div class="container">
      ${neighbors && neighbors.previous
        ? html`<frigate-card-next-previous-control
            .direction=${'previous'}
            .controlStyle=${this.nextPreviousControlStyle}
            .thumbnail=${neighbors.previous.thumbnail}
            .title=${neighbors.previous.title}
            @click=${() => this._nextPreviousHandler('previous')}
          ></frigate-card-next-previous-control>`
        : ``}
      <div class="embla">
        <div class="embla__viewport">
          <div class="embla__container">${slides}</div>
        </div>
      </div>
      ${neighbors && neighbors.next
        ? html`<frigate-card-next-previous-control
            .direction=${'next'}
            .controlStyle=${this.nextPreviousControlStyle}
            .thumbnail=${neighbors.next.thumbnail}
            .title=${neighbors.next.title}
            @click=${() => this._nextPreviousHandler('next')}
          ></frigate-card-next-previous-control>`
        : ``}
    </div>`;
  }

  /**
   * Fire a media show event when a slide is selected.
   */
  protected _selectSlideMediaShowHandler(): void {
    if (!this._carousel || !this.view) {
      return;
    }

    this._carousel.slidesInView(true).forEach((slideIndex) => {
      if (slideIndex in this._mediaShowInfo) {
        const mediaShowInfo = this._mediaShowInfo[slideIndex];
        if (mediaShowInfo) {
          dispatchExistingMediaShowInfoAsEvent(this, mediaShowInfo);
        }
      }
    });
  }

  /**
   * Handle a media-show event that is generated by a child component, saving the
   * contents for future use when the relevant slide is shown.
   * @param slideIndex The relevant slide index.
   * @param event The media-show event from the child component.
   */
  protected _mediaShowEventHandler(
    slideIndex: number,
    event: CustomEvent<MediaShowInfo>,
  ): void {
    this._mediaShowInfoHandler(slideIndex, event.detail);
    // Don't allow the inbound event to propagate upwards, that will be
    // automatically done at the appropriate time as the slide is shown.
    event.stopPropagation();
  }

  /**
   * Handle a MediaShowInfo object that is generated on media load, by saving it
   * for future, or immediate use, when the relevant slide is displayed.
   * @param slideIndex The relevant slide index.
   * @param mediaShowInfo The MediaShowInfo object generated by the media.
   */
  protected _mediaShowInfoHandler(
    slideIndex: number,
    mediaShowInfo?: MediaShowInfo | null,
  ): void {
    // isValidMediaShowInfo is used to weed out the initial load of the
    // transparent 1x1 placeholders.
    if (mediaShowInfo && isValidMediaShowInfo(mediaShowInfo)) {
      this._mediaShowInfo[slideIndex] = mediaShowInfo;
      if (this._carousel && this._carousel?.slidesInView(true).includes(slideIndex)) {
        dispatchExistingMediaShowInfoAsEvent(this, mediaShowInfo);
      }
    }
  }

  /**
   * Render a given media item.
   * @param mediaToRender The media item to render.
   * @returns A template or void if the item could not be rendered.
   */
  protected _renderMediaItem(
    mediaToRender: BrowseMediaSource,
    slideIndex: number,
  ): TemplateResult | void {
    // media that can be expanded (folders) cannot be resolved to a single media
    // item, skip them.
    if (!this.view || !BrowseMediaUtil.isTrueMedia(mediaToRender)) {
      return;
    }

    const resolvedMedia = this.resolvedMediaCache?.get(mediaToRender.media_content_id);
    if (!resolvedMedia) {
      return;
    }

    return html`
      <div class="embla__slide">
        ${this.view.isClipRelatedView()
          ? resolvedMedia?.mime_type.toLowerCase() == 'application/x-mpegurl'
            ? html`<frigate-card-ha-hls-player
                .hass=${this.hass}
                url=${ifDefined(this.lazyLoad ? undefined : resolvedMedia.url)}
                data-url=${ifDefined(this.lazyLoad ? resolvedMedia.url : undefined)}
                title="${mediaToRender.title}"
                muted
                controls
                playsinline
                allow-exoplayer
                ?autoplay="${this.autoplayClip}"
                @frigate-card:media-show=${(e: CustomEvent<MediaShowInfo>) =>
                  this._mediaShowEventHandler(slideIndex, e)}
              >
              </frigate-card-ha-hls-player>`
            : html`<video
                title="${mediaToRender.title}"
                muted
                controls
                playsinline
                ?autoplay="${this.autoplayClip}"
                @loadedmetadata="${(e: Event) => {
                  this._mediaShowInfoHandler(slideIndex, createMediaShowInfo(e));
                }}"
                @play=${() => dispatchPlayEvent(this)}
                @pause=${() => dispatchPauseEvent(this)}
              >
                <source
                  src=${ifDefined(this.lazyLoad ? undefined : resolvedMedia.url)}
                  data-src=${ifDefined(this.lazyLoad ? resolvedMedia.url : undefined)}
                  type="${resolvedMedia.mime_type}"
                />
              </video>`
          : html`<img
              src=${ifDefined(this.lazyLoad ? IMG_TRANSPARENT_1x1 : resolvedMedia.url)}
              data-src=${ifDefined(this.lazyLoad ? resolvedMedia.url : undefined)}
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
                this._mediaShowInfoHandler(slideIndex, createMediaShowInfo(e));
              }}"
            />`}
      </div>
    `;
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerStyle);
  }
}
