import {
  CSSResultGroup,
  LitElement,
  TemplateResult,
  html,
  unsafeCSS,
  PropertyValues,
} from 'lit';
import {
  ExtendedHomeAssistant,
  CameraConfig,
  JSMPEGConfig,
  LiveConfig,
  MediaShowInfo,
  WebRTCCardConfig,
  FrigateCardError,
  FrigateCardMediaPlayer,
  LiveOverrides,
  LiveProvider,
  TransitionEffect,
  frigateCardConfigDefaults,
} from '../types.js';
import { EmblaOptionsType, EmblaPluginType } from 'embla-carousel';
import { HomeAssistant } from 'custom-card-helpers';
import JSMpeg from '@cycjimmy/jsmpeg-player';
import { Ref, createRef, ref } from 'lit/directives/ref.js';
import { Task } from '@lit-labs/task';
import { customElement, property, state } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';

import { AutoMediaPlugin, AutoMediaPluginType } from './embla-plugins/automedia.js';
import { BrowseMediaUtil } from '../browse-media-util.js';
import { ConditionState, getOverriddenConfig } from '../card-condition.js';
import { FrigateCardMediaCarousel } from './media-carousel.js';
import { FrigateCardNextPreviousControl } from './next-prev-control.js';
import { Lazyload } from './embla-plugins/lazyload.js';
import { View } from '../view.js';
import { localize } from '../localize/localize.js';
import {
  contentsChanged,
  dispatchErrorMessageEvent,
  dispatchExistingMediaShowInfoAsEvent,
  dispatchMediaShowEvent,
  getCameraIcon,
  getCameraTitle,
  homeAssistantSignPath,
  stopEventFromActivatingCardWideActions,
} from '../common.js';
import { renderProgressIndicator } from '../components/message.js';

import './next-prev-control.js';
import './title-control.js';

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
  protected hass?: ExtendedHomeAssistant;

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
      // If live is being pre-loaded, don't let the event propagate upwards yet
      // as the media is not really being shown.
      e.stopPropagation();
    }
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

    const browseMediaParams =
      BrowseMediaUtil.getFullDependentBrowseMediaQueryParametersOrDispatchError(
        this,
        this.hass,
        this.cameras,
        this.view.camera,
        config.controls.thumbnails.media,
      );

    if (!browseMediaParams) {
      return;
    }

    // Note use of liveConfig and not config below -- the carousel will
    // independently override the liveconfig to reflect the camera in the
    // carousel (not necessarily the selected camera).
    return html` <frigate-card-surround-thumbnails
      .hass=${this.hass}
      .view=${this.view}
      .config=${config.controls.thumbnails}
      .browseMediaParams=${browseMediaParams}
    >
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
    </frigate-card-surround-thumbnails>`;
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
  protected hass?: ExtendedHomeAssistant;

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
      this._carousel &&
      (changedProperties.has('cameras') || changedProperties.has('liveConfig'))
    ) {
      // All of these properties may fundamentally change the contents/size of
      // the DOM, and the carousel should be reset when they change.
      this._destroyCarousel();
    }

    super.updated(changedProperties);

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

    if (changedProperties.has('preloaded')) {
      const automedia = this._plugins['AutoMediaPlugin'] as
        | AutoMediaPluginType
        | undefined;
      if (automedia) {
        // If this has changed to preloaded then pause & mute, otherwise play
        // and potentially unmute (depending on configuration).
        if (this.preloaded) {
          automedia.pause();
          automedia.mute();
        } else {
          automedia.play();
          this._autoUnmuteHandler();
        }
      }
    }
  }

  /**
   * Get the transition effect to use.
   * @returns An TransitionEffect object.
   */
  protected _getTransitionEffect(): TransitionEffect | undefined {
    return this.liveConfig?.transition_effect;
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
      loop: true,
    };
  }

  /**
   * Get the Embla plugins to use.
   * @returns An EmblaOptionsType object or undefined for no options.
   */
  protected _getPlugins(): EmblaPluginType[] {
    return [
      ...super._getPlugins(),
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
   * Play the media on the loaded slide.
   */
  protected _autoPlayHandler(): void {
    if (
      this.liveConfig?.auto_play &&
      ['all', 'selected'].includes(this.liveConfig.auto_play)
    ) {
      super._autoPlayHandler();
    }
  }

  /**
   * Unmute the media on the loaded slide.
   */
   protected _autoUnmuteHandler(): void {
    if (
      this.liveConfig?.auto_unmute &&
      ['all', 'selected'].includes(this.liveConfig.auto_unmute)
    ) {
      super._autoUnmuteHandler();
    }
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

        // Reset the target so thumbnails will be re-fetched.
        target: null,
        childIndex: null,
      })
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
    slide: HTMLElement,
  ): void {
    const liveProvider = slide.querySelector(
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
    if (!slides || !this.liveConfig || !this.cameras || !this.view) {
      return;
    }

    const config = getOverriddenConfig(
      this.liveConfig,
      this.liveOverrides,
      this.conditionState,
    ) as LiveConfig;

    const [prev, next] = this._getCameraNeighbors();
    const title = getCameraTitle(this.hass, this.cameras.get(this.view.camera));

    return html`
      <div class="embla">
        <frigate-card-next-previous-control
          ${ref(this._previousControlRef)}
          .direction=${'previous'}
          .controlConfig=${config.controls.next_previous}
          .label=${getCameraTitle(this.hass, prev)}
          .icon=${getCameraIcon(this.hass, prev)}
          ?disabled=${prev == null}
          @click=${(ev) => {
            this._nextPreviousHandler('previous');
            stopEventFromActivatingCardWideActions(ev);
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
          @click=${(ev) => {
            this._nextPreviousHandler('next');
            stopEventFromActivatingCardWideActions(ev);
          }}
        >
        </frigate-card-next-previous-control>
      </div>
      <frigate-card-title-control
        ${ref(this._titleControlRef)}
        .config=${config.controls.title}
        .text="${title ? `${localize('common.live')}: ${title}` : ''}"
        .fitInto=${this as HTMLElement}
      >
      </frigate-card-title-control>
    `;
  }
}

