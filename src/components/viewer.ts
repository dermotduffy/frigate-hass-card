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
import { dispatchMessageEvent, renderProgressIndicator } from '../components/message.js';
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
import { contentsChanged, errorToConsole } from '../utils/basic.js';
import { getFullDependentBrowseMediaQueryParametersOrDispatchError } from '../utils/ha/browse-media.js';
import { ResolvedMediaCache, resolveMedia } from '../utils/ha/resolved-media.js';
import { View } from '../view/view.js';
import { MediaQueriesClassifier } from '../view/media-queries-classifier';
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
import { CameraManager } from '../camera/manager.js';
import {
  changeViewToRecentEventsForCameraAndDependents,
  changeViewToRecentRecordingForCameraAndDependents,
} from '../utils/media-to-view.js';
import { ViewMedia } from '../view/media.js';
import { ViewMediaClassifier } from '../view/media-classifier';
import { guard } from 'lit/directives/guard.js';
import { localize } from '../localize/localize.js';
import { MediaQueriesResults } from '../view/media-queries-results.js';

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
  public cameraManager?: CameraManager;

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
      !this.cameraManager
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
          this.cameraManager,
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
          this.cameraManager,
          this.cameras,
          this.view,
          {
            targetView: 'media',
            mediaType: mediaType,
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
      .cameraManager=${this.cameraManager}
      .cameras=${this.cameras}
    >
      <frigate-card-viewer-carousel
        .hass=${this.hass}
        .view=${this.view}
        .cameras=${this.cameras}
        .viewerConfig=${this.viewerConfig}
        .resolvedMediaCache=${this.resolvedMediaCache}
        .cameraManager=${this.cameraManager}
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

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  protected _refMediaCarousel: Ref<FrigateCardMediaCarousel> = createRef();

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
   * Dispatch a clip view that matches the current (snapshot) query.
   * @param index The index of the selected media.
   */
  protected async _dispatchRelatedClipView(index: number): Promise<void> {
    const media = this.view?.queryResults?.getResult(index);

    if (
      !this.hass ||
      !this.view ||
      !this.cameraManager ||
      !media ||
      // If this specific media item has no clip, then do nothing (even if all
      // the other media items do).
      !ViewMediaClassifier.isEvent(media) ||
      // If the event certainly has no clip, don't bother going further. If
      // we're not sure for this camera type (i.e. hasClip() === null) the query
      // will proceed anyway.
      media.hasClip() === false ||
      !MediaQueriesClassifier.areEventQueries(this.view.query)
    ) {
      return;
    }

    // Convert the query to a clips equivalent.
    const clipQuery = this.view.query.clone();
    clipQuery.convertToClipsQueries();

    let results: MediaQueriesResults | null;
    try {
      results = await this.cameraManager.executeMediaQuery(this.hass, clipQuery);
    } catch (e) {
      errorToConsole(e as Error);
      return;
    }

    if (!results) {
      return;
    }

    results.selectResultIfFound((clipMedia) => clipMedia.getID() === media.getID());
    if (!results.hasSelectedResult()) {
      return;
    }

    this.view
      .evolve({
        view: 'media',
        query: clipQuery,
        queryResults: results,
      })
      .dispatchChangeEvent(this);
  }

  /**
   * Handle the user selecting a new slide in the carousel.
   */
  protected _setViewHandler(ev: CustomEvent<CarouselSelect>): void {
    if (ev.detail.index !== this.view?.queryResults?.getSelectedIndex()) {
      this._setViewSelectedIndex(ev.detail.index);
    }
  }

  protected _setViewSelectedIndex(index: number): void {
    // The slide may already be selected on load, so don't dispatch a new view
    // unless necessary.
    this.view
      ?.evolve({
        queryResults: this.view.queryResults?.clone().selectResult(index),
      })
      // Ensure the timeline is able to update its position.
      .mergeInContext({ timeline: { noSetWindow: false } })
      .dispatchChangeEvent(this);
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
    if ((this.view?.queryResults?.getResultsCount() ?? 0) === 0) {
      return dispatchMessageEvent(this, localize('common.no_media'), 'info', {
        icon: 'mdi:multimedia',
      });
    }

    const media = this.view?.queryResults?.getSelectedResult();
    if (!media || !this.cameras) {
      return;
    }

    const [prev, next] = this._getMediaNeighbors();

    const scroll = (direction: 'previous' | 'next'): void => {
      const currentIndex = this.view?.queryResults?.getSelectedIndex() ?? null;
      if (!this.view || !this.view?.queryResults || currentIndex === null) {
        return;
      }
      const newIndex = direction === 'previous' ? currentIndex - 1 : currentIndex + 1;
      if (newIndex >= 0 && newIndex < this.view.queryResults.getResultsCount()) {
        this._setViewSelectedIndex(newIndex);
      }
    };

    return html` <frigate-card-media-carousel
      ${ref(this._refMediaCarousel)}
      .carouselOptions=${guard([this.viewerConfig], () => ({
        draggable: this.viewerConfig?.draggable ?? true,
      }))}
      .carouselPlugins=${guard(
        [this.viewerConfig, this.view?.queryResults?.getResults()],
        this._getPlugins.bind(this),
      )}
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
          scroll('previous');
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
          scroll('next');
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
        ${ViewMediaClassifier.isVideo(media)
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
                  this._dispatchRelatedClipView(index);
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
