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
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { renderProgressIndicator } from '../components/message.js';
import viewerStyle from '../scss/viewer.scss';
import viewerCarouselStyle from '../scss/viewer-carousel.scss';
import {
  CameraConfig,
  CardWideConfig,
  ExtendedHomeAssistant,
  frigateCardConfigDefaults,
  FrigateCardMediaPlayer,
  MediaLoadedInfo,
  ResolvedMedia,
  TransitionEffect,
  ViewerConfig,
} from '../types.js';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import { contentsChanged } from '../utils/basic.js';
import { getFullDependentBrowseMediaQueryParametersOrDispatchError } from '../utils/ha/browse-media.js';
import { ResolvedMediaCache, resolveMedia } from '../utils/ha/resolved-media.js';
import { MediaQueriesResults, View } from '../view.js';
import { AutoMediaPlugin } from './embla-plugins/automedia.js';
import { Lazyload } from './embla-plugins/lazyload.js';
import {
  FrigateCardMediaCarousel,
  IMG_EMPTY,
  wrapRawMediaLoadedEventForCarousel,
  wrapMediaLoadedEventForCarousel,
} from './media-carousel.js';
import type { CarouselSelect } from './carousel.js';
import './next-prev-control.js';
import './title-control.js';
import '../patches/ha-hls-player';
import './surround.js';
import { renderTask } from '../utils/task.js';
import { updateElementStyleFromMediaLayoutConfig } from '../utils/media-layout.js';
import { DataManager } from '../utils/data/data-manager.js';
import {
  changeViewToRecentEventsForCameraAndDependents,
  changeViewToRecentRecordingForCameraAndDependents,
} from '../utils/media-to-view.js';
import { ViewMedia, ViewMediaClassifier } from '../view-media.js';
import { guard } from 'lit/directives/guard.js';

export interface MediaSeek {
  // Specifies the point at which this recording should be played, the
  // seek_time is the date of the desired play point (for display purposes
  // usually), and seek_seconds is the number of seconds to seek into the video
  // stream to reach that point.
  seekTime: number;
  seekSeconds: number;
}

export interface MediaViewerViewContext {
  seek: Map<number, MediaSeek>;
}

