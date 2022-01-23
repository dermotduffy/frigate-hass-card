import {
  CSSResultGroup,
  LitElement,
  TemplateResult,
  html,
  unsafeCSS,
  PropertyValues,
} from 'lit';
import {
  BrowseMediaSource,
  ExtendedHomeAssistant,
  CameraConfig,
  JSMPEGConfig,
  LiveConfig,
  MediaShowInfo,
  WebRTCConfig,
  FrigateCardError,
  LiveOverrides,
  LiveProvider,
  frigateCardConfigDefaults,
} from '../types.js';
import { EmblaOptionsType, EmblaPluginType } from 'embla-carousel';
import { HomeAssistant } from 'custom-card-helpers';
import { Ref, createRef, ref } from 'lit/directives/ref.js';
import { customElement, property, state } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';

import { BrowseMediaUtil } from '../browse-media-util.js';
import { ConditionState, getOverriddenConfig } from '../card-condition.js';
import { FrigateCardMediaCarousel } from './media-carousel.js';
import { FrigateCardNextPreviousControl } from './next-prev-control.js';
import { Lazyload } from './embla-plugins/lazyload.js';
import { MediaAutoPlayPause } from './embla-plugins/media-autoplay.js';
import { ThumbnailCarouselTap } from './thumbnail-carousel.js';
import { View } from '../view.js';
import { localize } from '../localize/localize.js';
import {
  contentsChanged,
  dispatchErrorMessageEvent,
  dispatchExistingMediaShowInfoAsEvent,
  dispatchMediaShowEvent,
  dispatchMessageEvent,
  dispatchPauseEvent,
  dispatchPlayEvent,
  getCameraIcon,
  getCameraTitle,
  homeAssistantSignPath,
} from '../common.js';
import { renderProgressIndicator } from '../components/message.js';

import JSMpeg from '@cycjimmy/jsmpeg-player';

import liveStyle from '../scss/live.scss';
import liveFrigateStyle from '../scss/live-frigate.scss';
import liveJSMPEGStyle from '../scss/live-jsmpeg.scss';
import liveWebRTCStyle from '../scss/live-webrtc.scss';

// Number of seconds a signed URL is valid for.
const URL_SIGN_EXPIRY_SECONDS = 24 * 60 * 60;

// Number of seconds before the expiry to trigger a refresh.
const URL_SIGN_REFRESH_THRESHOLD_SECONDS = 1 * 60 * 60;

