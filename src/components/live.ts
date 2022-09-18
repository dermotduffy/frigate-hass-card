import JSMpeg from '@cycjimmy/jsmpeg-player';
import { Task } from '@lit-labs/task';
import { HomeAssistant } from 'custom-card-helpers';
import { EmblaOptionsType } from 'embla-carousel';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { guard } from 'lit/directives/guard.js';
import { keyed } from 'lit/directives/keyed.js';
import { until } from 'lit/directives/until.js';
import { ConditionState, getOverriddenConfig } from '../card-condition.js';
import { dispatchMessageEvent, renderProgressIndicator } from '../components/message.js';
import { localize } from '../localize/localize.js';
import liveFrigateStyle from '../scss/live-frigate.scss';
import liveJSMPEGStyle from '../scss/live-jsmpeg.scss';
import liveWebRTCStyle from '../scss/live-webrtc.scss';
import liveStyle from '../scss/live.scss';
import liveCarouselStyle from '../scss/live-carousel.scss';
import liveProviderStyle from '../scss/live-provider.scss';
import {
  CameraConfig,
  ExtendedHomeAssistant,
  frigateCardConfigDefaults,
  FrigateCardError,
  FrigateCardMediaPlayer,
  JSMPEGConfig,
  LiveConfig,
  LiveOverrides,
  LiveProvider,
  MediaLoadedInfo,
  Message,
  TransitionEffect,
  WebRTCCardConfig,
} from '../types.js';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import { contentsChanged, errorToConsole } from '../utils/basic.js';
import { getCameraIcon, getCameraTitle } from '../utils/camera.js';
import { homeAssistantSignPath } from '../utils/ha';
import { getFullDependentBrowseMediaQueryParameters } from '../utils/ha/browse-media.js';
import {
  dispatchExistingMediaLoadedInfoAsEvent,
  dispatchMediaLoadedEvent,
  dispatchMediaUnloadedEvent,
} from '../utils/media-info.js';
import { dispatchViewContextChangeEvent, View } from '../view.js';
import { AutoMediaPlugin } from './embla-plugins/automedia.js';
import { Lazyload } from './embla-plugins/lazyload.js';
import {
  FrigateCardMediaCarousel,
  wrapMediaLoadedEventForCarousel,
  wrapMediaUnloadedEventForCarousel,
} from './media-carousel.js';
import { dispatchErrorMessageEvent } from './message.js';
import './next-prev-control.js';
import './title-control.js';
import './surround.js';
import '../patches/ha-camera-stream';
import { EmblaCarouselPlugins } from './carousel.js';
import { renderTask } from '../utils/task.js';
import { classMap } from 'lit/directives/class-map.js';
import './image';
import { updateElementStyleFromMediaLayoutConfig } from '../utils/media-layout.js';
import { TimelineDataManager } from '../utils/timeline-data-manager.js';

// Number of seconds a signed URL is valid for.
const URL_SIGN_EXPIRY_SECONDS = 24 * 60 * 60;

// Number of seconds before the expiry to trigger a refresh.
const URL_SIGN_REFRESH_THRESHOLD_SECONDS = 1 * 60 * 60;

@customElement('frigate-card-live')
export class FrigateCardLive extends LitElement {
  @property({ attribute: false })
  public conditionState?: ConditionState;

  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public cameras?: Map<string, CameraConfig>;

  @property({ attribute: false })
  public liveConfig?: LiveConfig;

  @property({ attribute: false, hasChanged: contentsChanged })
  public liveOverrides?: LiveOverrides;

  @property({ attribute: false })
  public timelineDataManager?: TimelineDataManager;

  // Whether or not the live view is currently in the background (i.e. preloaded
  // but not visible)
  @state()
  protected _inBackground?: boolean = false;

  // Intersection handler is used to detect when the live view flips between
  // foreground and background (in preload mode).
  protected _intersectionObserver: IntersectionObserver;

  // MediaLoadedInfo object and message from the underlying live object. In the
  // case of pre-loading these may be propagated upwards later.
  protected _backgroundMediaLoadedInfo: MediaLoadedInfo | null = null;
  protected _messageReceivedPostRender = false;
  protected _renderKey = 0;

  constructor() {
    super();
    this._intersectionObserver = new IntersectionObserver(
      this._intersectionHandler.bind(this),
    );
  }