declare module 'view' {
  interface ViewContext {
    mediaViewer?: MediaViewerViewContext;
  }
}

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

  @property({ attribute: false })
  public dataManager?: DataManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (
      !this.hass ||
      !this.view ||
      !this.cameras ||
      !this.viewerConfig ||
      !this.dataManager
    ) {
      return;
    }

    const browseMediaQueryParameters =
      getFullDependentBrowseMediaQueryParametersOrDispatchError(
        this,
        this.hass,
        this.cameras,
        this.view.camera,
      );

    if (!this.view.queryResults?.hasResults()) {
      // If the query is not specified, the view must tell us which mediaType to
      // search for. When the query *is* specified, the view is not required to
      // indicate the media type (e.g. the mixed 'media' view from the
      // timeline).
      const mediaType = this.view.getDefaultMediaType();
      if (!browseMediaQueryParameters || !mediaType) {
        return;
      }

      if (mediaType === 'recordings') {
        changeViewToRecentRecordingForCameraAndDependents(
          this,
          this.hass,
          this.dataManager,
          this.cameras,
          this.view,
          {
            targetView: 'recording',
          },
        );
      } else {
        changeViewToRecentEventsForCameraAndDependents(
          this,
          this.hass,
          this.dataManager,
          this.cameras,
          this.view,
          {
            targetView: 'media',
          },
        );
      }
      return renderProgressIndicator({ cardWideConfig: this.cardWideConfig });
    }

    return html` <frigate-card-surround
      .hass=${this.hass}
      .view=${this.view}
      .thumbnailConfig=${this.viewerConfig.controls.thumbnails}
      .timelineConfig=${this.viewerConfig.controls.timeline}
      .dataManager=${this.dataManager}
      .cameras=${this.cameras}
    >
      <frigate-card-viewer-carousel
        .hass=${this.hass}
        .view=${this.view}
        .cameras=${this.cameras}
        .viewerConfig=${this.viewerConfig}
        .resolvedMediaCache=${this.resolvedMediaCache}
        .cardWideConfig=${this.cardWideConfig}
      >
      </frigate-card-viewer-carousel>
    </frigate-card-surround>`;
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
  public resolvedMediaCache?: ResolvedMediaCache;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public cameras?: Map<string, CameraConfig>;

  protected _refMediaCarousel: Ref<FrigateCardMediaCarousel> = createRef();

  protected _carouselOptions?: EmblaOptionsType;
  protected _carouselPlugins?: EmblaPluginType[];

  // A task to resolve target media if lazy loading is disabled.
  protected _mediaResolutionTask = new Task<
    [ViewerConfig | undefined, Map<string, CameraConfig> | undefined, View | undefined],
    void
  >(
    this,
    async ([viewerConfig, cameras, view]: [
      ViewerConfig | undefined,
      Map<string, CameraConfig> | undefined,
      View | undefined,
    ]): Promise<void> => {
      if (
        !this.hass ||
        !viewerConfig?.lazy_load ||
        !cameras ||
        !view ||
        !view.queryResults?.hasResults()
      ) {
        return;
      }
      const promises: Promise<ResolvedMedia | null>[] = [];
      view.queryResults?.getResults()?.forEach((media: ViewMedia) => {
        const mediaContentID = media.getContentID(cameras.get(media.getCameraID()));
        if (this.hass && mediaContentID) {
          promises.push(
            resolveMedia(this.hass, mediaContentID, this.resolvedMediaCache),
          );
        }
      });
      await Promise.all(promises);
    },
    () => [this.viewerConfig, this.cameras, this.view],
  );

  /**
   * The updated lifecycle callback for this element.
   * @param changedProperties The properties that were changed in this render.
   */
  updated(changedProperties: PropertyValues): void {
    if (changedProperties.has('view')) {
      const oldView = changedProperties.get('view') as View | undefined;
      // Seek into the video if the seek time has changed (this is also called
      // on media load, since the media may or may not have been loaded at
      // this point).
      if (this.view?.context?.mediaViewer !== oldView?.context?.mediaViewer) {
        this._recordingSeekHandler();
      }
    }
    super.updated(changedProperties);
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
      ...(this.view?.queryResults?.getResultsCount() ?? 0 > 1
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
  protected _getMediaNeighbors(): [ViewMedia | null, ViewMedia | null] {
    const selectedIndex = this.view?.queryResults?.getSelectedIndex() ?? null;
    const resultCount = this.view?.queryResults?.getResultsCount() ?? 0;
    if (!this.view || !this.view.queryResults || selectedIndex === null) {
      return [null, null];
    }

    const previous: ViewMedia | null =
      selectedIndex > 0 ? this.view.queryResults.getResult(selectedIndex - 1) : null;
    const next: ViewMedia | null =
      selectedIndex + 1 < resultCount
        ? this.view.queryResults.getResult(selectedIndex + 1)
        : null;
    return [previous, next];
  }

  /**
   * Get a clip view that matches a given snapshot. Includes clips within the
   * same range as the current view.
   * @param snapshot The snapshot to find a matching clip for.
   * @returns The view that would show the matching clip.
   */
  protected async _createRelatedClipView(targetIndex: number): Promise<View | null> {
    const media = this.view?.queryResults?.getResult(targetIndex);

    if (
      !this.hass ||
      !this.view ||
      !media ||
      // If this specific media item has no clip, then do nothing (even if all
      // the other media items do).
      !ViewMediaClassifier.isFrigateEvent(media) ||
      !media.hasClip() ||
      !this.view.query?.areEventQueries()
    ) {
      return null;
    }

    const newResults: ViewMedia[] = [];
    let newSelectedIndex: number | null = null;

    // Convert the query to a clips equivalent.
    const newQuery = this.view.query.clone();
    newQuery.convertToClipsQueries();

    // Regenerate the whole results stack.
    for (let i = 0; i < (this.view.queryResults?.getResultsCount() ?? 0); ++i) {
      const media = this.view.queryResults?.getResult(i);
      if (!media || !ViewMediaClassifier.isFrigateEvent(media)) {
        continue;
      }
      const clipMedia = media.getClipEquivalent();
      if (clipMedia) {
        newResults.push(clipMedia);
        if (i === targetIndex) {
          newSelectedIndex = i;
        }
      }
    }
    if (newSelectedIndex === null) {
      return null;
    }

    const newQueryResults = new MediaQueriesResults(newResults);
    newQueryResults.selectResult(newSelectedIndex);

    return this.view.evolve({
      view: 'clip',
      query: newQuery,
      queryResults: newQueryResults,
    });
  }

  /**
   * Handle the user selecting a new slide in the carousel.
   */
  protected _setViewHandler(ev: CustomEvent<CarouselSelect>): void {
    if (!this._refMediaCarousel.value || !this.view) {
      return;
    }

    // The slide may already be selected on load, so don't dispatch a new view
    // unless necessary.
    if (ev.detail.index !== this.view.queryResults?.getSelectedIndex()) {
      this.view
        .evolve({
          queryResults: this.view.queryResults?.clone().selectResult(ev.detail.index),
        })
        // Ensure the timeline is able to update its position.
        .mergeInContext({ timeline: { noSetWindow: false } })
        .dispatchChangeEvent(this);
    }
  }

  /**
   * Ensure media URLs use the correct HA URL (relevant for Chromecast where the
   * default location will be the Chromecast receiver, not HA).
   * @param url The media URL
   */
  protected _canonicalizeHAURL(url?: string): string | null {
    if (this.hass && url && url.startsWith('/')) {
      return this.hass.hassUrl(url);
    }
    return url ?? null;
  }

  /**
   * Lazy load a slide.
   * @param index The index of the slide to lazy load.
   * @param slide The slide to lazy load.
   */
  protected _lazyloadSlide(index: number, slide: HTMLElement): void {
    if (!this.hass || !this.view || !this.view.query || !this.cameras) {
      return;
    }

    const media = this.view.queryResults?.getResult(index);
    const mediaContentID = media
      ? media.getContentID(this.cameras.get(media.getCameraID()))
      : null;
    if (!mediaContentID) {
      return;
    }

    resolveMedia(this.hass, mediaContentID, this.resolvedMediaCache).then(
      (resolvedMedia) => {
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
          img.src = this._canonicalizeHAURL(resolvedMedia.url) ?? '';
        } else if (hls_player) {
          hls_player.url = this._canonicalizeHAURL(resolvedMedia.url) ?? '';
        }
      },
    );
  }

  /**
   * Get slides to include in the render.
   * @returns The slides to include in the render.
   */
  protected _getSlides(): TemplateResult[] {
    if (!this.view || !this.view.queryResults) {
      return [];
    }

    const slides: TemplateResult[] = [];
    for (let i = 0; i < this.view.queryResults.getResultsCount(); ++i) {
      const media = this.view.queryResults.getResult(i);
      if (media) {
        const slide = this._renderMediaItem(media, i);
        if (slide) {
          slides[i] = slide;
        }
      }
    }
    return slides;
  }

  /**
   * Determine if all the media in the carousel are resolved.
   */
  protected _isMediaFullyResolved(): boolean {
    if (!this.resolvedMediaCache || !this.cameras) {
      return false;
    }
    for (const media of this.view?.queryResults?.getResults() ?? []) {
      const mediaContentID = media.getContentID(this.cameras.get(media.getCameraID()));
      if (mediaContentID && !this.resolvedMediaCache.has(mediaContentID)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Called when an update will occur.
   * @param changedProps The changed properties
   */
  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('viewerConfig')) {
      updateElementStyleFromMediaLayoutConfig(this, this.viewerConfig?.layout);
    }
    if (!this._carouselOptions || changedProps.has('viewerConfig')) {
      this._carouselOptions = {
        draggable: this.viewerConfig?.draggable ?? true,
      };
    }
    if (
      !this._carouselPlugins ||
      changedProps.has('viewerConfig') ||
      (changedProps.has('view') &&
        this.view?.queryResults?.getResultsCount() !==
          changedProps.get('view')?.queryResults?.getResultsCount())
    ) {
      this._carouselPlugins = this._getPlugins();
    }
  }

  /**
   * Render the element, resolving the media first if necessary.
   */
  protected render(): TemplateResult | void {
    // If lazy loading is not enabled, wait for the media resolver task to
    // complete and show a progress indictator until this.
    if (!this.viewerConfig?.lazy_load && !this._isMediaFullyResolved()) {
      return renderTask(this, this._mediaResolutionTask, this._render.bind(this), {
        cardWideConfig: this.cardWideConfig,
      });
    }
    return this._render();
  }

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected _render(): TemplateResult | void {
    const media = this.view?.queryResults?.getSelectedResult();
    if (!media || !this.cameras) {
      return;
    }

    const [prev, next] = this._getMediaNeighbors();

    return html` <frigate-card-media-carousel
      ${ref(this._refMediaCarousel)}
      .carouselOptions=${this._carouselOptions}
      .carouselPlugins=${this._carouselPlugins}
      .label=${media.getTitle() ?? undefined}
      .titlePopupConfig=${this.viewerConfig?.controls.title}
      .selected=${this.view?.queryResults?.getSelectedIndex() ?? 0}
      transitionEffect=${this._getTransitionEffect()}
      @frigate-card:media-carousel:select=${this._setViewHandler.bind(this)}
      @frigate-card:media:loaded=${this._recordingSeekHandler.bind(this)}
    >
      <frigate-card-next-previous-control
        slot="previous"
        .hass=${this.hass}
        .direction=${'previous'}
        .controlConfig=${this.viewerConfig?.controls.next_previous}
        .thumbnail=${prev?.getThumbnail(this.cameras.get(prev.getCameraID())) ??
        undefined}
        .label=${prev?.getTitle() ?? ''}
        ?disabled=${!prev}
        @click=${(ev) => {
          this._refMediaCarousel.value?.frigateCardCarousel()?.carouselScrollPrevious();
          stopEventFromActivatingCardWideActions(ev);
        }}
      ></frigate-card-next-previous-control>
      ${guard(this.view?.queryResults?.getResults(), () => this._getSlides())}
      <frigate-card-next-previous-control
        slot="next"
        .hass=${this.hass}
        .direction=${'next'}
        .controlConfig=${this.viewerConfig?.controls.next_previous}
        .thumbnail=${next?.getThumbnail(this.cameras.get(next.getCameraID())) ??
        undefined}
        .label=${next?.getTitle() ?? ''}
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
    const selectedIndex = this.view?.queryResults?.getSelectedIndex() ?? null;
    const seek =
    selectedIndex !== null
        ? this.view?.context?.mediaViewer?.seek.get(selectedIndex)
        : null;
    const player = this._getPlayer();
    if (player && seek) {
      player.seek(seek.seekSeconds);
    }
  }

  /**
   * Render a single media item in the viewer carousel.
   * @param media The ViewMedia to render.
   * @param index The (slide|queryResult) index of the item to render.
   * @returns A rendered template.
   */
  protected _renderMediaItem(media: ViewMedia, index: number): TemplateResult | null {
    // Skip folders as they cannot be rendered by this viewer.
    if (!this.hass || !this.view || !this.viewerConfig || !this.cameras) {
      return null;
    }

    const lazyLoad = this.viewerConfig.lazy_load;
    const mediaContentID = media.getContentID(this.cameras.get(media.getCameraID()));
    const resolvedMedia = mediaContentID
      ? this.resolvedMediaCache?.get(mediaContentID)
      : null;
    if (!resolvedMedia && !lazyLoad) {
      return null;
    }

    // The media is attached to the player as '.media' which is used in
    // `_selectSlideMediaShowHandler` (and not used by the player itself).
    return html`
      <div class="embla__slide">
        ${media.isVideo()
          ? html`<frigate-card-ha-hls-player
              allow-exoplayer
              aria-label="${media.getTitle() ?? ''}"
              ?autoplay=${false}
              controls
              muted
              playsinline
              title="${media.getTitle() ?? ''}"
              url=${ifDefined(
                lazyLoad ? undefined : this._canonicalizeHAURL(resolvedMedia?.url) ?? '',
              )}
              .hass=${this.hass}
              @frigate-card:media:loaded=${(e: CustomEvent<MediaLoadedInfo>) => {
                wrapMediaLoadedEventForCarousel(index, e);
              }}
            >
            </frigate-card-ha-hls-player>`
          : html`<img
              aria-label="${media.getTitle() ?? ''}"
              src=${ifDefined(
                lazyLoad ? IMG_EMPTY : this._canonicalizeHAURL(resolvedMedia?.url) ?? '',
              )}
              title="${media.getTitle() ?? ''}"
              @click=${() => {
                if (
                  this._refMediaCarousel.value
                    ?.frigateCardCarousel()
                    ?.carouselClickAllowed() &&
                  this.viewerConfig?.snapshot_click_plays_clip
                ) {
                  this._createRelatedClipView(index).then((view) => {
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
                  lazyloadPlugin?.hasLazyloaded(index)
                ) {
                  wrapRawMediaLoadedEventForCarousel(index, e);
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
