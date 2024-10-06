import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { CameraManager } from '../camera-manager/manager.js';
import { RemoveContextPropertyViewModifier } from '../card-controller/view/modifiers/remove-context-property.js';
import { ViewManagerEpoch } from '../card-controller/view/types.js';
import { MediaActionsController } from '../components-lib/media-actions-controller.js';
import { MediaGridSelected } from '../components-lib/media-grid-controller.js';
import { ZoomSettingsObserved } from '../components-lib/zoom/types.js';
import { handleZoomSettingsObservedEvent } from '../components-lib/zoom/zoom-view-context.js';
import {
  dispatchMessageEvent,
  renderMessage,
  renderProgressIndicator,
} from '../components/message.js';
import {
  CardWideConfig,
  frigateCardConfigDefaults,
  TransitionEffect,
  ViewerConfig,
} from '../config/types.js';
import { localize } from '../localize/localize.js';
import '../patches/ha-hls-player';
import basicBlockStyle from '../scss/basic-block.scss';
import viewerCarouselStyle from '../scss/viewer-carousel.scss';
import viewerProviderStyle from '../scss/viewer-provider.scss';
import viewerStyle from '../scss/viewer.scss';
import {
  ExtendedHomeAssistant,
  FrigateCardMediaPlayer,
  MediaLoadedInfo,
} from '../types.js';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import { mayHaveAudio } from '../utils/audio.js';
import {
  aspectRatioToString,
  contentsChanged,
  setOrRemoveAttribute,
} from '../utils/basic.js';
import { CarouselSelected } from '../utils/embla/carousel-controller.js';
import { AutoLazyLoad } from '../utils/embla/plugins/auto-lazy-load/auto-lazy-load.js';
import AutoMediaLoadedInfo from '../utils/embla/plugins/auto-media-loaded-info/auto-media-loaded-info.js';
import AutoSize from '../utils/embla/plugins/auto-size/auto-size.js';
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
  hideMediaControlsTemporarily,
  MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
  playMediaMutingIfNecessary,
  setControlsOnVideo,
} from '../utils/media.js';
import { screenshotMedia } from '../utils/screenshot.js';
import { ViewMediaClassifier } from '../view/media-classifier';
import { MediaQueriesClassifier } from '../view/media-queries-classifier';
import { VideoContentType, ViewMedia } from '../view/media.js';
import type { EmblaCarouselPlugins } from './carousel.js';
import './next-prev-control.js';
import './ptz';
import './surround.js';

export interface MediaViewerViewContext {
  seek?: Date;
}

declare module 'view' {
  interface ViewContext {
    mediaViewer?: MediaViewerViewContext;
  }
}

interface MediaNeighbor {
  index: number;
  media: ViewMedia;
}

interface MediaNeighbors {
  previous?: MediaNeighbor;
  next?: MediaNeighbor;
}

