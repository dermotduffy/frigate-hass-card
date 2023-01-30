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
import { ConditionState, getOverriddenConfig } from '../../card-condition.js';
import { localize } from '../../localize/localize.js';
import liveStyle from '../../scss/live.scss';
import liveCarouselStyle from '../../scss/live-carousel.scss';
import liveProviderStyle from '../../scss/live-provider.scss';
import {
  CameraConfig,
  CardWideConfig,
  ExtendedHomeAssistant,
  frigateCardConfigDefaults,
  FrigateCardMediaPlayer,
  LiveConfig,
  LiveOverrides,
  LiveProvider,
  MediaLoadedInfo,
  Message,
  TransitionEffect,
} from '../../types.js';
import { stopEventFromActivatingCardWideActions } from '../../utils/action.js';
import { contentsChanged } from '../../utils/basic.js';
import {
  dispatchExistingMediaLoadedInfoAsEvent,
  dispatchMediaUnloadedEvent,
} from '../../utils/media-info.js';
import { dispatchViewContextChangeEvent, View } from '../../view/view.js';
import { AutoMediaPlugin } from './../embla-plugins/automedia.js';
import { Lazyload } from './../embla-plugins/lazyload.js';
import {
  FrigateCardMediaCarousel,
  wrapMediaLoadedEventForCarousel,
  wrapMediaUnloadedEventForCarousel,
} from '../media-carousel.js';
import '../next-prev-control.js';
import '../title-control.js';
import '../surround.js';
import { CarouselSelect, EmblaCarouselPlugins } from '../carousel.js';
import { classMap } from 'lit/directives/class-map.js';
import { updateElementStyleFromMediaLayoutConfig } from '../../utils/media-layout.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { HomeAssistant } from 'custom-card-helpers';
import { dispatchMessageEvent, dispatchErrorMessageEvent } from '../message.js';
import { HassEntity } from 'home-assistant-js-websocket';

/**
 * Get the state object or dispatch an error. Used in `ha` and `image` live
 * providers.
 * @param element HTMLElement to dispatch errors from.
 * @param hass Home Assistant object.
 * @param cameraConfig Camera configuration.
 * @returns
 */