  /**
   * Called when the live view intersects with the viewport.
   * @param entries The IntersectionObserverEntry entries (should be only 1).
   */
  protected _intersectionHandler(entries: IntersectionObserverEntry[]): void {
    this._inBackground = !entries.some((entry) => entry.isIntersecting);

    if (
      !this._inBackground &&
      !this._messageReceivedPostRender &&
      this._backgroundMediaLoadedInfo
    ) {
      // If this isn't being rendered in the background, the last render did not
      // generate a message and there's a saved MediaInfo, dispatch it upwards.
      dispatchExistingMediaLoadedInfoAsEvent(this, this._backgroundMediaLoadedInfo);
      this._backgroundMediaLoadedInfo = null;
    }

    // Trigger a re-render which may be necessary if the prior render resulted
    // in a message.
    if (this._messageReceivedPostRender && !this._inBackground) {
      this.requestUpdate();
    }
  }

  /**
   * Determine whether the element should be updated.
   * @param _changedProps The changed properties if any.
   * @returns `true` if the element should be updated.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldUpdate(_changedProps: PropertyValues): boolean {
    // Don't process updates if it's in the background and a message was
    // received (otherwise an error message thrown by the background live
    // component may continually be re-spammed hitting performance).
    return !this._inBackground || !this._messageReceivedPostRender;
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    this._intersectionObserver.observe(this);
    super.connectedCallback();
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._intersectionObserver.disconnect();
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.liveConfig || !this.cameras || !this.view) {
      return;
    }

    const config = getOverriddenConfig(
      this.liveConfig,
      this.liveOverrides,
      this.conditionState,
    ) as LiveConfig;

    // Does not use getFullDependentBrowseMediaQueryParametersOrDispatchError to
    // ensure that non-Frigate cameras will work in live view (they will not
    // have a Frigate camera name).
    const browseMediaParams = getFullDependentBrowseMediaQueryParameters(
      this.hass,
      this.cameras,
      this.view.camera,
      config.controls.thumbnails.media,
    );

    // Notes:
    // - See use of liveConfig and not config below -- the carousel will
    //   independently override the liveConfig to reflect the camera in the
    //   carousel (not necessarily the selected camera).
    // - Fetching of thumbnails is disabled as long as live view is the
    //   background.
    // - Various events are captured to prevent them propagating upwards if the
    //   card is in the background.
    // - The entire returned template is keyed to allow for the whole template
    //   to be re-rendered in certain circumstances (specifically: if a message
    //   is received when the card is in the background).
    const result = html`${keyed(
      this._renderKey,
      html`<frigate-card-surround
        .hass=${this.hass}
        .view=${this.view}
        .thumbnailConfig=${config.controls.thumbnails}
        .timelineConfig=${config.controls.timeline}
        .browseMediaParams=${browseMediaParams ?? undefined}
        .cameras=${this.cameras}
        .timelineDataManager=${this.timelineDataManager}
        .inBackground=${this._inBackground}
        @frigate-card:message=${(ev: CustomEvent<Message>) => {
          this._renderKey++;
          this._messageReceivedPostRender = true;
          if (this._inBackground) {
            ev.stopPropagation();
          }
        }}
        @frigate-card:media:loaded=${(ev: CustomEvent<MediaLoadedInfo>) => {
          if (this._inBackground) {
            this._backgroundMediaLoadedInfo = ev.detail;
            ev.stopPropagation();
          }
        }}
        @frigate-card:view:change=${(ev: CustomEvent<View>) => {
          if (this._inBackground) {
            ev.stopPropagation();
          }
        }}
      >
        <frigate-card-live-carousel
          .hass=${this.hass}
          .view=${this.view}
          .cameras=${this.cameras}
          .liveConfig=${this.liveConfig}
          .inBackground=${this._inBackground}
          .conditionState=${this.conditionState}
          .liveOverrides=${this.liveOverrides}
        >
        </frigate-card-live-carousel>
      </frigate-card-surround>`,
    )}`;

    this._messageReceivedPostRender = false;
    return result;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(liveStyle);
  }
}

@customElement('frigate-card-live-carousel')
export class FrigateCardLiveCarousel extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public cameras?: Map<string, CameraConfig>;

  @property({ attribute: false })
  public liveConfig?: LiveConfig;

  @property({ attribute: false, hasChanged: contentsChanged })
  public liveOverrides?: LiveOverrides;

  @property({ attribute: false })
  public inBackground?: boolean;

  @property({ attribute: false })
  public conditionState?: ConditionState;

  // Index between camera name and slide number.
  protected _cameraToSlide: Record<string, number> = {};
  protected _refMediaCarousel: Ref<FrigateCardMediaCarousel> = createRef();

  /**
   * The updated lifecycle callback for this element.
   * @param changedProperties The properties that were changed in this render.
   */
  updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    const frigateCardMediaCarousel = this._refMediaCarousel.value;
    const frigateCardCarousel = frigateCardMediaCarousel?.frigateCardCarousel();

