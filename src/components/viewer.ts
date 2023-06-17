import { EmblaPluginType } from 'embla-carousel';
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
import { guard } from 'lit/directives/guard.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { CameraManager } from '../camera-manager/manager.js';
import { dispatchMessageEvent, renderProgressIndicator } from '../components/message.js';
import { localize } from '../localize/localize.js';
import '../patches/ha-hls-player';
import viewerCarouselStyle from '../scss/viewer-carousel.scss';
import viewerProviderStyle from '../scss/viewer-provider.scss';
import viewerStyle from '../scss/viewer.scss';
import {
  CardWideConfig,
  ExtendedHomeAssistant,
  frigateCardConfigDefaults,
  FrigateCardMediaPlayer,
  MediaLoadedInfo,
  TransitionEffect,
  ViewerConfig,
} from '../types.js';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import { mayHaveAudio } from '../utils/audio.js';
import { contentsChanged, errorToConsole } from '../utils/basic.js';
import { canonicalizeHAURL } from '../utils/ha/index.js';
import { ResolvedMediaCache, resolveMedia } from '../utils/ha/resolved-media.js';
import {
  dispatchMediaLoadedEvent,
  dispatchMediaPauseEvent,
  dispatchMediaPlayEvent,
  dispatchMediaVolumeChangeEvent,
} from '../utils/media-info.js';
import { updateElementStyleFromMediaLayoutConfig } from '../utils/media-layout.js';
import {
  changeViewToRecentEventsForCameraAndDependents,
  changeViewToRecentRecordingForCameraAndDependents,
} from '../utils/media-to-view.js';
import {
  hideMediaControlsTemporarily,
  MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
  playMediaMutingIfNecessary,
  setControlsOnVideo,
} from '../utils/media.js';
import { screenshotMedia } from '../utils/screenshot.js';
import { ViewMediaClassifier } from '../view/media-classifier';
import { MediaQueriesClassifier } from '../view/media-queries-classifier';
import { MediaQueriesResults } from '../view/media-queries-results.js';
import { VideoContentType, ViewMedia } from '../view/media.js';
import { View } from '../view/view.js';
import type { CarouselSelect } from './carousel.js';
import { AutoMediaPlugin } from './embla-plugins/automedia.js';
import { Lazyload } from './embla-plugins/lazyload.js';
import {
  FrigateCardMediaCarousel,
  wrapMediaLoadedEventForCarousel,
} from './media-carousel.js';
import './next-prev-control.js';
import './surround.js';
import './title-control.js';

export interface MediaViewerViewContext {
  seek?: Date;
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
      !this.viewerConfig ||
      !this.cameraManager ||
      !this.cardWideConfig
    ) {
      return;
    }

    if (!this.view.queryResults?.hasResults()) {
      // If the query is not specified, the view must tell us which mediaType to
      // search for. When the query *is* specified, the view is not required to
      // indicate the media type (e.g. the mixed 'media' view from the
      // timeline).
      const mediaType = this.view.getDefaultMediaType();
      if (!mediaType) {
        return;
      }

      if (mediaType === 'recordings') {
        changeViewToRecentRecordingForCameraAndDependents(
          this,
          this.hass,
          this.cameraManager,
          this.cardWideConfig,
          this.view,
          {
            targetView: 'recording',
            select: 'latest',
          },
        );
      } else {
        changeViewToRecentEventsForCameraAndDependents(
          this,
          this.hass,
          this.cameraManager,
          this.cardWideConfig,
          this.view,
          {
            targetView: 'media',
            mediaType: mediaType,
            select: 'latest',
          },
        );
      }
      return renderProgressIndicator({ cardWideConfig: this.cardWideConfig });
    }

    return html`
      <frigate-card-viewer-carousel
        .hass=${this.hass}
        .view=${this.view}
        .viewerConfig=${this.viewerConfig}
        .resolvedMediaCache=${this.resolvedMediaCache}
        .cameraManager=${this.cameraManager}
        .cardWideConfig=${this.cardWideConfig}
      >
      </frigate-card-viewer-carousel>
    `;
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerStyle);
  }
}