@customElement('frigate-card-viewer')
export class FrigateCardViewer extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public viewerConfig?: ViewerConfig;

  @property({ attribute: false })
  public resolvedMediaCache?: ResolvedMediaCache;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected render(): TemplateResult | void {
    if (
      !this.hass ||
      !this.viewManagerEpoch ||
      !this.viewerConfig ||
      !this.cameraManager ||
      !this.cardWideConfig
    ) {
      return;
    }

    if (!this.viewManagerEpoch.manager.getView()?.queryResults?.hasResults()) {
      // Directly render an error message (instead of dispatching it upwards)
      // to preserve the mini-timeline if the user pans into an area with no
      // media.
      return renderMessage({
        type: 'info',
        message: localize('common.no_media'),
        icon: 'mdi:multimedia',
      });
    }

    return html` <frigate-card-viewer-grid
      .hass=${this.hass}
      .viewManagerEpoch=${this.viewManagerEpoch}
      .viewerConfig=${this.viewerConfig}
      .resolvedMediaCache=${this.resolvedMediaCache}
      .cameraManager=${this.cameraManager}
      .cardWideConfig=${this.cardWideConfig}
    >
    </frigate-card-viewer-grid>`;
  }

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
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public viewFilterCameraID?: string;

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

  @property({ attribute: false })
  public showControls = true;

  @state()
  protected _selected = 0;

  protected _media: ViewMedia[] | null = null;
  protected _mediaActionsController = new MediaActionsController();
  protected _player: FrigateCardMediaPlayer | null = null;
  protected _refCarousel: Ref<HTMLElement> = createRef();

  updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (changedProperties.has('viewManagerEpoch')) {
      // Seek into the video if the seek time has changed (this is also called
      // on media load, since the media may or may not have been loaded at
      // this point).
      if (
        this.viewManagerEpoch?.manager.getView()?.context?.mediaViewer !==
        this.viewManagerEpoch?.oldView?.context?.mediaViewer
      ) {
        this._seekHandler();
      }
    }

    if (!this._mediaActionsController.hasRoot() && this._refCarousel.value) {
      this._mediaActionsController.initialize(this._refCarousel.value);
    }
  }

  public connectedCallback(): void {
    super.connectedCallback();

    // Request update in order to reinitialize the media action controller.
    this.requestUpdate();
  }

  public disconnectedCallback(): void {
    this._mediaActionsController.destroy();
    super.disconnectedCallback();
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
   * Get the Embla plugins to use.
   * @returns A list of EmblaOptionsTypes.
   */
  protected _getPlugins(): EmblaCarouselPlugins {
    return [
      AutoLazyLoad({
        ...(this.viewerConfig?.lazy_load && {
          lazyLoadCallback: (_index, slide) => this._lazyloadSlide(slide),
        }),
      }),
      AutoMediaLoadedInfo(),
      AutoSize(),
    ];
  }

  /**
   * Get the previous and next true media items from the current view.
   * @returns A BrowseMediaNeighbors with indices and objects of true media
   * neighbors.
   */
  protected _getMediaNeighbors(): MediaNeighbors | null {
    const mediaCount = this._media?.length ?? 0;
    if (!this._media) {
      return null;
    }

    const prevIndex = this._selected > 0 ? this._selected - 1 : null;
    const nextIndex = this._selected + 1 < mediaCount ? this._selected + 1 : null;
    return {
      ...(prevIndex !== null && {
        previous: {
          index: prevIndex,
          media: this._media[prevIndex],
        },
      }),
      ...(nextIndex !== null && {
        next: {
          index: nextIndex,
          media: this._media[nextIndex],
        },
      }),
    };
  }

  protected _setViewSelectedIndex(index: number): void {
    const view = this.viewManagerEpoch?.manager.getView();

    if (!this._media || !view) {
      return;
    }

    if (this._selected === index) {
      // The slide may already be selected on load, so don't dispatch a new view
      // unless necessary (i.e. the new index is different from the current
      // index).
      return;
    }

    const newResults = view?.queryResults
      ?.clone()
      .selectIndex(index, this.viewFilterCameraID);
    if (!newResults) {
      return;
    }
    const cameraID = newResults
      .getSelectedResult(this.viewFilterCameraID)
      ?.getCameraID();

    this.viewManagerEpoch?.manager.setViewByParameters({
      params: {
        queryResults: newResults,
        // Always change the camera to the owner of the selected media.
        ...(cameraID && { camera: cameraID }),
      },
      modifiers: [new RemoveContextPropertyViewModifier('mediaViewer', 'seek')],
    });
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
      viewerProvider.load = true;
    }
  }

  /**
   * Get slides to include in the render.
   * @returns The slides to include in the render.
   */
  protected _getSlides(): TemplateResult[] {
    if (!this._media) {
      return [];
    }

    const slides: TemplateResult[] = [];
    for (let i = 0; i < this._media.length; ++i) {
      const media = this._media[i];
      if (media) {
        const slide = this._renderMediaItem(media);
        if (slide) {
          slides[i] = slide;
        }
      }
    }
    return slides;
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('viewerConfig')) {
      this._mediaActionsController.setOptions({
        playerSelector: FRIGATE_CARD_VIEWER_PROVIDER,
        ...(this.viewerConfig?.auto_play && {
          autoPlayConditions: this.viewerConfig.auto_play,
        }),
        ...(this.viewerConfig?.auto_pause && {
          autoPauseConditions: this.viewerConfig.auto_pause,
        }),
        ...(this.viewerConfig?.auto_mute && {
          autoMuteConditions: this.viewerConfig.auto_mute,
        }),
        ...(this.viewerConfig?.auto_unmute && {
          autoUnmuteConditions: this.viewerConfig.auto_unmute,
        }),
      });
    }

    if (changedProps.has('viewManagerEpoch')) {
      const view = this.viewManagerEpoch?.manager.getView();
      const newMedia = view?.queryResults?.getResults(this.viewFilterCameraID) ?? null;
      const newSelected =
        view?.queryResults?.getSelectedIndex(this.viewFilterCameraID) ?? 0;
      const newSeek = view?.context?.mediaViewer?.seek;

      if (newMedia !== this._media || newSelected !== this._selected || !newSeek) {
        setOrRemoveAttribute(this, false, 'unseekable');
        this._media = newMedia;
        this._selected = newSelected;
      }

      if (!newMedia?.length) {
        // No media will be rendered.
        this._mediaActionsController.unsetTarget();
      } else {
        if (this.viewFilterCameraID) {
          this._mediaActionsController.setTarget(
            newSelected,
            // Camera in this carousel is only selected if the camera from the
            // view matches the filtered camera.
            view?.camera === this.viewFilterCameraID,
          );
        } else {
          // Carousel is not filtered, so the targeted camera is always selected.
          this._mediaActionsController.setTarget(newSelected, true);
        }
      }
    }
  }

  protected render(): TemplateResult | void {
    const mediaCount = this._media?.length ?? 0;
    if (!this._media || !mediaCount) {
      return dispatchMessageEvent(this, localize('common.no_media'), 'info', {
        icon: 'mdi:multimedia',
      });
    }

    // If there's no selected media, just choose the last (most recent one) to
    // avoid rendering a blank. This situation should not occur in practice, as
    // this view should not be called without a selected media.
    const selectedMedia = this._media[this._selected] ?? this._media[mediaCount - 1];

    if (!this.hass || !this.cameraManager || !selectedMedia) {
      return;
    }

    const neighbors = this._getMediaNeighbors();
    const scroll = (direction: 'previous' | 'next'): void => {
      if (!neighbors || !this._media) {
        return;
      }
      const newIndex =
        (direction === 'previous' ? neighbors.previous?.index : neighbors.next?.index) ??
        null;
      if (newIndex !== null) {
        this._setViewSelectedIndex(newIndex);
      }
    };

    const view = this.viewManagerEpoch?.manager.getView();

    return html`
      <frigate-card-carousel
        ${ref(this._refCarousel)}
        .dragEnabled=${this.viewerConfig?.draggable ?? true}
        .plugins=${guard([this.viewerConfig, this._media], this._getPlugins.bind(this))}
        .selected=${this._selected}
        transitionEffect=${this._getTransitionEffect()}
        @frigate-card:carousel:select=${(ev: CustomEvent<CarouselSelected>) => {
          this._setViewSelectedIndex(ev.detail.index);
        }}
        @frigate-card:media:loaded=${(ev: CustomEvent<MediaLoadedInfo>) => {
          this._player = ev.detail.player ?? null;
          this._seekHandler();
        }}
        @frigate-card:media:unloaded=${() => {
          this._player = null;
        }}
      >
        ${this.showControls
          ? html` <frigate-card-next-previous-control
              slot="previous"
              .hass=${this.hass}
              .direction=${'previous'}
              .controlConfig=${this.viewerConfig?.controls.next_previous}
              .thumbnail=${neighbors?.previous?.media.getThumbnail() ?? undefined}
              .label=${neighbors?.previous?.media.getTitle() ?? ''}
              ?disabled=${!neighbors?.previous}
              @click=${(ev: Event) => {
                scroll('previous');
                stopEventFromActivatingCardWideActions(ev);
              }}
            ></frigate-card-next-previous-control>`
          : ''}
        ${guard([this._media, view], () => this._getSlides())}
        ${this.showControls
          ? html` <frigate-card-next-previous-control
              slot="next"
              .hass=${this.hass}
              .direction=${'next'}
              .controlConfig=${this.viewerConfig?.controls.next_previous}
              .thumbnail=${neighbors?.next?.media.getThumbnail() ?? undefined}
              .label=${neighbors?.next?.media.getTitle() ?? ''}
              ?disabled=${!neighbors?.next}
              @click=${(ev: Event) => {
                scroll('next');
                stopEventFromActivatingCardWideActions(ev);
              }}
            ></frigate-card-next-previous-control>`
          : ''}
      </frigate-card-carousel>
      ${view
        ? html` <frigate-card-ptz
            .config=${this.viewerConfig?.controls.ptz}
            .forceVisibility=${view?.context?.ptzControls?.enabled}
          >
          </frigate-card-ptz>`
        : ''}
      <div class="seek-warning">
        <ha-icon title="${localize('media_viewer.unseekable')}" icon="mdi:clock-remove">
        </ha-icon>
      </div>
    `;
  }

  /**
   * Fire a media show event when a slide is selected.
   */
  protected async _seekHandler(): Promise<void> {
    const view = this.viewManagerEpoch?.manager.getView();
    const seek = view?.context?.mediaViewer?.seek;
    if (!this.hass || !seek || !this._media || !this._player) {
      return;
    }
    const selectedMedia = this._media[this._selected];
    if (!selectedMedia) {
      return;
    }

    const seekTimeInMedia = selectedMedia.includesTime(seek);
    setOrRemoveAttribute(this, !seekTimeInMedia, 'unseekable');
    if (!seekTimeInMedia && !this._player.isPaused()) {
      this._player.pause();
    } else if (seekTimeInMedia && this._player.isPaused()) {
      this._player.play();
    }

    const seekTime =
      (await this.cameraManager?.getMediaSeekTime(selectedMedia, seek)) ?? null;

    if (seekTime !== null) {
      this._player.seek(seekTime);
    }
  }

  protected _renderMediaItem(media: ViewMedia): TemplateResult | null {
    const view = this.viewManagerEpoch?.manager.getView();
    if (!this.hass || !view || !this.viewerConfig) {
      return null;
    }

    return html` <div class="embla__slide">
      <frigate-card-viewer-provider
        .hass=${this.hass}
        .viewManagerEpoch=${this.viewManagerEpoch}
        .media=${media}
        .viewerConfig=${this.viewerConfig}
        .resolvedMediaCache=${this.resolvedMediaCache}
        .cameraManager=${this.cameraManager}
        .load=${!this.viewerConfig.lazy_load}
        .cardWideConfig=${this.cardWideConfig}
      ></frigate-card-viewer-provider>
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerCarouselStyle);
  }
}

@customElement('frigate-card-viewer-grid')
export class FrigateCardViewerGrid extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public viewerConfig?: ViewerConfig;

  @property({ attribute: false })
  public resolvedMediaCache?: ResolvedMediaCache;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  protected _renderCarousel(filterCamera?: string): TemplateResult {
    const selectedCameraID = this.viewManagerEpoch?.manager.getView()?.camera;
    return html`
      <frigate-card-viewer-carousel
        grid-id=${ifDefined(filterCamera)}
        .hass=${this.hass}
        .viewManagerEpoch=${this.viewManagerEpoch}
        .viewFilterCameraID=${filterCamera}
        .viewerConfig=${this.viewerConfig}
        .resolvedMediaCache=${this.resolvedMediaCache}
        .cameraManager=${this.cameraManager}
        .cardWideConfig=${this.cardWideConfig}
        .showControls=${!filterCamera || selectedCameraID === filterCamera}
      >
      </frigate-card-viewer-carousel>
    `;
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('viewManagerEpoch') && this._needsGrid()) {
      import('./media-grid.js');
    }
  }

  protected _needsGrid(): boolean {
    const view = this.viewManagerEpoch?.manager.getView();
    const cameraIDs = view?.queryResults?.getCameraIDs();
    return (
      !!view?.isGrid() &&
      !!view?.supportsMultipleDisplayModes() &&
      (cameraIDs?.size ?? 0) > 1
    );
  }

  protected _gridSelectCamera(cameraID: string): void {
    const view = this.viewManagerEpoch?.manager.getView();
    this.viewManagerEpoch?.manager.setViewByParameters({
      params: {
        camera: cameraID,
        queryResults: view?.queryResults
          ?.clone()
          .promoteCameraSelectionToMainSelection(cameraID),
      },
    });
  }

  protected render(): TemplateResult {
    const view = this.viewManagerEpoch?.manager.getView();
    const cameraIDs = view?.queryResults?.getCameraIDs();
    if (!cameraIDs || !this._needsGrid()) {
      return this._renderCarousel();
    }

    return html`
      <frigate-card-media-grid
        .selected=${view?.camera}
        .displayConfig=${this.viewerConfig?.display}
        @frigate-card:media-grid:selected=${(ev: CustomEvent<MediaGridSelected>) =>
          this._gridSelectCamera(ev.detail.selected)}
      >
        ${[...cameraIDs].map((cameraID) => this._renderCarousel(cameraID))}
      </frigate-card-media-grid>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
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
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public media?: ViewMedia;

  @property({ attribute: false })
  public viewerConfig?: ViewerConfig;

  @property({ attribute: false })
  public resolvedMediaCache?: ResolvedMediaCache;

  // Whether or not to load the viewer media. If `false`, no contents are
  // rendered until this attribute is set to `true` (this is useful for lazy
  // loading).
  @property({ attribute: false })
  public load = false;

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

  protected async _switchToRelatedClipView(): Promise<void> {
    const view = this.viewManagerEpoch?.manager.getView();
    if (
      !this.hass ||
      !view ||
      !this.cameraManager ||
      !this.media ||
      // If this specific media item has no clip, then do nothing (even if all
      // the other media items do).
      !ViewMediaClassifier.isEvent(this.media) ||
      !MediaQueriesClassifier.areEventQueries(view.query)
    ) {
      return;
    }

    // Convert the query to a clips equivalent.
    const clipQuery = view.query.clone();
    clipQuery.convertToClipsQueries();

    const queries = clipQuery.getQueries();
    if (!queries) {
      return;
    }

    await this.viewManagerEpoch?.manager.setViewByParametersWithExistingQuery({
      params: {
        view: 'media',
        query: clipQuery,
      },
      queryExecutorOptions: {
        selectResult: {
          id: this.media.getID() ?? undefined,
        },
        rejectResults: (results) => !results.hasSelectedResult(),
      },
    });
  }

  protected willUpdate(changedProps: PropertyValues): void {
    const mediaContentID = this.media ? this.media.getContentID() : null;

    if (
      (changedProps.has('load') ||
        changedProps.has('media') ||
        changedProps.has('viewerConfig') ||
        changedProps.has('resolvedMediaCache') ||
        changedProps.has('hass')) &&
      this.hass &&
      mediaContentID &&
      !this.resolvedMediaCache?.has(mediaContentID) &&
      (!this.viewerConfig?.lazy_load || this.load)
    ) {
      resolveMedia(this.hass, mediaContentID, this.resolvedMediaCache).then(() => {
        this.requestUpdate();
      });
    }

    if (changedProps.has('viewerConfig') && this.viewerConfig?.zoomable) {
      import('./zoomer.js');
    }

    if (changedProps.has('media') || changedProps.has('cameraManager')) {
      const cameraID = this.media?.getCameraID();
      const cameraConfig = cameraID
        ? this.cameraManager?.getStore().getCameraConfig(cameraID)
        : null;
      updateElementStyleFromMediaLayoutConfig(this, cameraConfig?.dimensions?.layout);

      this.style.aspectRatio = aspectRatioToString({
        ratio: cameraConfig?.dimensions?.aspect_ratio,
      });
    }
  }

  protected _useZoomIfRequired(template: TemplateResult): TemplateResult {
    if (!this.media) {
      return template;
    }
    const cameraID = this.media.getCameraID();
    const mediaID = this.media.getID() ?? undefined;
    const cameraConfig = this.cameraManager?.getStore().getCameraConfig(cameraID);
    const view = this.viewManagerEpoch?.manager.getView();

    return this.viewerConfig?.zoomable
      ? html` <frigate-card-zoomer
          .defaultSettings=${guard([cameraConfig?.dimensions?.layout], () =>
            cameraConfig?.dimensions?.layout
              ? {
                  pan: cameraConfig.dimensions.layout.pan,
                  zoom: cameraConfig.dimensions.layout.zoom,
                }
              : undefined,
          )}
          .settings=${mediaID ? view?.context?.zoom?.[mediaID]?.requested : undefined}
          @frigate-card:zoom:zoomed=${() => this.setControls(false)}
          @frigate-card:zoom:unzoomed=${() => this.setControls()}
          @frigate-card:zoom:change=${(ev: CustomEvent<ZoomSettingsObserved>) =>
            handleZoomSettingsObservedEvent(ev, this.viewManagerEpoch?.manager, mediaID)}
        >
          ${template}
        </frigate-card-zoomer>`
      : template;
  }

  protected render(): TemplateResult | void {
    if (!this.load || !this.media || !this.hass || !this.viewerConfig) {
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
                    technology: ['hls'],
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
                this._switchToRelatedClipView();
              }
            }}
            @load=${(ev: Event) => {
              dispatchMediaLoadedEvent(this, ev, { player: this, technology: ['jpg'] });
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
    'frigate-card-viewer-grid': FrigateCardViewerGrid;
    'frigate-card-viewer-provider': FrigateCardViewerProvider;
  }
}