    if (changedProperties.has('view')) {
      const oldView = changedProperties.get('view') as View | undefined;
      if (
        frigateCardCarousel &&
        this.view?.camera &&
        (!oldView || this.view?.camera !== oldView.camera)
      ) {
        const slide: number | undefined = this._cameraToSlide[this.view.camera];
        if (
          slide !== undefined &&
          slide !== frigateCardCarousel.getCarouselSelected()?.index
        ) {
          frigateCardCarousel.carouselScrollTo(slide);
        }
      }
    }

    if (
      frigateCardMediaCarousel &&
      frigateCardCarousel &&
      changedProperties.has('inBackground')
    ) {
      // If this has changed to be in the background (i.e. preloaded but not
      // visible) take the appropriate play/pause/mute/unmute actions.
      if (this.inBackground) {
        frigateCardMediaCarousel.autoPause();
        frigateCardMediaCarousel.autoMute();
      } else {
        frigateCardMediaCarousel.autoPlay();
        frigateCardMediaCarousel.autoUnmute();
      }
    }
  }

  /**
   * Get the transition effect to use.
   * @returns An TransitionEffect object.
   */
  protected _getTransitionEffect(): TransitionEffect {
    return (
      this.liveConfig?.transition_effect ??
      frigateCardConfigDefaults.live.transition_effect
    );
  }

  /**
   * Get the Embla options to use.
   * @returns An EmblaOptionsType object or undefined for no options.
   */
  protected _getOptions(): EmblaOptionsType {
    return {
      startIndex:
        this.cameras && this.view
          ? Math.max(0, Array.from(this.cameras.keys()).indexOf(this.view.camera))
          : 0,
      draggable: this.liveConfig?.draggable,
      loop: true,
    };
  }

  /**
   * Get the Embla plugins to use.
   * @returns A list of EmblaOptionsTypes.
   */
  protected _getPlugins(): EmblaCarouselPlugins {
    return [
      // Only enable wheel plugin if there is more than one camera.
      ...(this.cameras && this.cameras.size > 1
        ? [
            WheelGesturesPlugin({
              // Whether the carousel is vertical or horizontal, interpret y-axis wheel
              // gestures as scrolling for the carousel.
              forceWheelAxis: 'y',
            }),
          ]
        : []),
      Lazyload({
        ...(this.liveConfig?.lazy_load && {
          lazyLoadCallback: (index, slide) =>
            this._lazyloadOrUnloadSlide('load', index, slide),
        }),

        lazyUnloadCondition: this.liveConfig?.lazy_unload,
        lazyUnloadCallback: (index, slide) =>
          this._lazyloadOrUnloadSlide('unload', index, slide),
      }),
      AutoMediaPlugin({
        playerSelector: 'frigate-card-live-provider',
        ...(this.liveConfig?.auto_play && {
          autoPlayCondition: this.liveConfig.auto_play,
        }),
        ...(this.liveConfig?.auto_pause && {
          autoPauseCondition: this.liveConfig.auto_pause,
        }),
        ...(this.liveConfig?.auto_mute && {
          autoMuteCondition: this.liveConfig.auto_mute,
        }),
        ...(this.liveConfig?.auto_unmute && {
          autoUnmuteCondition: this.liveConfig.auto_unmute,
        }),
      }),
    ];
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
    return this.liveConfig?.lazy_load === false ? null : 0;
  }

  /**
   * Get slides to include in the render.
   * @returns The slides to include in the render and an index keyed by camera
   * name to slide number.
   */
  protected _getSlides(): [TemplateResult[], Record<string, number>] {
    if (!this.cameras) {
      return [[], {}];
    }

    const slides: TemplateResult[] = [];
    const cameraToSlide: Record<string, number> = {};

    for (const [camera, cameraConfig] of this.cameras) {
      const slide = this._renderLive(camera, cameraConfig, slides.length);
      if (slide) {
        cameraToSlide[camera] = slides.length;
        slides.push(slide);
      }
    }
    return [slides, cameraToSlide];
  }

  /**
   * Handle the user selecting a new slide in the carousel.
   */
  protected _setViewHandler(): void {
    const selectedCameraIndex = this._refMediaCarousel.value
      ?.frigateCardCarousel()
      ?.getCarouselSelected()?.index;
    if (selectedCameraIndex === undefined || !this.view || !this.cameras) {
      return;
    }

    this.view
      .evolve({
        camera: Array.from(this.cameras.keys())[selectedCameraIndex],

        // Reset the target.
        target: null,
        childIndex: null,
      })
      // Don't yet fetch thumbnails (they will be fetched when the carousel
      // settles).
      .mergeInContext({ thumbnails: { fetch: false } })
      .dispatchChangeEvent(this);
  }

  /**
   * Lazy load a slide.
   * @param _index The slide number to lazy load.
   * @param slide The slide to lazy load.
   */
  protected _lazyloadOrUnloadSlide(
    action: 'load' | 'unload',
    _index: number,
    slide: Element,
  ): void {
    if (slide instanceof HTMLSlotElement) {
      slide = slide.assignedElements({ flatten: true })[0];
    }

    const liveProvider = slide?.querySelector(
      'frigate-card-live-provider',
    ) as FrigateCardLiveProvider;
    if (liveProvider) {
      liveProvider.disabled = action !== 'load';
    }
  }

  protected _renderLive(
    camera: string,
    cameraConfig: CameraConfig,
    slideIndex: number,
  ): TemplateResult | void {
    if (!this.liveConfig) {
      return;
    }
    // The conditionState object contains the currently live camera, which (in
    // the carousel for example) is not necessarily the live camera this
    // <frigate-card-live-provider> is rendering right now.
    const conditionState = {
      ...this.conditionState,
      camera: camera,
    };

    const config = getOverriddenConfig(
      this.liveConfig,
      this.liveOverrides,
      conditionState,
    ) as LiveConfig;

    return html`
      <div class="embla__slide">
        <frigate-card-live-provider
          ?disabled=${this.liveConfig.lazy_load}
          .cameraConfig=${cameraConfig}
          .label=${getCameraTitle(this.hass, cameraConfig)}
          .liveConfig=${config}
          .hass=${this.hass}
          @frigate-card:media:loaded=${(ev: CustomEvent<MediaLoadedInfo>) => {
            wrapMediaLoadedEventForCarousel(slideIndex, ev);
          }}
          @frigate-card:media:unloaded=${(ev: CustomEvent<void>) => {
            wrapMediaUnloadedEventForCarousel(slideIndex, ev);
          }}
        >
        </frigate-card-live-provider>
      </div>
    `;
  }

  protected _getCameraNeighbors(): [CameraConfig | null, CameraConfig | null] {
    if (!this.cameras || !this.view || !this.hass) {
      return [null, null];
    }
    const keys = Array.from(this.cameras.keys());
    const currentIndex = keys.indexOf(this.view.camera);

    if (currentIndex < 0 || this.cameras.size <= 1) {
      return [null, null];
    }

    const prev =
      this.cameras.get(
        keys[currentIndex > 0 ? currentIndex - 1 : this.cameras.size - 1],
      ) ?? null;
    const next =
      this.cameras.get(
        keys[currentIndex + 1 < this.cameras.size ? currentIndex + 1 : 0],
      ) ?? null;
    return [prev, next];
  }

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    const [slides, cameraToSlide] = this._getSlides();
    this._cameraToSlide = cameraToSlide;
    if (!slides.length || !this.liveConfig || !this.cameras || !this.view) {
      return;
    }

    const config = getOverriddenConfig(
      this.liveConfig,
      this.liveOverrides,
      this.conditionState,
    ) as LiveConfig;

    const [prev, next] = this._getCameraNeighbors();
    const title = getCameraTitle(this.hass, this.cameras.get(this.view.camera));

    // Notes on the below:
    // - guard() is used to avoid reseting the carousel unless the
    //   options/plugins actually change.
    // - the 'carousel:settle' event is listened for (instead of
    //   'carousel:select') to only trigger the view change (which subsequently
    //   fetches thumbnails) after the carousel has stopped moving. This gives a
    //   much smoother carousel experience since network fetches are not at the
    //   same time as carousel movement (at a cost of fetching thumbnails a
    //   little later).

    return html`
      <frigate-card-media-carousel
        ${ref(this._refMediaCarousel)}
        .carouselOptions=${guard(
          [this.cameras, this.liveConfig],
          this._getOptions.bind(this),
        )}
        .carouselPlugins=${guard(
          [this.cameras, this.liveConfig],
          this._getPlugins.bind(this),
        ) as EmblaCarouselPlugins}
        .label="${title ? `${localize('common.live')}: ${title}` : ''}"
        .titlePopupConfig=${config.controls.title}
        transitionEffect=${this._getTransitionEffect()}
        @frigate-card:media-carousel:select=${this._setViewHandler.bind(this)}
        @frigate-card:carousel:settle=${() => {
          // Fetch the thumbnails after the carousel has settled.
          dispatchViewContextChangeEvent(this, { thumbnails: { fetch: true } });
        }}
      >
        <frigate-card-next-previous-control
          slot="previous"
          .hass=${this.hass}
          .direction=${'previous'}
          .controlConfig=${config.controls.next_previous}
          .label=${getCameraTitle(this.hass, prev)}
          .icon=${getCameraIcon(this.hass, prev)}
          ?disabled=${prev == null}
          @click=${(ev) => {
            this._refMediaCarousel.value
              ?.frigateCardCarousel()
              ?.carouselScrollPrevious();
            stopEventFromActivatingCardWideActions(ev);
          }}
        >
        </frigate-card-next-previous-control>
        ${slides}
        <frigate-card-next-previous-control
          slot="next"
          .hass=${this.hass}
          .direction=${'next'}
          .controlConfig=${config.controls.next_previous}
          .label=${getCameraTitle(this.hass, next)}
          .icon=${getCameraIcon(this.hass, next)}
          ?disabled=${next == null}
          @click=${(ev) => {
            this._refMediaCarousel.value?.frigateCardCarousel()?.carouselScrollNext();
            stopEventFromActivatingCardWideActions(ev);
          }}
        >
        </frigate-card-next-previous-control>
      </frigate-card-media-carousel>
    `;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(liveCarouselStyle);
  }
}

