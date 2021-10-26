import {
  CSSResultGroup,
  LitElement,
  TemplateResult,
  html,
  unsafeCSS,
  PropertyValues,
} from 'lit';
import EmblaCarousel, { EmblaCarouselType } from 'embla-carousel';
import { HomeAssistant } from 'custom-card-helpers';
import { customElement, property } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';

import dayjs from 'dayjs';
import dayjs_custom_parse_format from 'dayjs/plugin/customParseFormat.js';

import type {
  BrowseMediaNeighbors,
  BrowseMediaQueryParameters,
  BrowseMediaSource,
  ExtendedHomeAssistant,
  NextPreviousControlStyle,
} from '../types.js';
import { ResolvedMediaCache, ResolvedMediaUtil } from '../resolved-media.js';
import { localize } from '../localize/localize.js';
import {
  browseMediaQuery,
  dispatchErrorMessageEvent,
  dispatchMediaLoadEvent,
  dispatchMessageEvent,
  dispatchPauseEvent,
  dispatchPlayEvent,
  getFirstTrueMediaChildIndex,
  isTrueMedia,
} from '../common.js';

import { View } from '../view.js';
import { renderProgressIndicator } from '../components/message.js';

import './next-prev-control.js';

import viewerStyle from '../scss/viewer.scss';