export const getStateObjOrDispatchError = (
  element: HTMLElement,
  hass: HomeAssistant,
  cameraConfig?: CameraConfig,
): HassEntity | null => {
  if (!cameraConfig?.camera_entity) {
    dispatchErrorMessageEvent(element, localize('error.no_live_camera'), {
      context: cameraConfig,
    });
    return null;
  }

  const stateObj = hass.states[cameraConfig.camera_entity];
  if (!stateObj) {
    dispatchErrorMessageEvent(element, localize('error.live_camera_not_found'), {
      context: cameraConfig,
    });
    return null;
  }

  if (stateObj.state === 'unavailable') {
    dispatchMessageEvent(element, localize('error.live_camera_unavailable'), 'info', {
      icon: 'mdi:connection',
      context: cameraConfig,
    });
    return null;
  }
  return stateObj;
};

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
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

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
        .fetchMedia=${config.controls.thumbnails.media}
        .thumbnailConfig=${config.controls.thumbnails}
        .timelineConfig=${config.controls.timeline}
        .cameras=${this.cameras}
        .cameraManager=${this.cameraManager}
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
          .cardWideConfig=${this.cardWideConfig}
          .cameraManager=${this.cameraManager}
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

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

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

    if (frigateCardMediaCarousel && changedProperties.has('inBackground')) {
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

  protected _getSelectedCameraIndex(): number {
    if (!this.cameras || !this.view) {
      return 0;
    }
    return Math.max(0, Array.from(this.cameras.keys()).indexOf(this.view.camera));
  }

  /**
   * Get the Embla options to use.
   * @returns An EmblaOptionsType object or undefined for no options.
   */
  protected _getOptions(): EmblaOptionsType {
    return {
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
  protected _setViewHandler(ev: CustomEvent<CarouselSelect>): void {
    if (this.cameras && ev.detail.index !== this._getSelectedCameraIndex()) {
      this._setViewCameraID(Array.from(this.cameras.keys())[ev.detail.index]);
    }
  }

  protected _setViewCameraID(cameraID?: string | null): void {
    if (cameraID) {
      this.view
        ?.evolve({
          camera: cameraID,
          // Reset the query and query results.
          query: null,
          queryResults: null,
        })
        // Don't yet fetch thumbnails (they will be fetched when the carousel
        // settles).
        .mergeInContext({ thumbnails: { fetch: false } })
        .dispatchChangeEvent(this);
    }
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
    ) as FrigateCardLiveProvider | null;
    if (liveProvider) {
      liveProvider.disabled = action !== 'load';
    }
  }

  protected _renderLive(
    camera: string,
    cameraConfig: CameraConfig,
    slideIndex: number,
  ): TemplateResult | void {
    if (!this.liveConfig || !this.hass || !this.cameraManager) {
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

    const cameraMetadata = this.cameraManager.getCameraMetadata(this.hass, cameraConfig);

    return html`
      <div class="embla__slide">
        <frigate-card-live-provider
          ?disabled=${this.liveConfig.lazy_load}
          .cameraConfig=${cameraConfig}
          .label=${cameraMetadata?.title ?? ''}
          .liveConfig=${config}
          .hass=${this.hass}
          .cardWideConfig=${this.cardWideConfig}
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

  protected _getCameraIDsOfNeighbors(): [string | null, string | null] {
    if (!this.cameras || !this.view || !this.hass) {
      return [null, null];
    }
    const keys = Array.from(this.cameras.keys());
    const currentIndex = keys.indexOf(this.view.camera);

    if (currentIndex < 0 || this.cameras.size <= 1) {
      return [null, null];
    }

    return [
      keys[currentIndex > 0 ? currentIndex - 1 : this.cameras.size - 1],
      keys[currentIndex + 1 < this.cameras.size ? currentIndex + 1 : 0],
    ];
  }

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    const [slides, cameraToSlide] = this._getSlides();
    this._cameraToSlide = cameraToSlide;
    if (
      !slides.length ||
      !this.liveConfig ||
      !this.cameras ||
      !this.view ||
      !this.hass ||
      !this.cameraManager
    ) {
      return;
    }

    const config = getOverriddenConfig(
      this.liveConfig,
      this.liveOverrides,
      this.conditionState,
    ) as LiveConfig;

    const [prevID, nextID] = this._getCameraIDsOfNeighbors();

    const cameraMetadataPrevious = prevID ? this.cameraManager.getCameraMetadata(
      this.hass,
      this.cameras.get(prevID),
    ) : null;
    const cameraMetadataCurrent = this.cameraManager.getCameraMetadata(
      this.hass,
      this.cameras.get(this.view.camera),
    );
    const cameraMetadataNext = nextID ? this.cameraManager.getCameraMetadata(
      this.hass,
      this.cameras.get(nextID),
    ) : null;

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
        .label="${cameraMetadataCurrent ? `${localize('common.live')}: ${cameraMetadataCurrent.title}` : ''}"
        .titlePopupConfig=${config.controls.title}
        .selected=${this._getSelectedCameraIndex()}
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
          .label=${cameraMetadataPrevious?.title ?? ''}
          .icon=${cameraMetadataPrevious?.icon}
          ?disabled=${prevID === null}
          @click=${(ev) => {
            this._setViewCameraID(prevID);
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
          .label=${cameraMetadataNext?.title ?? ''}
          .icon=${cameraMetadataNext?.icon}
          ?disabled=${nextID === null}
          @click=${(ev) => {
            this._setViewCameraID(nextID);
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

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

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
        if (this.cardWideConfig?.performance?.profile === 'low') {
          return 'image';
        } else {
          return 'ha';
        }
      } else if (this.cameraConfig?.frigate.camera_name) {
        return 'frigate-jsmpeg';
      }
      return frigateCardConfigDefaults.cameras.live_provider;
    }
    return this.cameraConfig?.live_provider || 'image';
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
      if (this.liveConfig?.show_image_during_load) {
        import('./live-image.js');
      }
    }
    if (changedProps.has('cameraConfig')) {
      const provider = this._getResolvedProvider();
      if (provider === 'frigate-jsmpeg') {
        import('./live-jsmpeg.js');
      } else if (provider === 'ha') {
        import('./live-ha.js');
      } else if (provider === 'webrtc-card') {
        import('./live-webrtc.js');
      } else if (provider === 'image') {
        import('./live-image.js');
      }
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
    const showImageDuringLoading =
      !this._isVideoMediaLoaded && this._shouldShowImageDuringLoading();
    const providerClasses = {
      hidden: showImageDuringLoading,
    };

    return html`
      ${showImageDuringLoading || provider === 'image'
        ? html`<frigate-card-live-image
            ${ref(this._providerRef)}
            .hass=${this.hass}
            .cameraConfig=${this.cameraConfig}
            .liveImageConfig=${this.liveConfig.image}
            @frigate-card:media:loaded=${() => {
              if (provider === 'image') {
                // Only count the media has loaded if the required provider is
                // the image (not just the temporary image shown during
                // loading).
                this._videoMediaShowHandler();
              }
            }}
          >
          </frigate-card-live-image>`
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
            .cardWideConfig=${this.cardWideConfig}
            @frigate-card:media:loaded=${this._videoMediaShowHandler.bind(this)}
          >
          </frigate-card-live-webrtc-card>`
        : provider === 'frigate-jsmpeg'
        ? html` <frigate-card-live-jsmpeg
            ${ref(this._providerRef)}
            class=${classMap(providerClasses)}
            .hass=${this.hass}
            .cameraConfig=${this.cameraConfig}
            .jsmpegConfig=${this.liveConfig.jsmpeg}
            .cardWideConfig=${this.cardWideConfig}
            @frigate-card:media:loaded=${this._videoMediaShowHandler.bind(this)}
          >
          </frigate-card-live-jsmpeg>`
        : html``}
    `;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(liveProviderStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-live-provider': FrigateCardLiveProvider;
    'frigate-card-live-carousel': FrigateCardLiveCarousel;
    'frigate-card-live': FrigateCardLive;
  }
}