const FRIGATE_CARD_VIEWER_PROVIDER = 'frigate-card-viewer-provider';

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
  public cameraManager?: CameraManager;

  protected _refMediaCarousel: Ref<FrigateCardMediaCarousel> = createRef();

  /**
   * The updated lifecycle callback for this element.
   * @param changedProperties The properties that were changed in this render.
   */
  updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (changedProperties.has('view')) {
      const oldView = changedProperties.get('view') as View | undefined;
      // Seek into the video if the seek time has changed (this is also called
      // on media load, since the media may or may not have been loaded at
      // this point).
      if (this.view?.context?.mediaViewer !== oldView?.context?.mediaViewer) {
        this._seekHandler();
      }
    }
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
      (slide?.querySelector(
        FRIGATE_CARD_VIEWER_PROVIDER,
      ) as unknown as FrigateCardMediaPlayer) ?? null
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
          lazyLoadCallback: (_index, slide) => this._lazyloadSlide(slide),
        }),
      }),
      AutoMediaPlugin({
        playerSelector: FRIGATE_CARD_VIEWER_PROVIDER,
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

  protected _setViewHandler(ev: CustomEvent<CarouselSelect>): void {
    this._setViewSelectedIndex(ev.detail.index);
  }

  protected _setViewSelectedIndex(index: number): void {
    if (!this.view?.queryResults) {
      return;
    }

    const selectedIndex = this.view.queryResults.getSelectedIndex();
    if (selectedIndex === null || selectedIndex === index) {
      // The slide may already be selected on load, so don't dispatch a new view
      // unless necessary (i.e. the new index is different from the current
      // index).
      return;
    }

    const newResults = this.view?.queryResults?.clone().selectResult(index);
    if (!newResults) {
      return;
    }
    const cameraID = newResults.getSelectedResult()?.getCameraID();

    this.view
      ?.evolve({
        queryResults: newResults,

        // Always change the camera to the owner of the selected media.
        ...(cameraID && { camera: cameraID }),
      })
      .dispatchChangeEvent(this);
  }

  /**
   * Lazy load a slide.
   * @param slide The slide to lazy load.
   */
  protected _lazyloadSlide(slide: Element): void {
    if (slide instanceof HTMLSlotElement) {
      slide = slide.assignedElements({ flatten: true })[0];
    }

    const viewerProvider = slide?.querySelector(
      'frigate-card-viewer-provider',
    ) as FrigateCardViewerProvider | null;
    if (viewerProvider) {
      viewerProvider.disabled = false;
    }
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
   * Called when an update will occur.
   * @param changedProps The changed properties
   */
  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('viewerConfig')) {
      updateElementStyleFromMediaLayoutConfig(this, this.viewerConfig?.layout);
    }
  }

  protected render(): TemplateResult | void {
    const resultCount = this.view?.queryResults?.getResultsCount() ?? 0;
    if (!resultCount) {
      return dispatchMessageEvent(this, localize('common.no_media'), 'info', {
        icon: 'mdi:multimedia',
      });
    }

    // If there's no selected media, just choose the last (most recent one) to
    // avoid rendering a blank. This situation should not occur in practice, as
    // this view should not be called without a selected media.
    const media =
      this.view?.queryResults?.getSelectedResult() ??
      this.view?.queryResults?.getResult(resultCount - 1);
    if (
      !this.hass ||
      !this.cameraManager ||
      !media ||
      !this.view ||
      !this.view.queryResults
    ) {
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

    const cameraMetadata = this.cameraManager.getCameraMetadata(
      this.hass,
      media.getCameraID(),
    );

    return html` <frigate-card-media-carousel
      ${ref(this._refMediaCarousel)}
      .carouselOptions=${guard([this.viewerConfig], () => ({
        draggable: this.viewerConfig?.draggable ?? true,
      }))}
      .carouselPlugins=${guard(
        [this.viewerConfig, this.view.queryResults.getResults()],
        this._getPlugins.bind(this),
      )}
      .label=${media.getTitle() ?? undefined}
      .logo=${cameraMetadata?.engineLogo}
      .titlePopupConfig=${this.viewerConfig?.controls.title}
      .selected=${this.view?.queryResults?.getSelectedIndex() ?? 0}
      transitionEffect=${this._getTransitionEffect()}
      @frigate-card:media-carousel:select=${this._setViewHandler.bind(this)}
      @frigate-card:media:loaded=${this._seekHandler.bind(this)}
    >
      <frigate-card-next-previous-control
        slot="previous"
        .hass=${this.hass}
        .direction=${'previous'}
        .controlConfig=${this.viewerConfig?.controls.next_previous}
        .thumbnail=${prev?.getThumbnail() ?? undefined}
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
        .thumbnail=${next?.getThumbnail() ?? undefined}
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
  protected async _seekHandler(): Promise<void> {
    const seek = this.view?.context?.mediaViewer?.seek;
    const media = this.view?.queryResults?.getSelectedResult();
    if (!this.hass || !media || !seek) {
      return;
    }

    const seekTime =
      (await this.cameraManager?.getMediaSeekTime(this.hass, media, seek)) ?? null;
    const player = this._getPlayer();
    if (player && seekTime !== null) {
      player.seek(seekTime);
    }
  }

  /**
   * Render a single media item in the viewer carousel.
   * @param media The ViewMedia to render.
   * @param index The (slide|queryResult) index of the item to render.
   * @returns A rendered template.
   */
  protected _renderMediaItem(media: ViewMedia, index: number): TemplateResult | null {
    if (!this.hass || !this.view || !this.viewerConfig) {
      return null;
    }

    return html` <div class="embla__slide">
      <frigate-card-viewer-provider
        .hass=${this.hass}
        .view=${this.view}
        .media=${media}
        .viewerConfig=${this.viewerConfig}
        .resolvedMediaCache=${this.resolvedMediaCache}
        .cameraManager=${this.cameraManager}
        .disabled=${this.viewerConfig.lazy_load}
        .cardWideConfig=${this.cardWideConfig}
        @frigate-card:media:loaded=${(e: CustomEvent<MediaLoadedInfo>) => {
          wrapMediaLoadedEventForCarousel(index, e);
        }}
      ></frigate-card-viewer-provider>
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerCarouselStyle);
  }
}