// Load dayjs plugin(s).
dayjs.extend(dayjs_custom_parse_format);

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

  protected render(): TemplateResult | void {
    return html`${until(this._render(), renderProgressIndicator())}`;
  }

  /**
   * Resolve all the given media for a target.
   * @param target The target to resolve media from.
   * @returns True if the resolutions were all error free.
   */
  protected async _resolveAllMediaForTarget(target: BrowseMediaSource): Promise<boolean> {
    if (!this.hass) {
      return false;
    }

    let errorFree = true;
    for (let i = 0; target.children && i < (target.children || []).length; ++i) {
      if (isTrueMedia(target.children[i])) {
        errorFree &&= !!(await ResolvedMediaUtil.resolveMedia(
          this.hass,
          target.children[i],
          this.resolvedMediaCache,
        ));
      }
    }
    return errorFree;
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
    let view = this.view;

    if (!view.target) {
      let parent: BrowseMediaSource | null = null;
      try {
        parent = await browseMediaQuery(this.hass, this.browseMediaQueryParameters);
      } catch (e) {
        return dispatchErrorMessageEvent(this, (e as Error).message);
      }
      const childIndex = getFirstTrueMediaChildIndex(parent);
      if (!parent || !parent.children || childIndex == null) {
        return dispatchMessageEvent(
          this,
          this.view.is('clip')
            ? localize('common.no_clip')
            : localize('common.no_snapshot'),
          this.view.is('clip') ? 'mdi:filmstrip-off' : 'mdi:camera-off',
        );
      }
      view = new View({
        view: this.view.view,
        target: parent,
        childIndex: childIndex,
      });

      // In this block, no clip has been manually selected, so this is loading
      // the most recent clip on card load. In this mode, autoplay of the clip
      // may be disabled by configuration. If does not make sense to disable
      // autoplay when the user has explicitly picked an event to play in the
      // gallery.
      autoplay = this.autoplayClip ?? true;
    }

    if (view.target && !(await this._resolveAllMediaForTarget(view.target))) {
      return dispatchErrorMessageEvent(this, localize('error.could_not_resolve'));
    }

    return html` <frigate-card-viewer-core
      .view=${view}
      .nextPreviousControlStyle=${this.nextPreviousControlStyle}
      .resolvedMediaCache=${this.resolvedMediaCache}
      .autoplayClip=${autoplay}
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

  // Media carousel object.
  protected _carousel?: EmblaCarouselType;
  protected _loadedCarousel = false;

  // Mapping of slide # to BrowseMediaSource child #.
  // (Folders are not media items that can be rendered).
  protected _slideToChild: Record<number, number> = {};

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
      this._carousel.on('select', this._slideSelectHandler.bind(this));
    }
  }

  /**
   * Get the event start time from a media object.
   * @param browseMedia The media object to extract the start time from.
   * @returns The start time in unix/epoch time, or null if it cannot be determined.
   */
  protected _extractEventStartTimeFromBrowseMedia(
    browseMedia: BrowseMediaSource,
  ): number | null {
    // Example: 2021-08-27 20:57:22 [10s, Person 76%]
    const result = browseMedia.title.match(/^(?<iso_datetime>.+) \[/);
    if (result && result.groups) {
      const iso_datetime_str = result.groups['iso_datetime'];
      if (iso_datetime_str) {
        const iso_datetime = dayjs(iso_datetime_str, 'YYYY-MM-DD HH:mm:ss', true);
        if (iso_datetime.isValid()) {
          return iso_datetime.unix();
        }
      }
    }
    return null;
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
      if (media && isTrueMedia(media)) {
        prevIndex = i;
        break;
      }
    }

    // Work forwards from the index to get the next real media.
    let nextIndex: number | null = null;
    for (let i = this.view.childIndex + 1; i < this.view.target.children.length; i++) {
      const media = this.view.target.children[i];
      if (media && isTrueMedia(media)) {
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
    if (!this.hass ||
        !this.view ||
        !this.view.target ||
        !this.view.target.children ||
        !this.view.target.children.length ||
        !this.browseMediaQueryParameters) {
      return null;
    }

    const snapshotStartTime = this._extractEventStartTimeFromBrowseMedia(snapshot);
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
    let earliest: number | null = null, latest: number | null = null;
    for (let i = 0; i < this.view.target.children.length; i++) {
      const child = this.view.target.children[i];
      if (!isTrueMedia(child)) {
        continue;
      }
      const startTime = this._extractEventStartTimeFromBrowseMedia(child);

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
      clips = await browseMediaQuery(this.hass, {
        ...this.browseMediaQueryParameters,
        mediaType: 'clips',
        before: latest,
        after: earliest,
      });
    } catch (e) {
      // This is best effort.
      return null
    }

    console.info(clips);
    if (!clips || !clips.children || !clips.children.length) {
      return null;
    }

    for (let i = 0; i < clips.children.length; i++) {
      const child = clips.children[i];
      if (!isTrueMedia(child)) {
        continue;
      }
      const clipStartTime = this._extractEventStartTimeFromBrowseMedia(child);
      if (clipStartTime && clipStartTime === snapshotStartTime) {
        return new View({
          view: 'clip',
          target: clips,
          childIndex: i,
          previous: this.view
        });
      }
    }
    return null;
  }

  /** 
   * Handle the user selecting a new slide in the carousel.
   */
  protected _slideSelectHandler(): void {
    if (!this._carousel || !this.view) {
      return;
    }

    // Update the childIndex in the view (without re-render)
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
    console.info(`next/prev handler: ${direction}`);
    if (direction == 'previous') {
      this._carousel?.scrollPrev();
    } else if (direction == 'next') {
      this._carousel?.scrollNext();
    }
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
      const slide = this._renderMediaItem(this.view.target.children[i]);
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
   * Render a given media item.
   * @param mediaToRender The media item to render.
   * @returns A template or void if the item could not be rendered.
   */
  protected _renderMediaItem(mediaToRender: BrowseMediaSource): TemplateResult | void {
    // media that can be expanded (folders) cannot be resolved to a single media
    // item, skip them.
    if (!this.view || !isTrueMedia(mediaToRender)) {
      return;
    }

    const resolvedMedia = this.resolvedMediaCache?.get(mediaToRender.media_content_id);
    if (!resolvedMedia) {
      return;
    }

    return html`
      <div class="embla__slide">
        ${this.view.is('clip')
          ? resolvedMedia?.mime_type.toLowerCase() == 'application/x-mpegurl'
            ? html`<frigate-card-ha-hls-player
                .hass=${this.hass}
                .url=${resolvedMedia.url}
                title="${mediaToRender.title}"
                muted
                controls
                playsinline
                allow-exoplayer
                ?autoplay="${this.autoplayClip}"
              >
              </frigate-card-ha-hls-player>`
            : html`<video
                title="${mediaToRender.title}"
                muted
                controls
                playsinline
                ?autoplay="${this.autoplayClip}"
                @loadedmetadata="${(e) => dispatchMediaLoadEvent(this, e)}"
                @play=${() => dispatchPlayEvent(this)}
                @pause=${() => dispatchPauseEvent(this)}
              >
                <source src="${resolvedMedia.url}" type="${resolvedMedia.mime_type}" />
              </video>`
          : html`<img
              src=${resolvedMedia.url}
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
              @load=${(e) => {
                dispatchMediaLoadEvent(this, e);
              }}
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