@customElement('frigate-card-live-provider')
export class FrigateCardLiveProvider extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: false })
  public liveConfig?: LiveConfig;

  // Whether or not to disable this entity. If `true`, no contents are rendered
  // until this attribute is set to `false` (this is useful for lazy loading).
  @property({ attribute: true, type: Boolean })
  public disabled = false;

  // Label that is used for ARIA support and as tooltip.
  @property({ attribute: false })
  public label = '';

  @state()
  protected _isVideoMediaLoaded = false;

  protected _providerRef: Ref<Element & FrigateCardMediaPlayer> = createRef();

  /**
   * Play the video.
   */
  public play(): void {
    this._providerRef.value?.play();
  }

  /**
   * Pause the video.
   */
  public pause(): void {
    this._providerRef.value?.pause();
  }

  /**
   * Mute the video.
   */
  public mute(): void {
    this._providerRef.value?.mute();
  }

  /**
   * Unmute the video.
   */
  public unmute(): void {
    this._providerRef.value?.unmute();
  }

  /**
   * Seek the video.
   */
  public seek(seconds: number): void {
    this._providerRef.value?.seek(seconds);
  }

  /**
   * Get the fully resolved live provider.
   * @returns A live provider (that is not 'auto').
   */
  protected _getResolvedProvider(): Omit<LiveProvider, 'auto'> {
    if (this.cameraConfig?.live_provider === 'auto') {
      if (
        this.cameraConfig?.webrtc_card?.entity ||
        this.cameraConfig?.webrtc_card?.url
      ) {
        return 'webrtc-card';
      } else if (this.cameraConfig?.camera_entity) {
        return 'ha';
      } else if (this.cameraConfig?.frigate.camera_name) {
        return 'frigate-jsmpeg';
      }
      return frigateCardConfigDefaults.cameras.live_provider;
    }
    return (
      this.cameraConfig?.live_provider || frigateCardConfigDefaults.cameras.live_provider
    );
  }

  /**
   * Determine if a camera image should be shown in lieu of the real stream
   * whilst loading.
   * @returns`true` if an image should be shown.
   */
  protected _shouldShowImageDuringLoading(): boolean {
    return (
      !!this.cameraConfig?.camera_entity &&
      !!this.hass &&
      !!this.liveConfig?.show_image_during_load
    );
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    this._isVideoMediaLoaded = false;
  }

  /**
   * Record that video media is being shown.
   */
  protected _videoMediaShowHandler(): void {
    this._isVideoMediaLoaded = true;
  }

  /**
   * Called before each update.
   */
  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('disabled')) {
      if (this.disabled) {
        this._isVideoMediaLoaded = false;
        dispatchMediaUnloadedEvent(this);
      }
    }
    if (changedProps.has('liveConfig')) {
      updateElementStyleFromMediaLayoutConfig(this, this.liveConfig?.layout);
    }
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (this.disabled || !this.hass || !this.liveConfig || !this.cameraConfig) {
      return;
    }

    // Set title and ariaLabel from the provided label property.
    this.title = this.label;
    this.ariaLabel = this.label;

    const provider = this._getResolvedProvider();
    const showImage = !this._isVideoMediaLoaded && this._shouldShowImageDuringLoading();
    const providerClasses = {
      hidden: showImage,
    };

    return html`
      ${showImage
        ? html`<frigate-card-image
            .imageConfig=${{
              mode: 'camera' as const,
              refresh_seconds: 1,
            }}
            .hass=${this.hass}
            .cameraConfig=${this.cameraConfig}
          >
          </frigate-card-image>`
        : html``}
      ${provider === 'ha'
        ? html` <frigate-card-live-ha
            ${ref(this._providerRef)}
            class=${classMap(providerClasses)}
            .hass=${this.hass}
            .cameraConfig=${this.cameraConfig}
            @frigate-card:media:loaded=${this._videoMediaShowHandler.bind(this)}
          >
          </frigate-card-live-ha>`
        : provider === 'webrtc-card'
        ? html`<frigate-card-live-webrtc-card
            ${ref(this._providerRef)}
            class=${classMap(providerClasses)}
            .hass=${this.hass}
            .cameraConfig=${this.cameraConfig}
            .webRTCConfig=${this.liveConfig.webrtc_card}
            @frigate-card:media:loaded=${this._videoMediaShowHandler.bind(this)}
          >
          </frigate-card-live-webrtc-card>`
        : html` <frigate-card-live-jsmpeg
            ${ref(this._providerRef)}
            class=${classMap(providerClasses)}
            .hass=${this.hass}
            .cameraConfig=${this.cameraConfig}
            .jsmpegConfig=${this.liveConfig.jsmpeg}
            @frigate-card:media:loaded=${this._videoMediaShowHandler.bind(this)}
          >
          </frigate-card-live-jsmpeg>`}
    `;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(liveProviderStyle);
  }
}

