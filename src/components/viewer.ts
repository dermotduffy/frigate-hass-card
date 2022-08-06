import { Task } from '@lit-labs/task';
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
import { guard } from 'lit/directives/guard.js';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import {
  dispatchFrigateCardErrorEvent,
  renderProgressIndicator,
} from '../components/message.js';
import viewerStyle from '../scss/viewer.scss';
import viewerCarouselStyle from '../scss/viewer-carousel.scss';
import {
  BrowseMediaNeighbors,
  BrowseMediaQueryParameters,
  CameraConfig,
  ExtendedHomeAssistant,
  FrigateBrowseMediaSource,
  frigateCardConfigDefaults,
  FrigateCardMediaPlayer,
  MediaShowInfo,
  TransitionEffect,
  ViewerConfig,
} from '../types.js';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import { contentsChanged } from '../utils/basic.js';
import {
  fetchLatestMediaAndDispatchViewChange,
  getEventStartTime,
  getFullDependentBrowseMediaQueryParametersOrDispatchError,
  isTrueMedia,
  multipleBrowseMediaQueryMerged,
  overrideMultiBrowseMediaQueryParameters,
} from '../utils/ha/browse-media.js';
import { ResolvedMediaCache, resolveMedia } from '../utils/ha/resolved-media.js';
import { View } from '../view.js';
import { AutoMediaPlugin } from './embla-plugins/automedia.js';
import { Lazyload } from './embla-plugins/lazyload.js';
import {
  FrigateCardMediaCarousel,
  IMG_EMPTY,
  wrapMediaLoadEventForCarousel,
  wrapMediaShowEventForCarousel,
} from './media-carousel.js';
import './next-prev-control.js';
import './title-control.js';
import '../patches/ha-hls-player';
import './surround-thumbnails';
import { EmblaCarouselPlugins } from './carousel.js';

@customElement('frigate-card-viewer')
export class FrigateCardViewer extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public viewerConfig?: ViewerConfig;

  @property({ attribute: false })
  public cameras?: Map<string, CameraConfig>;

  @property({ attribute: false })
  public resolvedMediaCache?: ResolvedMediaCache;

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.view || !this.cameras || !this.viewerConfig) {
      return;
    }

    const browseMediaQueryParameters =
      getFullDependentBrowseMediaQueryParametersOrDispatchError(
        this,
        this.hass,
        this.cameras,
        this.view.camera,
      );

    if (!this.view.target) {
      // If the target is not specified, the view must tell us which mediaType
      // to search for. When the target *is* specified, the view is not required
      // to indicate the media type (e.g. the mixed 'events' view from the
      // timeline).
      const mediaType = this.view.getMediaType();
      if (!browseMediaQueryParameters || !mediaType) {
        return;
      }

      fetchLatestMediaAndDispatchViewChange(
        this,
        this.hass,
        this.view,
        overrideMultiBrowseMediaQueryParameters(browseMediaQueryParameters, {
          mediaType: mediaType,
        }),
      );
      return renderProgressIndicator();
    }

    return html` <frigate-card-surround-thumbnails
      .hass=${this.hass}
      .view=${this.view}
      .config=${this.viewerConfig.controls.thumbnails}
      .cameras=${this.cameras}
    >
      <frigate-card-viewer-carousel
        .hass=${this.hass}
        .view=${this.view}
        .viewerConfig=${this.viewerConfig}
        .browseMediaQueryParameters=${browseMediaQueryParameters}
        .resolvedMediaCache=${this.resolvedMediaCache}
      >
      </frigate-card-viewer-carousel>
    </frigate-card-surround-thumbnails>`;
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerStyle);
  }
}

const FRIGATE_CARD_HLS_SELECTOR = 'frigate-card-ha-hls-player';