@customElement(FRIGATE_CARD_VIEWER_PROVIDER)
export class FrigateCardViewerProvider
  extends LitElement
  implements FrigateCardMediaPlayer
{
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public media?: ViewMedia;

  @property({ attribute: false })
  public viewerConfig?: ViewerConfig;

  @property({ attribute: false })
  public resolvedMediaCache?: ResolvedMediaCache;

  // Whether or not to disable this entity. If `true`, no contents are rendered
  // until this attribute is set to `false` (this is useful for lazy loading).
  @property({ attribute: false })
  public disabled = false;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected _refFrigateCardMediaPlayer: Ref<Element & FrigateCardMediaPlayer> =
    createRef();
  protected _refVideoProvider: Ref<HTMLVideoElement> = createRef();
  protected _refImageProvider: Ref<HTMLImageElement> = createRef();

  public async play(): Promise<void> {
    await playMediaMutingIfNecessary(
      this,
      this._refFrigateCardMediaPlayer.value ?? this._refVideoProvider.value,
    );
  }

  public async pause(): Promise<void> {
    (this._refFrigateCardMediaPlayer.value || this._refVideoProvider.value)?.pause();
  }

  public async mute(): Promise<void> {
    if (this._refFrigateCardMediaPlayer.value) {
      this._refFrigateCardMediaPlayer.value?.mute();
    } else if (this._refVideoProvider.value) {
      this._refVideoProvider.value.muted = true;
    }
  }

  public async unmute(): Promise<void> {
    if (this._refFrigateCardMediaPlayer.value) {
      this._refFrigateCardMediaPlayer.value?.mute();
    } else if (this._refVideoProvider.value) {
      this._refVideoProvider.value.muted = false;
    }
  }

  public isMuted(): boolean {
    if (this._refFrigateCardMediaPlayer.value) {
      return this._refFrigateCardMediaPlayer.value?.isMuted() ?? true;
    } else if (this._refVideoProvider.value) {
      return this._refVideoProvider.value.muted;
    }
    return true;
  }

  public async seek(seconds: number): Promise<void> {
    if (this._refFrigateCardMediaPlayer.value) {
      return this._refFrigateCardMediaPlayer.value.seek(seconds);
    } else if (this._refVideoProvider.value) {
      hideMediaControlsTemporarily(this._refVideoProvider.value);
      this._refVideoProvider.value.currentTime = seconds;
    }
  }

  public async setControls(controls?: boolean): Promise<void> {
    if (this._refFrigateCardMediaPlayer.value) {
      return this._refFrigateCardMediaPlayer.value.setControls(controls);
    } else if (this._refVideoProvider.value) {
      setControlsOnVideo(
        this._refVideoProvider.value,
        controls ?? this.viewerConfig?.controls.builtin ?? true,
      );
    }
  }

  public isPaused(): boolean {
    if (this._refFrigateCardMediaPlayer.value) {
      return this._refFrigateCardMediaPlayer.value.isPaused();
    } else if (this._refVideoProvider.value) {
      return this._refVideoProvider.value.paused;
    }
    return true;
  }

  public async getScreenshotURL(): Promise<string | null> {
    if (this._refFrigateCardMediaPlayer.value) {
      return await this._refFrigateCardMediaPlayer.value.getScreenshotURL();
    } else if (this._refVideoProvider.value) {
      return screenshotMedia(this._refVideoProvider.value);
    } else if (this._refImageProvider.value) {
      return this._refImageProvider.value.src;
    }
    return null;
  }

  /**
   * Dispatch a clip view that matches the current (snapshot) query.
   */
  protected async _dispatchRelatedClipView(): Promise<void> {
    if (
      !this.hass ||
      !this.view ||
      !this.cameraManager ||
      !this.media ||
      // If this specific media item has no clip, then do nothing (even if all
      // the other media items do).
      !ViewMediaClassifier.isEvent(this.media) ||
      !MediaQueriesClassifier.areEventQueries(this.view.query)
    ) {
      return;
    }

    // Convert the query to a clips equivalent.
    const clipQuery = this.view.query.clone();
    clipQuery.convertToClipsQueries();

    const queries = clipQuery.getQueries();
    if (!queries) {
      return;
    }

    let mediaArray: ViewMedia[] | null;
    try {
      mediaArray = await this.cameraManager.executeMediaQueries(this.hass, queries);
    } catch (e) {
      errorToConsole(e as Error);
      return;
    }
    if (!mediaArray) {
      return;
    }

    const results = new MediaQueriesResults(mediaArray);
    results.selectResultIfFound(
      (clipMedia) => clipMedia.getID() === this.media?.getID(),
    );
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

  protected willUpdate(changedProps: PropertyValues): void {
    const mediaContentID = this.media ? this.media.getContentID() : null;

    if (
      (changedProps.has('disabled') ||
        changedProps.has('media') ||
        changedProps.has('viewerConfig') ||
        changedProps.has('resolvedMediaCache') ||
        changedProps.has('hass')) &&
      this.hass &&
      mediaContentID &&
      !this.resolvedMediaCache?.has(mediaContentID) &&
      (!this.viewerConfig?.lazy_load || !this.disabled)
    ) {
      resolveMedia(this.hass, mediaContentID, this.resolvedMediaCache).then(() => {
        this.requestUpdate();
      });
    }

    if (changedProps.has('viewerConfig') && this.viewerConfig?.zoomable) {
      import('./zoomer.js');
    }
  }

  protected _useZoomIfRequired(template: TemplateResult): TemplateResult {
    return this.viewerConfig?.zoomable
      ? html` <frigate-card-zoomer
          @frigate-card:zoom:zoomed=${() => this.setControls(false)}
          @frigate-card:zoom:unzoomed=${() => this.setControls()}
        >
          ${template}
        </frigate-card-zoomer>`
      : template;
  }

  protected render(): TemplateResult | void {
    if (this.disabled || !this.media || !this.hass || !this.view || !this.viewerConfig) {
      return;
    }

    const mediaContentID = this.media.getContentID();
    const resolvedMedia = mediaContentID
      ? this.resolvedMediaCache?.get(mediaContentID)
      : null;
    if (!resolvedMedia) {
      // Media will be resolved with the call in willUpdate() then this will be
      // re-rendered.
      return renderProgressIndicator({
        cardWideConfig: this.cardWideConfig,
      });
    }

    // Note: crossorigin="anonymous" is required on <video> below in order to
    // allow screenshot of motionEye videos which currently go cross-origin.
    return this._useZoomIfRequired(html`
      ${ViewMediaClassifier.isVideo(this.media)
        ? this.media.getVideoContentType() === VideoContentType.HLS
          ? html`<frigate-card-ha-hls-player
              ${ref(this._refFrigateCardMediaPlayer)}
              allow-exoplayer
              aria-label="${this.media.getTitle() ?? ''}"
              ?autoplay=${false}
              controls
              muted
              playsinline
              title="${this.media.getTitle() ?? ''}"
              url=${canonicalizeHAURL(this.hass, resolvedMedia?.url) ?? ''}
              .hass=${this.hass}
              ?controls=${this.viewerConfig.controls.builtin}
            >
            </frigate-card-ha-hls-player>`
          : html`
              <video
                ${ref(this._refVideoProvider)}
                aria-label="${this.media.getTitle() ?? ''}"
                title="${this.media.getTitle() ?? ''}"
                muted
                playsinline
                crossorigin="anonymous"
                ?autoplay=${false}
                ?controls=${this.viewerConfig.controls.builtin}
                @loadedmetadata=${(ev: Event) => {
                  if (ev.target && !!this.viewerConfig?.controls.builtin) {
                    hideMediaControlsTemporarily(
                      ev.target as HTMLVideoElement,
                      MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
                    );
                  }
                }}
                @loadeddata=${(ev: Event) => {
                  dispatchMediaLoadedEvent(this, ev, {
                    player: this,
                    capabilities: {
                      supportsPause: true,
                      hasAudio: mayHaveAudio(ev.target as HTMLVideoElement),
                    },
                  });
                }}
                @volumechange=${() => dispatchMediaVolumeChangeEvent(this)}
                @play=${() => dispatchMediaPlayEvent(this)}
                @pause=${() => dispatchMediaPauseEvent(this)}
              >
                <source
                  src=${canonicalizeHAURL(this.hass, resolvedMedia?.url) ?? ''}
                  type="video/mp4"
                />
              </video>
            `
        : html`<img
            ${ref(this._refImageProvider)}
            aria-label="${this.media.getTitle() ?? ''}"
            src="${canonicalizeHAURL(this.hass, resolvedMedia?.url) ?? ''}"
            title="${this.media.getTitle() ?? ''}"
            @click=${() => {
              if (this.viewerConfig?.snapshot_click_plays_clip) {
                this._dispatchRelatedClipView();
              }
            }}
            @load=${(ev: Event) => {
              dispatchMediaLoadedEvent(this, ev, { player: this });
            }}
          />`}
    `);
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerProviderStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-viewer-carousel': FrigateCardViewerCarousel;
    'frigate-card-viewer': FrigateCardViewer;
    FRIGATE_CARD_VIEWER_PROVIDER: FrigateCardViewerProvider;
  }
}