@customElement('frigate-card-live-ha')
export class FrigateCardLiveFrigate extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  protected _playerRef: Ref<FrigateCardLiveFrigate> = createRef();

  /**
   * Play the video.
   */
  public play(): void {
    this._playerRef.value?.play();
  }

  /**
   * Pause the video.
   */
  public pause(): void {
    this._playerRef.value?.pause();
  }

  /**
   * Mute the video.
   */
  public mute(): void {
    this._playerRef.value?.mute();
  }

  /**
   * Unmute the video.
   */
  public unmute(): void {
    this._playerRef.value?.unmute();
  }

  /**
   * Seek the video.
   */
  public seek(seconds: number): void {
    this._playerRef.value?.seek(seconds);
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass) {
      return;
    }

    if (!this.cameraConfig?.camera_entity) {
      return dispatchErrorMessageEvent(this, localize('error.no_live_camera'), {
        context: this.cameraConfig,
      });
    }

    const stateObj = this.hass.states[this.cameraConfig.camera_entity];
    if (!stateObj) {
      return dispatchErrorMessageEvent(this, localize('error.live_camera_not_found'), {
        context: this.cameraConfig,
      });
    }

    if (stateObj.state === 'unavailable') {
      // Don't treat state unavailability as an error per se.
      return dispatchMessageEvent(
        this,
        localize('error.live_camera_unavailable'),
        'info',
        {
          icon: 'mdi:connection',
          context: getCameraTitle(this.hass, this.cameraConfig),
        },
      );
    }

    return html` <frigate-card-ha-camera-stream
      ${ref(this._playerRef)}
      .hass=${this.hass}
      .stateObj=${stateObj}
      .controls=${true}
      .muted=${true}
    >
    </frigate-card-ha-camera-stream>`;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(liveFrigateStyle);
  }
}