@customElement('frigate-card-live-provider')
export class FrigateCardLiveProvider extends LitElement {
  @property({ attribute: false })
  protected hass?: ExtendedHomeAssistant;

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

  protected _getResolvedProvider(): LiveProvider {
    if (this.cameraConfig?.live_provider === 'auto') {
      if (
        this.cameraConfig?.webrtc_card?.entity ||
        this.cameraConfig?.webrtc_card?.url
      ) {
        return 'webrtc-card';
      } else if (this.cameraConfig?.camera_entity) {
        return 'ha';
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
      ${provider == 'ha'
        ? html` <frigate-card-live-ha
            ${ref(this._providerRef)}
            .hass=${this.hass}
            .cameraConfig=${this.cameraConfig}
          >
          </frigate-card-live-ha>`
        : provider == 'webrtc-card'
        ? html`<frigate-card-live-webrtc-card
            ${ref(this._providerRef)}
            .hass=${this.hass}
            .cameraConfig=${this.cameraConfig}
            .webRTCConfig=${this.liveConfig.webrtc_card}
          >
          </frigate-card-live-webrtc-card>`
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

@customElement('frigate-card-live-ha')
export class FrigateCardLiveFrigate extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant;

  @property({ attribute: false })
  protected cameraConfig?: CameraConfig;

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
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass) {
      return;
    }

    if (!this.cameraConfig?.camera_entity) {
      return dispatchErrorMessageEvent(
        this,
        localize('error.no_live_camera'),
        this.cameraConfig,
      );
    }

    const stateObj = this.hass.states[this.cameraConfig.camera_entity];
    if (!stateObj || stateObj.state === 'unavailable') {
      return dispatchErrorMessageEvent(
        this,
        localize('error.live_camera_unavailable'),
        this.cameraConfig,
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
  protected webRTCConfig?: WebRTCCardConfig;

  @property({ attribute: false })
  protected cameraConfig?: CameraConfig;

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
            ? (e as FrigateCardError).message
            : localize('error.webrtc_card_reported_error') + ': ' + (e as Error).message,
        );
      }
      return html`${webrtcElement}`;
    };

    // Use a task to allow us to asynchronously wait for the WebRTC card to
    // load, but yet still have the card load be followed by the updated()
    // lifecycle callback (unlike just using `until`).
    return html`${this._webrtcTask.render({
      initial: () => renderProgressIndicator(localize('error.webrtc_card_waiting')),
      pending: () => renderProgressIndicator(localize('error.webrtc_card_waiting')),
      error: (e: unknown) => dispatchErrorMessageEvent(this, (e as Error).message),
      complete: () => render(),
    })}`;
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

        video.onloadedmetadata = (e) => {
          if (onloadedmetadata) {
            onloadedmetadata.call(video, e);
          }
          dispatchMediaShowEvent(this, video);
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