@customElement('frigate-card-live')
export class FrigateCardLive extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected cameras?: Map<string, CameraConfig>;

  @property({ attribute: false })
  protected liveConfig?: LiveConfig;

  @property({ attribute: false })
  protected liveOverrides?: LiveOverrides;

  @property({ attribute: false })
  protected conditionState?: ConditionState;

  set preloaded(preloaded: boolean) {
    this._preloaded = preloaded;

    if (!preloaded && this._savedMediaShowInfo) {
      dispatchExistingMediaShowInfoAsEvent(this, this._savedMediaShowInfo);
    }
  }

  // Whether or not the live view is currently being preloaded.
  @state()
  protected _preloaded?: boolean;

  // MediaShowInfo object from the underlying live object. In the case of
  // pre-loading it may be propagated upwards later.
  protected _savedMediaShowInfo?: MediaShowInfo;

  /**
   * Handler for media show events that special cases preloaded live views.
   * @param e The media show event.
   */
  protected _mediaShowHandler(e: CustomEvent<MediaShowInfo>): void {
    this._savedMediaShowInfo = e.detail;
    if (this._preloaded) {
      // If live is being pre-loaded, don't let the event propogate upwards yet
      // as the media is not really being shown.
      e.stopPropagation();
    }
  }

  /**
   * Render thumbnails carousel.
   * @returns A rendered template or void.
   */
  protected renderThumbnails(config: LiveConfig): TemplateResult | void {
    if (!this.liveConfig || !this.view) {
      return;
    }

    const fetchThumbnailsThenRender = async (): Promise<TemplateResult | void> => {
      if (!this.hass || !this.cameras || !this.view) {
        return;
      }
      const browseMediaParams = BrowseMediaUtil.getBrowseMediaQueryParameters(
        config.controls.thumbnails.media,
        this.cameras.get(this.view.camera),
      );
      if (!browseMediaParams) {
        return;
      }
      let parent: BrowseMediaSource | null;
      try {
        parent = await BrowseMediaUtil.browseMediaQuery(this.hass, browseMediaParams);
      } catch (e) {
        return dispatchErrorMessageEvent(this, (e as Error).message);
      }

      if (BrowseMediaUtil.getFirstTrueMediaChildIndex(parent) != null) {
        return html`<frigate-card-thumbnail-carousel
          .target=${parent}
          .view=${this.view}
          .config=${config.controls.thumbnails}
          .highlightSelected=${false}
          @frigate-card:carousel:tap=${(ev: CustomEvent<ThumbnailCarouselTap>) => {
            const mediaType = browseMediaParams.mediaType;
            if (mediaType && this.view && ['snapshots', 'clips'].includes(mediaType)) {
              new View({
                view: mediaType === 'clips' ? 'clip' : 'snapshot',
                camera: this.view.camera,
                target: ev.detail.target,
                childIndex: ev.detail.childIndex,
              }).dispatchChangeEvent(this);
            }
          }}
        >
        </frigate-card-thumbnail-carousel>`;
      }
    };

    // Don't render a progress indicator for live thumbnails, as it's jarring
    // during live-carousel scrolling (the progress indicator repeatedly
    // flashes). Just render nothing during loading.
    return html`${until(fetchThumbnailsThenRender(), html``)}`;
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.liveConfig || !this.cameras) {
      return;
    }

    const config = getOverriddenConfig(
      this.liveConfig,
      this.liveOverrides,
      this.conditionState,
    ) as LiveConfig;

    // Note use of liveConfig and not config below -- the carousel will
    // independently override the liveconfig to reflect the camera in the
    // carousel (not necessarily the selected camera).
    return html`
      ${config.controls.thumbnails.mode === 'above' ? this.renderThumbnails(config) : ''}
      <frigate-card-live-carousel
        .hass=${this.hass}
        .view=${this.view}
        .cameras=${this.cameras}
        .liveConfig=${this.liveConfig}
        .preloaded=${this._preloaded}
        .conditionState=${this.conditionState}
        .liveOverrides=${this.liveOverrides}
        @frigate-card:media-show=${this._mediaShowHandler}
        @frigate-card:change-view=${(ev: CustomEvent) => {
          if (this._preloaded) {
            // Don't allow change-view events to propagate upwards if the card
            // is only preloaded rather than being live displayed. These events
            // could be triggered if the camera is switched and the carousel
            // moves to focus on that camera -- as the card isn't actually being
            // displayed, do not allow the view to actually be updated.
            ev.stopPropagation();
          }
        }}
      >
      </frigate-card-live-carousel>
      ${config.controls.thumbnails.mode === 'below' ? this.renderThumbnails(config) : ''}
    `;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(liveStyle);
  }
}

@customElement('frigate-card-live-carousel')
export class FrigateCardLiveCarousel extends FrigateCardMediaCarousel {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected cameras?: Map<string, CameraConfig>;

  @property({ attribute: false })
  protected liveConfig?: LiveConfig;

  @property({ attribute: false })
  protected liveOverrides?: LiveOverrides;

  @property({ attribute: false })
  protected preloaded?: boolean;

  @property({ attribute: false })
  protected conditionState?: ConditionState;

  // Index between camera name and slide number.
  protected _cameraToSlide: Record<string, number> = {};

  /**
   * The updated lifecycle callback for this element.
   * @param changedProperties The properties that were changed in this render.
   */
  updated(changedProperties: PropertyValues): void {
    if (
      changedProperties.has('cameras') ||
      changedProperties.has('liveConfig') ||
      changedProperties.has('preloaded')
    ) {
      // All of these properties may fundamentally change the contents/size of
      // the DOM, and the carousel should be reset when they change.
      this._destroyCarousel();
    }

    if (changedProperties.has('view')) {
      const oldView = changedProperties.get('view') as View | undefined;
      if (
        this._carousel &&
        oldView &&
        this.view?.camera &&
        this.view?.camera != oldView.camera
      ) {
        const slide: number | undefined = this._cameraToSlide[this.view.camera];
        if (slide !== undefined && slide !== this.carouselSelected()) {
          this.carouselScrollTo(slide);
        }
      }
    }

    super.updated(changedProperties);
  }