// Create a wrapper for AlexxIT's WebRTC card
//  - https://github.com/AlexxIT/WebRTC
@customElement('frigate-card-live-webrtc-card')
export class FrigateCardLiveWebRTCCard extends LitElement {
  @property({ attribute: false, hasChanged: contentsChanged })
  public webRTCConfig?: WebRTCCardConfig;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  protected hass?: HomeAssistant;

  // A task to await the load of the WebRTC component.
  protected _webrtcTask = new Task(this, this._getWebRTCCardElement, () => [1]);

  /**
   * Play the video.
   */
  public play(): void {
    this._getPlayer()
      ?.play()
      .catch(() => {
        // WebRTC appears to generate additional spurious load events, which may
        // result in loads after a play() call, which causes the browser to spam
        // the logs unless the promise rejection is handled here.
      });
  }

  /**
   * Pause the video.
   */
  public pause(): void {
    this._getPlayer()?.pause();
  }

  /**
   * Mute the video.
   */
  public mute(): void {
    const player = this._getPlayer();
    if (player) {
      player.muted = true;
    }
  }

  /**
   * Unmute the video.
   */
  public unmute(): void {
    const player = this._getPlayer();
    if (player) {
      player.muted = false;
    }
  }

  /**
   * Seek the video.
   */
  public seek(seconds: number): void {
    const player = this._getPlayer();
    if (player) {
      player.currentTime = seconds;
    }
  }