@customElement('frigate-card-viewer-carousel')
export class FrigateCardViewerCarousel extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  // Resetting the viewer configuration causes a full reset so ensure the config
  // has actually changed with a full comparison (dynamic configuration
  // overrides may causes changes elsewhere in the full card configuration that
  // could lead to the address of the viewerConfig changing without it being
  // semantically different).
  @property({ attribute: false, hasChanged: contentsChanged })
  public viewerConfig?: ViewerConfig;

  @property({ attribute: false })
  public browseMediaQueryParameters?: BrowseMediaQueryParameters[] | null;

  @property({ attribute: false })
  public resolvedMediaCache?: ResolvedMediaCache;

  protected _refMediaCarousel: Ref<FrigateCardMediaCarousel> = createRef();

  // Mapping of slide # to FrigateBrowseMediaSource child #.
  // (Folders are not media items that can be rendered).
  protected _slideToChild: Record<number, number> = {};

  // A task to resolve target media if lazy loading is disabled.
  protected _mediaResolutionTask = new Task<
    [FrigateBrowseMediaSource | null | undefined],
    void
  >(
    this,
    async ([target]: (FrigateBrowseMediaSource | null | undefined)[]): Promise<void> => {
      for (
        let i = 0;
        !this.viewerConfig?.lazy_load &&
        this.hass &&
        target &&
        target.children &&
        i < (target.children || []).length;
        ++i
      ) {
        if (isTrueMedia(target.children[i])) {
          await resolveMedia(this.hass, target.children[i], this.resolvedMediaCache);
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
    const frigateCardCarousel = this._refMediaCarousel.value?.frigateCardCarousel();

    if (frigateCardCarousel && changedProperties.has('view')) {
      const oldView = changedProperties.get('view') as View | undefined;
      if (oldView) {
        if (
          oldView.target === this.view?.target &&
          this.view.childIndex != oldView.childIndex
        ) {
          const slide = this._getSlideForChild(this.view.childIndex);
          if (
            slide !== null &&
            slide !== frigateCardCarousel.getCarouselSelected()?.index
          ) {
            // If the media target is the same as already loaded, but isn't of
            // the selected slide, scroll to that slide.
            frigateCardCarousel.carouselScrollTo(slide);
          }
        }
      }
    }

    super.updated(changedProperties);
  }

  /**
   * Get the slide number given a media child number.
   * @param childIndex The child index (relative to `view.target`)
   * @returns A number or null if the child is not found.
   */
  protected _getSlideForChild(childIndex: number | null | undefined): number | null {
    if (childIndex === undefined || childIndex === null) {
      return null;
    }
    const slideIndex = Object.keys(this._slideToChild).find(
      (key) => this._slideToChild[key] === childIndex,
    );
    return slideIndex !== undefined ? Number(slideIndex) : null;
  }

  /**
   * Get the transition effect to use.
   * @returns An TransitionEffect object.
   */
  protected _getTransitionEffect(): TransitionEffect {
    return (
      this.viewerConfig?.transition_effect ??
      frigateCardConfigDefaults.media_viewer.transition_effect
    );
  }

  /**
   * Get the Embla options to use.
   * @returns An EmblaOptionsType object or undefined for no options.
   */
  protected _getOptions(): EmblaOptionsType {
    return {
      // Start the carousel on the selected child number.
      startIndex: this._getSlideForChild(this.view?.childIndex) ?? 0,
      draggable: this.viewerConfig?.draggable ?? true,
    };
  }

  /**
   * The the HLS player on a slide (or current slide if not provided.)
   * @param slide An optional slide.
   * @returns The FrigateCardMediaPlayer or null if not found.
   */
  protected _getPlayer(slide?: HTMLElement | null): FrigateCardMediaPlayer | null {
    if (!slide) {
      slide = this._refMediaCarousel.value
        ?.frigateCardCarousel()
        ?.getCarouselSelected()?.element;
    }

    return (
      (slide?.querySelector(FRIGATE_CARD_HLS_SELECTOR) as FrigateCardMediaPlayer) ?? null
    );
  }

  /**
   * Get the Embla plugins to use.
   * @returns A list of EmblaOptionsTypes.
   */
  protected _getPlugins(): EmblaPluginType[] {
    return [
      // Only enable wheel plugin if there is more than one media item.
      ...(this.view &&
      this.view.target &&
      this.view.target.children &&
      this.view.target.children.length > 1
        ? [
            WheelGesturesPlugin({
              // Whether the carousel is vertical or horizontal, interpret y-axis wheel
              // gestures as scrolling for the carousel.
              forceWheelAxis: 'y',
            }),
          ]
        : []),
      Lazyload({
        ...(this.viewerConfig?.lazy_load && {
          lazyLoadCallback: this._lazyloadSlide.bind(this),
        }),
      }),
      AutoMediaPlugin({
        playerSelector: FRIGATE_CARD_HLS_SELECTOR,
        ...(this.viewerConfig?.auto_play && {
          autoPlayCondition: this.viewerConfig.auto_play,
        }),
        ...(this.viewerConfig?.auto_pause && {
          autoPauseCondition: this.viewerConfig.auto_pause,
        }),
        ...(this.viewerConfig?.auto_mute && {
          autoMuteCondition: this.viewerConfig.auto_mute,
        }),
        ...(this.viewerConfig?.auto_unmute && {
          autoUnmuteCondition: this.viewerConfig.auto_unmute,
        }),
      }),
    ];
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
      this.view.childIndex === null
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
    snapshot: FrigateBrowseMediaSource,
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

    const snapshotStartTime = getEventStartTime(snapshot);
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
      if (!isTrueMedia(child)) {
        continue;
      }
      const startTime = getEventStartTime(child);

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

    let clips: FrigateBrowseMediaSource | null;

    const params = overrideMultiBrowseMediaQueryParameters(
      this.browseMediaQueryParameters,
      {
        mediaType: 'clips',
        before: latest,
        after: earliest,
      },
    );

    try {
      clips = await multipleBrowseMediaQueryMerged(this.hass, params);
    } catch (e) {
      // This is best effort.
      return null;
    }

    if (!clips || !clips.children || !clips.children.length) {
      return null;
    }

    for (let i = 0; i < clips.children.length; i++) {
      const child = clips.children[i];
      if (!isTrueMedia(child)) {
        continue;
      }
      const clipStartTime = getEventStartTime(child);
      if (clipStartTime && clipStartTime === snapshotStartTime) {
        return this.view.evolve({
          view: 'clip',
          target: clips,
          childIndex: i,
        });
      }
    }
    return null;
  }

  /**
   * Handle the user selecting a new slide in the carousel.
   */
  protected _setViewHandler(): void {
    if (!this._refMediaCarousel.value || !this.view) {
      return;
    }

    // Update the childIndex in the view.
    const selected = this._refMediaCarousel.value
      .frigateCardCarousel()
      ?.getCarouselSelected()?.index;
    if (selected !== undefined) {
      const childIndex = this._slideToChild[selected];
      if (childIndex !== undefined) {
        this.view
          .evolve({
            childIndex: childIndex,
          })
          .dispatchChangeEvent(this);
      }
    }
  }

  /**
   * Ensure media URLs use the correct HA URL (relevant for Chromecast where the
   * default location will be the Chromecast receiver, not HA).
   * @param url The media URL
   */
  protected _canonicalizeHAURL(url?: string): string | undefined {
    if (this.hass && url && url.startsWith('/')) {
      return this.hass.hassUrl(url);
    }
    return url;
  }

  /**
   * Lazy load a slide.
   * @param index The index of the slide to lazy load.
   * @param slide The slide to lazy load.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _lazyloadSlide(index: number, slide: HTMLElement): void {
    const childIndex: number | undefined = this._slideToChild[index];

    if (
      childIndex === undefined ||
      !this.hass ||
      !this.view ||
      !this.view.target ||
      !this.view.target.children ||
      !isTrueMedia(this.view.target.children[childIndex])
    ) {
      return;
    }

    resolveMedia(
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
      const hls_player = this._getPlayer(slide) as FrigateCardMediaPlayer & {
        url: string;
      };

      if (img) {
        img.src = this._canonicalizeHAURL(resolvedMedia.url) || '';
      } else if (hls_player) {
        hls_player.url = this._canonicalizeHAURL(resolvedMedia.url) || '';
      }
    });
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
    if (!this.viewerConfig?.lazy_load && !this._isMediaFullyResolved()) {
      return html`${this._mediaResolutionTask.render({
        initial: () => renderProgressIndicator(),
        pending: () => renderProgressIndicator(),
        error: (e: unknown) => dispatchFrigateCardErrorEvent(this, e as Error),
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
    if (!slides.length || !this.view?.media) {
      return;
    }

    const neighbors = this._getMediaNeighbors();
    const [prev, next] = [neighbors?.previous, neighbors?.next];

    // Notes on the below:
    // - guard() is used to avoid reseting the carousel unless the
    //   options/plugins actually change.

    return html` <frigate-card-media-carousel
      ${ref(this._refMediaCarousel)}
      .carouselOptions=${guard([this.viewerConfig], this._getOptions.bind(this))}
      .carouselPlugins=${guard(
        [this.viewerConfig, this.view?.target?.children?.length],
        this._getPlugins.bind(this),
      ) as EmblaCarouselPlugins}
      .label="${this.view.media.title}"
      .titlePopupConfig=${this.viewerConfig?.controls.title}
      transitionEffect=${this._getTransitionEffect()}
      @frigate-card:carousel:select=${this._setViewHandler.bind(this)}
      @frigate-card:media-show=${this._recordingSeekHandler.bind(this)}
    >
      <frigate-card-next-previous-control
        slot="previous"
        .hass=${this.hass}
        .direction=${'previous'}
        .controlConfig=${this.viewerConfig?.controls.next_previous}
        .thumbnail=${prev && prev.thumbnail ? prev.thumbnail : undefined}
        .label=${prev ? prev.title : ''}
        ?disabled=${!prev}
        @click=${(ev) => {
          this._refMediaCarousel.value?.frigateCardCarousel()?.carouselScrollPrevious();
          stopEventFromActivatingCardWideActions(ev);
        }}
      ></frigate-card-next-previous-control>
      ${slides}
      <frigate-card-next-previous-control
        slot="next"
        .hass=${this.hass}
        .direction=${'next'}
        .controlConfig=${this.viewerConfig?.controls.next_previous}
        .thumbnail=${next && next.thumbnail ? next.thumbnail : undefined}
        .label=${next ? next.title : ''}
        ?disabled=${!next}
        @click=${(ev) => {
          this._refMediaCarousel.value?.frigateCardCarousel()?.carouselScrollNext();
          stopEventFromActivatingCardWideActions(ev);
        }}
      ></frigate-card-next-previous-control>
    </frigate-card-media-carousel>`;
  }

  /**
   * Fire a media show event when a slide is selected.
   */
  protected _recordingSeekHandler(): void {
    // If this is a recording and play is desired to be started from a
    // particular point, seek to that point. Use the media off the slide itself
    // -- when the slide is changed, the media show event may be dispatched
    // before this.view has been updated to reflect the new selection.
    const player = this._getPlayer() as FrigateCardMediaPlayer & {
      media?: FrigateBrowseMediaSource;
    };
    if (player && player.media && player.media.frigate?.recording?.seek_seconds) {
      player.seek(player.media.frigate.recording.seek_seconds);
    }
  }

  protected _renderMediaItem(
    mediaToRender: FrigateBrowseMediaSource,
    slideIndex: number,
  ): TemplateResult | void {
    // Skip folders as they cannot be rendered by this viewer.
    if (
      !this.hass ||
      !this.view ||
      !this.viewerConfig ||
      !isTrueMedia(mediaToRender) ||
      !['video', 'image'].includes(mediaToRender.media_content_type)
    ) {
      return;
    }

    const lazyLoad = this.viewerConfig.lazy_load;
    const resolvedMedia = this.resolvedMediaCache?.get(mediaToRender.media_content_id);
    if (!resolvedMedia && !lazyLoad) {
      return;
    }

    // The media is attached to the player as '.media' which is used in
    // `_selectSlideMediaShowHandler` (and not used by the player itself).
    return html`
      <div class="embla__slide">
        ${mediaToRender.media_content_type === 'video'
          ? html`<frigate-card-ha-hls-player
              allow-exoplayer
              aria-label="${mediaToRender.title}"
              ?autoplay=${false}
              controls
              muted
              playsinline
              title="${mediaToRender.title}"
              url=${ifDefined(
                lazyLoad ? undefined : this._canonicalizeHAURL(resolvedMedia?.url),
              )}
              .media=${mediaToRender}
              .hass=${this.hass}
              @frigate-card:media-show=${(e: CustomEvent<MediaShowInfo>) => {
                wrapMediaShowEventForCarousel(slideIndex, e);
              }}
            >
            </frigate-card-ha-hls-player>`
          : html`<img
              aria-label="${mediaToRender.title}"
              src=${ifDefined(
                lazyLoad ? IMG_EMPTY : this._canonicalizeHAURL(resolvedMedia?.url),
              )}
              title="${mediaToRender.title}"
              @click=${() => {
                if (
                  this._refMediaCarousel.value
                    ?.frigateCardCarousel()
                    ?.carouselClickAllowed()
                ) {
                  this._findRelatedClipView(mediaToRender).then((view) => {
                    if (view) {
                      view.dispatchChangeEvent(this);
                    }
                  });
                }
              }}
              @load="${(e: Event) => {
                const lazyloadPlugin = this._refMediaCarousel.value
                  ?.frigateCardCarousel()
                  ?.getCarouselPlugins()?.lazyload;
                if (
                  // This handler will be called on the empty image (including
                  // an updated empty image that is the same dimensions large as
                  // the previously fully loaded image -- see the note on dummy
                  // images in media-carousel.ts). Here we need to only call the
                  // media load handler on a 'real' load.
                  !lazyLoad ||
                  lazyloadPlugin?.hasLazyloaded(slideIndex)
                ) {
                  wrapMediaLoadEventForCarousel(slideIndex, e);
                }
              }}"
            />`}
      </div>
    `;
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerCarouselStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-viewer-carousel': FrigateCardViewerCarousel;
    'frigate-card-viewer': FrigateCardViewer;
  }
}