  /**
   * Get the Embla options to use.
   * @returns An EmblaOptionsType object or undefined for no options.
   */
  protected _getOptions(): EmblaOptionsType {
    let startIndex = -1;
    if (this.cameras && this.view) {
      startIndex = Array.from(this.cameras.keys()).indexOf(this.view.camera);
    }

    return {
      startIndex: startIndex < 0 ? undefined : startIndex,
      draggable: this.liveConfig?.draggable,
    };
  }

  /**
   * Get the Embla plugins to use.
   * @returns An EmblaOptionsType object or undefined for no options.
   */
  protected _getPlugins(): EmblaPluginType[] | undefined {
    return [
      ...(this.liveConfig?.lazy_load
        ? [
            Lazyload({
              lazyloadCallback: this._lazyLoadSlide.bind(this),
            }),
          ]
        : []),
      MediaAutoPlayPause({
        playerSelector: 'frigate-card-live-provider',
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
  protected _selectSlideSetViewHandler(): void {
    if (!this._carousel || !this.view || !this.cameras) {
      return;
    }

    const selectedSnap = this._carousel.selectedScrollSnap();
    this.view
      .evolve({
        camera: Array.from(this.cameras.keys())[selectedSnap],
        previous: this.view,
      })
      .dispatchChangeEvent(this);
  }

  /**
   * Lazy load a slide.
   * @param _index The slide number to lazy load.
   * @param slide The slide to lazy load.
   */
  protected _lazyLoadSlide(_index: number, slide: HTMLElement): void {
    const liveProvider = slide.querySelector(
      'frigate-card-live-provider',
    ) as FrigateCardLiveProvider;
    if (liveProvider) {
      liveProvider.disabled = false;
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
    const conditionState = Object.assign({
      ...this.conditionState,
      camera: camera,
    });

    const config = getOverriddenConfig(
      this.liveConfig,
      this.liveOverrides,
      conditionState,
    ) as LiveConfig;

    return html` <div class="embla__slide">
      <frigate-card-live-provider
        ?disabled=${this.liveConfig.lazy_load}
        .cameraConfig=${cameraConfig}
        .label=${getCameraTitle(this.hass, cameraConfig)}
        .liveConfig=${config}
        .hass=${this.hass}
        @frigate-card:media-show=${(e: CustomEvent<MediaShowInfo>) =>
          this._mediaShowEventHandler(slideIndex, e)}
      >
      </frigate-card-live-provider>
    </div>`;
  }

  protected _getCameraNeighbors(): [CameraConfig | null, CameraConfig | null] {
    if (!this.cameras || !this.view || !this.hass) {
      return [null, null];
    }
    const keys = Array.from(this.cameras.keys());
    const currentIndex = keys.indexOf(this.view.camera);

    if (currentIndex < 0) {
      return [null, null];
    }

    let prev: CameraConfig | null = null,
      next: CameraConfig | null = null;
    if (currentIndex > 0) {
      prev = this.cameras.get(keys[currentIndex - 1]) ?? null;
    }
    if (currentIndex + 1 < this.cameras.size) {
      next = this.cameras.get(keys[currentIndex + 1]) ?? null;
    }
    return [prev, next];
  }

  /**
   * Handle updating of the next/previous controls when the carousel is moved.
   */
  protected _selectSlideNextPreviousHandler(): void {
    const updateNextPreviousControl = (
      control: FrigateCardNextPreviousControl,
      direction: 'previous' | 'next',
    ): void => {
      const [prev, next] = this._getCameraNeighbors();
      const target = direction == 'previous' ? prev : next;

      control.disabled = target == null;
      control.title = getCameraTitle(this.hass, target);
      control.icon = getCameraIcon(this.hass, target);
    };

    if (this._previousControlRef.value) {
      updateNextPreviousControl(this._previousControlRef.value, 'previous');
    }
    if (this._nextControlRef.value) {
      updateNextPreviousControl(this._nextControlRef.value, 'next');
    }
  }

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    const [slides, cameraToSlide] = this._getSlides();
    this._cameraToSlide = cameraToSlide;
    if (!slides || !this.liveConfig) {
      return;
    }

    const config = getOverriddenConfig(
      this.liveConfig,
      this.liveOverrides,
      this.conditionState,
    ) as LiveConfig;

    const [prev, next] = this._getCameraNeighbors();
    return html`
      <div class="embla">
        <frigate-card-next-previous-control
          ${ref(this._previousControlRef)}
          .direction=${'previous'}
          .controlConfig=${config.controls.next_previous}
          .label=${getCameraTitle(this.hass, prev)}
          .icon=${getCameraIcon(this.hass, prev)}
          ?disabled=${prev == null}
          @click=${() => {
            this._nextPreviousHandler('previous');
          }}
        >
        </frigate-card-next-previous-control>
        <div class="embla__viewport">
          <div class="embla__container">${slides}</div>
        </div>
        <frigate-card-next-previous-control
          ${ref(this._nextControlRef)}
          .direction=${'next'}
          .controlConfig=${config.controls.next_previous}
          .label=${getCameraTitle(this.hass, next)}
          .icon=${getCameraIcon(this.hass, next)}
          ?disabled=${next == null}
          @click=${() => {
            this._nextPreviousHandler('next');
          }}
        >
        </frigate-card-next-previous-control>
      </div>
    `;
  }
}

@customElement('frigate-card-live-provider')
export class FrigateCardLiveProvider extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected cameraConfig?: CameraConfig;

  @property({ attribute: false })
  protected liveConfig?: LiveConfig;

  // Whether or not to disable this entity. If `true`, no contents are rendered
  // until this attribute is set to `false` (this is useful for lazy loading).
  @property({ attribute: true, type: Boolean })
  public disabled = false;

  // Label that is used for ARIA support and as tooltip.
  @property({ attribute: false })
  public label = '';

  protected _providerRef: Ref<
    FrigateCardLiveFrigate | FrigateCardLiveJSMPEG | FrigateCardLiveWebRTC
  > = createRef();

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

  protected _getResolvedProvider(): LiveProvider {
    if (this.cameraConfig?.live_provider === 'auto') {
      if (this.cameraConfig?.webrtc?.entity || this.cameraConfig?.webrtc?.url) {
        return 'webrtc';
      } else if (this.cameraConfig?.camera_entity) {
        return 'frigate';
      } else if (this.cameraConfig?.camera_name) {
        return 'frigate-jsmpeg';
      }
      return frigateCardConfigDefaults.cameras.live_provider;
    }
    return (
      this.cameraConfig?.live_provider || frigateCardConfigDefaults.cameras.live_provider
    );
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

    return html`
      ${provider == 'frigate'
        ? html` <frigate-card-live-frigate
            ${ref(this._providerRef)}
            .hass=${this.hass}
            .cameraEntity=${this.cameraConfig.camera_entity}
          >
          </frigate-card-live-frigate>`
        : provider == 'webrtc'
        ? html`<frigate-card-live-webrtc
            ${ref(this._providerRef)}
            .hass=${this.hass}
            .cameraConfig=${this.cameraConfig}
            .webRTCConfig=${this.liveConfig.webrtc}
          >
          </frigate-card-live-webrtc>`
        : html` <frigate-card-live-jsmpeg
            ${ref(this._providerRef)}
            .hass=${this.hass}
            .cameraConfig=${this.cameraConfig}
            .jsmpegConfig=${this.liveConfig.jsmpeg}
          >
          </frigate-card-live-jsmpeg>`}
    `;
  }
}

@customElement('frigate-card-live-frigate')
export class FrigateCardLiveFrigate extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected cameraEntity?: string;

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
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass) {
      return;
    }

    if (!this.cameraEntity || !(this.cameraEntity in this.hass.states)) {
      return dispatchMessageEvent(
        this,
        localize('error.no_live_camera'),
        'mdi:camera-off',
      );
    }
    return html` <frigate-card-ha-camera-stream
      ${ref(this._playerRef)}
      .hass=${this.hass}
      .stateObj=${this.hass.states[this.cameraEntity]}
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

// Create a wrapper for the WebRTC element
//  - https://github.com/AlexxIT/WebRTC
@customElement('frigate-card-live-webrtc')
export class FrigateCardLiveWebRTC extends LitElement {
  @property({ attribute: false, hasChanged: contentsChanged })
  protected webRTCConfig?: WebRTCConfig;

  @property({ attribute: false })
  protected cameraConfig?: CameraConfig;

  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  /**
   * Play the video.
   */
  public play(): void {
    this._getPlayer()?.play().catch(() => {
      // WebRTC appears to generate additional spurious load events, which may
      // result in loads after a play() call, which causes the browser to spam
      // the logs unless the promise rejection is handled here.
    })
  }

  /**
   * Pause the video.
   */
  public pause(): void {
    this._getPlayer()?.pause();
  }

  /**
   * Get the underlying video player.
   * @returns The player or `null` if not found.
   */
  protected _getPlayer(): HTMLVideoElement | null {
    return this.renderRoot.querySelector('#video') as HTMLVideoElement | null;
  }

  /**
   * Create the WebRTC element. May throw.
   */
  protected _createWebRTC(): HTMLElement | undefined {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webrtcElement = customElements.get('webrtc-camera') as any;
    if (webrtcElement) {
      const webrtc = new webrtcElement();
      const config = { ...this.webRTCConfig };

      // If the live WebRTC configuration does not specify a URL/entity to use,
      // then take values from the camera configuration instead (if there are
      // any).
      if (!config.url) {
        config.url = this.cameraConfig?.webrtc?.url;
      }
      if (!config.entity) {
        config.entity = this.cameraConfig?.webrtc?.entity;
      }
      webrtc.setConfig(config);
      webrtc.hass = this.hass;
      return webrtc;
    } else {
      throw new FrigateCardError(localize('error.webrtc_missing'));
    }
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass) {
      return;
    }
    let webrtcElement: HTMLElement | undefined;
    try {
      webrtcElement = this._createWebRTC();
    } catch (e) {
      return dispatchErrorMessageEvent(
        this,
        e instanceof FrigateCardError
          ? (e as FrigateCardError).message
          : localize('error.webrtc_reported_error') + ': ' + (e as Error).message,
      );
    }
    return html`${webrtcElement}`;
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
        const onloadedmetadata = video.onloadedmetadata;
        const onplay = video.onplay;
        const onpause = video.onpause;

        video.onloadedmetadata = (e) => {
          if (onloadedmetadata) {
            onloadedmetadata.call(video, e);
          }
          dispatchMediaShowEvent(this, video);
        };
        video.onplay = (e) => {
          if (onplay) {
            onplay.call(video, e);
          }
          dispatchPlayEvent(this);
        };
        video.onpause = (e) => {
          if (onpause) {
            onpause.call(video, e);
          }
          dispatchPauseEvent(this);
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
  protected cameraConfig?: CameraConfig;

  @property({ attribute: false, hasChanged: contentsChanged })
  protected jsmpegConfig?: JSMPEGConfig;

  protected hass?: HomeAssistant & ExtendedHomeAssistant;

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
   * Get a signed player URL.
   * @returns A URL or null.
   */
  protected async _getURL(): Promise<string | null> {
    if (!this.hass || !this.cameraConfig?.client_id || !this.cameraConfig?.camera_name) {
      return null;
    }

    let response: string | null | undefined;
    try {
      response = await homeAssistantSignPath(
        this.hass,
        `/api/frigate/${this.cameraConfig.client_id}` +
          `/jsmpeg/${this.cameraConfig.camera_name}`,
        URL_SIGN_EXPIRY_SECONDS,
      );
    } catch (err) {
      console.warn(err);
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
          hooks: {
            play: () => {
              dispatchPlayEvent(this);
            },
            pause: () => {
              dispatchPauseEvent(this);
            },
          },
        },
        {
          pauseWhenHidden: false,
          protocols: [],
          audio: false,
          videoBufferSize: 1024 * 1024 * 4,
          // Override with user-specified options.
          ...this.jsmpegConfig?.options,
          onVideoDecode: () => {
            // This is the only callback that is called after the dimensions
            // are available. It's called on every frame decode, so just
            // ignore any subsequent calls.
            if (!videoDecoded && this._jsmpegCanvasElement) {
              videoDecoded = true;
              dispatchMediaShowEvent(this, this._jsmpegCanvasElement);
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

    if (!this.cameraConfig?.camera_name) {
      return dispatchErrorMessageEvent(
        this,
        localize('error.no_camera_name') + `: ${JSON.stringify(this.cameraConfig)}`,
      );
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