  /**
   * Get the underlying video player.
   * @returns The player or `null` if not found.
   */
  protected _getPlayer(): HTMLVideoElement | null {
    return this.renderRoot?.querySelector('#video') as HTMLVideoElement | null;
  }

  protected async _getWebRTCCardElement(): Promise<
    CustomElementConstructor | undefined
  > {
    await customElements.whenDefined('webrtc-camera');
    return customElements.get('webrtc-camera');
  }

  /**
   * Create the WebRTC element. May throw.
   */
  protected _createWebRTC(): HTMLElement | null {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webrtcElement = this._webrtcTask.value;
    if (webrtcElement && this.hass) {
      const webrtc = new webrtcElement() as HTMLElement & {
        hass: HomeAssistant;
        setConfig: (config: Record<string, unknown>) => void;
      };
      const config = { ...this.webRTCConfig };

      // If the live WebRTC configuration does not specify a URL/entity to use,
      // then take values from the camera configuration instead (if there are
      // any).
      if (!config.url) {
        config.url = this.cameraConfig?.webrtc_card?.url;
      }
      if (!config.entity) {
        config.entity = this.cameraConfig?.webrtc_card?.entity;
      }
      webrtc.setConfig(config);
      webrtc.hass = this.hass;
      return webrtc;
    }
    return null;
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    const render = (): TemplateResult | void => {
      let webrtcElement: HTMLElement | null;
      try {
        webrtcElement = this._createWebRTC();
      } catch (e) {
        return dispatchErrorMessageEvent(
          this,
          e instanceof FrigateCardError
            ? e.message
            : localize('error.webrtc_card_reported_error') + ': ' + (e as Error).message,
          { context: (e as FrigateCardError).context },
        );
      }
      if (webrtcElement) {
        // Set the id to ensure that the relevant CSS styles will have
        // sufficient specifity to overcome some styles that are otherwise
        // applied to <ha-card> in Safari.
        webrtcElement.id = 'webrtc';
      }
      return html`${webrtcElement}`;
    };

    // Use a task to allow us to asynchronously wait for the WebRTC card to
    // load, but yet still have the card load be followed by the updated()
    // lifecycle callback (unlike just using `until`).
    return renderTask(this, this._webrtcTask, render, () =>
      renderProgressIndicator(localize('error.webrtc_card_waiting')),
    );
  }

  /**
   * Updated lifecycle callback.
   */
  public updated(): void {
    // Extract the video component after it has been rendered and generate the
    // media load event.
    this.updateComplete.then(() => {
      const video = this._getPlayer();
      if (video) {
        const onloadeddata = video.onloadeddata;

        video.onloadeddata = (e) => {
          if (onloadeddata) {
            onloadeddata.call(video, e);
          }
          dispatchMediaLoadedEvent(this, video);
        };
      }
    });
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(liveWebRTCStyle);
  }
}

@customElement('frigate-card-live-jsmpeg')
export class FrigateCardLiveJSMPEG extends LitElement {
  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: false, hasChanged: contentsChanged })
  public jsmpegConfig?: JSMPEGConfig;

  protected hass?: ExtendedHomeAssistant;

  protected _jsmpegCanvasElement?: HTMLCanvasElement;
  protected _jsmpegVideoPlayer?: JSMpeg.VideoElement;
  protected _refreshPlayerTimerID?: number;

  /**
   * Play the video.
   */
  public play(): void {
    this._jsmpegVideoPlayer?.play();
  }

  /**
   * Pause the video.
   */
  public pause(): void {
    this._jsmpegVideoPlayer?.stop();
  }

  /**
   * Mute the video (included for completeness, JSMPEG live disables audio as
   * Frigate does not encode it).
   */
  public mute(): void {
    const player = this._jsmpegVideoPlayer?.player;
    if (player) {
      player.volume = 0;
    }
  }

  /**
   * Unmute the video (included for completeness, JSMPEG live disables audio as
   * Frigate does not encode it).
   */
  public unmute(): void {
    const player = this._jsmpegVideoPlayer?.player;
    if (player) {
      player.volume = 1;
    }
  }

  /**
   * Seek the video (unsupported).
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public seek(_seconds: number): void {
    // JSMPEG does not support seeking.
  }

  /**
   * Get a signed player URL.
   * @returns A URL or null.
   */
  protected async _getURL(): Promise<string | null> {
    if (
      !this.hass ||
      !this.cameraConfig?.frigate.client_id ||
      !this.cameraConfig?.frigate.camera_name
    ) {
      return null;
    }

    let response: string | null | undefined;
    try {
      response = await homeAssistantSignPath(
        this.hass,
        `/api/frigate/${this.cameraConfig.frigate.client_id}` +
          `/jsmpeg/${this.cameraConfig.frigate.camera_name}`,
        URL_SIGN_EXPIRY_SECONDS,
      );
    } catch (e) {
      errorToConsole(e as Error);
      return null;
    }
    if (!response) {
      return null;
    }
    return response.replace(/^http/i, 'ws');
  }

  /**
   * Create a JSMPEG player.
   * @param url The URL for the player to connect to.
   * @returns A JSMPEG player.
   */
  protected async _createJSMPEGPlayer(url: string): Promise<JSMpeg.VideoElement> {
    return new Promise<JSMpeg.VideoElement>((resolve) => {
      let videoDecoded = false;
      const player = new JSMpeg.VideoElement(
        this,
        url,
        {
          canvas: this._jsmpegCanvasElement,
        },
        {
          // The media carousel may automatically pause when the browser tab is
          // inactive, JSMPEG does not need to also do so independently.
          pauseWhenHidden: false,
          autoplay: false,
          protocols: [],
          audio: false,
          videoBufferSize: 1024 * 1024 * 4,

          // Override with user-specified options.
          ...this.jsmpegConfig?.options,

          // Don't allow the player to internally reconnect, as it may re-use a
          // URL with a (newly) invalid signature, e.g. during a Home Assistant
          // restart.
          reconnectInterval: 0,
          onVideoDecode: () => {
            // This is the only callback that is called after the dimensions
            // are available. It's called on every frame decode, so just
            // ignore any subsequent calls.
            if (!videoDecoded && this._jsmpegCanvasElement) {
              videoDecoded = true;
              dispatchMediaLoadedEvent(this, this._jsmpegCanvasElement);
              resolve(player);
            }
          },
        },
      );
    });
  }

  /**
   * Reset / destroy the player.
   */
  protected _resetPlayer(): void {
    if (this._refreshPlayerTimerID) {
      window.clearTimeout(this._refreshPlayerTimerID);
      this._refreshPlayerTimerID = undefined;
    }
    if (this._jsmpegVideoPlayer) {
      try {
        this._jsmpegVideoPlayer.destroy();
      } catch (err) {
        // Pass.
      }
      this._jsmpegVideoPlayer = undefined;
    }
    if (this._jsmpegCanvasElement) {
      this._jsmpegCanvasElement.remove();
      this._jsmpegCanvasElement = undefined;
    }
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    if (this.isConnected) {
      this.requestUpdate();
    }
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    if (!this.isConnected) {
      this._resetPlayer();
    }
    super.disconnectedCallback();
  }

  /**
   * Refresh the JSMPEG player.
   */
  protected async _refreshPlayer(): Promise<void> {
    this._resetPlayer();

    this._jsmpegCanvasElement = document.createElement('canvas');
    this._jsmpegCanvasElement.className = 'media';

    if (!this.cameraConfig?.frigate.camera_name) {
      return dispatchErrorMessageEvent(this, localize('error.no_camera_name'), {
        context: this.cameraConfig,
      });
    }

    const url = await this._getURL();
    if (url) {
      this._jsmpegVideoPlayer = await this._createJSMPEGPlayer(url);
      this._refreshPlayerTimerID = window.setTimeout(() => {
        this.requestUpdate();
      }, (URL_SIGN_EXPIRY_SECONDS - URL_SIGN_REFRESH_THRESHOLD_SECONDS) * 1000);
    } else {
      dispatchErrorMessageEvent(this, localize('error.jsmpeg_no_sign'));
    }
  }

  /**
   * Master render method.
   */
  protected render(): TemplateResult | void {
    const _render = async (): Promise<TemplateResult | void> => {
      await this._refreshPlayer();

      if (!this._jsmpegVideoPlayer || !this._jsmpegCanvasElement) {
        return dispatchErrorMessageEvent(this, localize('error.jsmpeg_no_player'));
      }
      return html`${this._jsmpegCanvasElement}`;
    };
    return html`${until(_render(), renderProgressIndicator())}`;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(liveJSMPEGStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-live-jsmpeg': FrigateCardLiveJSMPEG;
    'frigate-card-live-webrtc-card': FrigateCardLiveWebRTCCard;
    'frigate-card-live-ha': FrigateCardLiveFrigate;
    'frigate-card-live-provider': FrigateCardLiveProvider;
    'frigate-card-live-carousel': FrigateCardLiveCarousel;
    'frigate-card-live': FrigateCardLive;
  }
}
