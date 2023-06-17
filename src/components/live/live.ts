import { HomeAssistant } from 'custom-card-helpers';
import { EmblaOptionsType } from 'embla-carousel';
import { WheelGesturesPlugin } from 'embla-carousel-wheel-gestures';
import { HassEntity } from 'home-assistant-js-websocket';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { guard } from 'lit/directives/guard.js';
import { keyed } from 'lit/directives/keyed.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { CameraEndpoints } from '../../camera-manager/types.js';
import { ConditionControllerEpoch, getOverriddenConfig } from '../../conditions.js';
import { localize } from '../../localize/localize.js';
import liveCarouselStyle from '../../scss/live-carousel.scss';
import liveProviderStyle from '../../scss/live-provider.scss';
import liveStyle from '../../scss/live.scss';
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
import { updateElementStyleFromMediaLayoutConfig } from '../../utils/media-layout.js';
import { playMediaMutingIfNecessary } from '../../utils/media.js';
import { dispatchViewContextChangeEvent, View } from '../../view/view.js';
import { CarouselSelect, EmblaCarouselPlugins } from '../carousel.js';
import {
  FrigateCardMediaCarousel,
  wrapMediaLoadedEventForCarousel,
  wrapMediaUnloadedEventForCarousel,
} from '../media-carousel.js';
import { dispatchErrorMessageEvent, dispatchMessageEvent } from '../message.js';
import '../next-prev-control.js';
import '../surround.js';
import '../title-control.js';
import { AutoMediaPlugin } from './../embla-plugins/automedia.js';
import { Lazyload } from './../embla-plugins/lazyload.js';

interface LiveViewContext {
  // A cameraID override (used for dependencies/substreams to force a different
  // camera to be live rather than the camera selected in the view).
  overrides?: Map<string, string>;
}

declare module 'view' {
  interface ViewContext {
    live?: LiveViewContext;
  }
}

interface LastMediaLoadedInfo {
  mediaLoadedInfo: MediaLoadedInfo;
  source: EventTarget;
}

const FRIGATE_CARD_LIVE_PROVIDER = 'frigate-card-live-provider';

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
  public conditionControllerEpoch?: ConditionControllerEpoch;

  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public liveConfig?: LiveConfig;

  @property({ attribute: false, hasChanged: contentsChanged })
  public liveOverrides?: LiveOverrides;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public microphoneStream?: MediaStream;

  // Whether or not the live view is currently in the background (i.e. preloaded
  // but not visible)
  @state()
  protected _inBackground?: boolean = false;

  // Intersection handler is used to detect when the live view flips between
  // foreground and background (in preload mode).
  protected _intersectionObserver: IntersectionObserver;

  // MediaLoadedInfo object and target from the underlying live object. In the
  // case of pre-loading these may be propagated later (from the original
  // source).
  protected _lastMediaLoadedInfo: LastMediaLoadedInfo | null = null;

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
      this._lastMediaLoadedInfo
    ) {
      // If this isn't being rendered in the background, the last render did not
      // generate a message and there's a saved MediaInfo, dispatch it upwards.
      dispatchExistingMediaLoadedInfoAsEvent(
        // Specifically dispatch the event "where it came from", as otherwise
        // the intermediate layers (e.g. media-carousel which controls the title
        // popups) will not re-receive the events.
        this._lastMediaLoadedInfo.source,
        this._lastMediaLoadedInfo.mediaLoadedInfo,
      );
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
    if (!this.hass || !this.liveConfig || !this.cameraManager || !this.view) {
      return;
    }

    // Notes:
    // - See use of liveConfig and not config below -- the carousel will
    //   independently override the liveConfig to reflect the camera in the
    //   carousel (not necessarily the selected camera).
    // - Various events are captured to prevent them propagating upwards if the
    //   card is in the background.
    // - The entire returned template is keyed to allow for the whole template
    //   to be re-rendered in certain circumstances (specifically: if a message
    //   is received when the card is in the background).
    const result = html`${keyed(
      this._renderKey,
      html`
        <frigate-card-live-carousel
          .hass=${this.hass}
          .view=${this.view}
          .liveConfig=${this.liveConfig}
          .inBackground=${this._inBackground}
          .conditionControllerEpoch=${this.conditionControllerEpoch}
          .liveOverrides=${this.liveOverrides}
          .cardWideConfig=${this.cardWideConfig}
          .cameraManager=${this.cameraManager}
          .microphoneStream=${this.microphoneStream}
          @frigate-card:message=${(ev: CustomEvent<Message>) => {
            this._renderKey++;
            this._messageReceivedPostRender = true;
            if (this._inBackground) {
              ev.stopPropagation();
            }
          }}
          @frigate-card:media:loaded=${(ev: CustomEvent<MediaLoadedInfo>) => {
            this._lastMediaLoadedInfo = {
              source: ev.composedPath()[0],
              mediaLoadedInfo: ev.detail,
            };
            if (this._inBackground) {
              ev.stopPropagation();
            }
          }}
          @frigate-card:view:change=${(ev: CustomEvent<View>) => {
            if (this._inBackground) {
              ev.stopPropagation();
            }
          }}
        >
        </frigate-card-live-carousel>
      `,
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
  public liveConfig?: LiveConfig;

  @property({ attribute: false, hasChanged: contentsChanged })
  public liveOverrides?: LiveOverrides;

  @property({ attribute: false })
  public inBackground?: boolean;

  @property({ attribute: false })
  public conditionControllerEpoch?: ConditionControllerEpoch;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public microphoneStream?: MediaStream;

  // Index between camera name and slide number.
  protected _cameraToSlide: Record<string, number> = {};
  protected _refMediaCarousel: Ref<FrigateCardMediaCarousel> = createRef();

  /**
   * The updated lifecycle callback for this element.
   * @param changedProperties The properties that were changed in this render.
   */
  updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (changedProperties.has('inBackground')) {
      this.updateComplete.then(async () => {
        const frigateCardMediaCarousel = this._refMediaCarousel.value;
        if (frigateCardMediaCarousel) {
          await frigateCardMediaCarousel.updateComplete;
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
      });
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
    const cameraIDs = this.cameraManager?.getStore().getVisibleCameraIDs();
    if (!cameraIDs || !this.view) {
      return 0;
    }
    return Math.max(0, Array.from(cameraIDs).indexOf(this.view.camera));
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
    const cameras = this.cameraManager?.getStore().getVisibleCameraIDs();
    return [
      // Only enable wheel plugin if there is more than one camera.
      ...(cameras && cameras.size > 1
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
        playerSelector: FRIGATE_CARD_LIVE_PROVIDER,
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
    const visibleCameras = this.cameraManager?.getStore().getVisibleCameras();
    if (!visibleCameras) {
      return [[], {}];
    }

    const slides: TemplateResult[] = [];
    const cameraToSlide: Record<string, number> = {};

    for (const [cameraID, cameraConfig] of visibleCameras) {
      const liveCameraID =
        this.view?.context?.live?.overrides?.get(cameraID) ?? cameraID;
      const liveCameraConfig =
        cameraID === liveCameraID
          ? cameraConfig
          : this.cameraManager?.getStore().getCameraConfig(liveCameraID);

      const slide = liveCameraConfig
        ? this._renderLive(liveCameraID, liveCameraConfig, slides.length)
        : null;
      if (slide) {
        cameraToSlide[cameraID] = slides.length;
        slides.push(slide);
      }
    }
    return [slides, cameraToSlide];
  }

  /**
   * Handle the user selecting a new slide in the carousel.
   */
  protected _setViewHandler(ev: CustomEvent<CarouselSelect>): void {
    const cameras = this.cameraManager?.getStore().getVisibleCameras();
    if (cameras && ev.detail.index !== this._getSelectedCameraIndex()) {
      this._setViewCameraID(Array.from(cameras.keys())[ev.detail.index]);
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
      FRIGATE_CARD_LIVE_PROVIDER,
    ) as FrigateCardLiveProvider | null;
    if (liveProvider) {
      liveProvider.disabled = action !== 'load';
    }
  }

  protected _renderLive(
    cameraID: string,
    cameraConfig: CameraConfig,
    slideIndex: number,
  ): TemplateResult | void {
    if (
      !this.liveConfig ||
      !this.hass ||
      !this.cameraManager ||
      !this.conditionControllerEpoch
    ) {
      return;
    }
    // The condition controller object contains the currently live camera, which
    // (in the carousel for example) is not necessarily the live camera *this*
    // <frigate-card-live-provider> is rendering right now, so we provide a
    // stateOverride to evaluate the condition in that context.
    const config = getOverriddenConfig(
      this.conditionControllerEpoch.controller,
      this.liveConfig,
      this.liveOverrides,
      { camera: cameraID },
    ) as LiveConfig;

    const cameraMetadata = this.cameraManager.getCameraMetadata(this.hass, cameraID);

    return html`
      <div class="embla__slide">
        <frigate-card-live-provider
          ?disabled=${this.liveConfig.lazy_load}
          .microphoneStream=${this.view?.camera === cameraID
            ? this.microphoneStream
            : undefined}
          .cameraConfig=${cameraConfig}
          .cameraEndpoints=${guard(
            [this.cameraManager, cameraID],
            () => this.cameraManager?.getCameraEndpoints(cameraID) ?? undefined,
          )}
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
    const cameras = this.cameraManager?.getStore().getVisibleCameras();
    if (!cameras || !this.view || !this.hass) {
      return [null, null];
    }
    const keys = Array.from(cameras.keys());
    const currentIndex = keys.indexOf(this.view.camera);

    if (currentIndex < 0 || cameras.size <= 1) {
      return [null, null];
    }

    return [
      keys[currentIndex > 0 ? currentIndex - 1 : cameras.size - 1],
      keys[currentIndex + 1 < cameras.size ? currentIndex + 1 : 0],
    ];
  }

  /**
   * Render the element.
   * @returns A template to display to the user.
   */
  protected render(): TemplateResult | void {
    if (!this.liveConfig || !this.view || !this.hass || !this.cameraManager) {
      return;
    }

    const [slides, cameraToSlide] = this._getSlides();
    this._cameraToSlide = cameraToSlide;
    if (!slides.length) {
      return;
    }

    const [prevID, nextID] = this._getCameraIDsOfNeighbors();

    const overrideCameraID = (cameraID: string): string => {
      return this.view?.context?.live?.overrides?.get(cameraID) ?? cameraID;
    };

    const cameraMetadataPrevious = prevID
      ? this.cameraManager.getCameraMetadata(this.hass, overrideCameraID(prevID))
      : null;
    const cameraMetadataCurrent = this.cameraManager.getCameraMetadata(
      this.hass,
      overrideCameraID(this.view.camera),
    );
    const cameraMetadataNext = nextID
      ? this.cameraManager.getCameraMetadata(this.hass, overrideCameraID(nextID))
      : null;

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
          [this.cameraManager, this.liveConfig],
          this._getOptions.bind(this),
        )}
        .carouselPlugins=${guard(
          [this.cameraManager, this.liveConfig],
          this._getPlugins.bind(this),
        ) as EmblaCarouselPlugins}
        .label="${cameraMetadataCurrent
          ? `${localize('common.live')}: ${cameraMetadataCurrent.title}`
          : ''}"
        .logo="${cameraMetadataCurrent?.engineLogo}"
        .titlePopupConfig=${this.liveConfig.controls.title}
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
          .controlConfig=${this.liveConfig.controls.next_previous}
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
          .controlConfig=${this.liveConfig.controls.next_previous}
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

@customElement(FRIGATE_CARD_LIVE_PROVIDER)
export class FrigateCardLiveProvider
  extends LitElement
  implements FrigateCardMediaPlayer
{
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: false })
  public cameraEndpoints?: CameraEndpoints;

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

  @property({ attribute: false })
  public microphoneStream?: MediaStream;

  @state()
  protected _isVideoMediaLoaded = false;

  protected _refProvider: Ref<LitElement & FrigateCardMediaPlayer> = createRef();

  // A note on dynamic imports:
  //
  // We gather the dynamic live provider import promises and do not consider the
  // update of the element complete until these imports have returned. Without
  // this behavior calls to the media methods (e.g. `mute()`) may throw if the
  // underlying code is not yet loaded.
  //
  // Test case: A card with a non-live view, but live pre-loaded, attempts to
  // call mute() when the <frigate-card-live> element first renders in the
  // background. These calls fail without waiting for loading here.
  protected _importPromises: Promise<unknown>[] = [];

  public async play(): Promise<void> {
    await this.updateComplete;
    await this._refProvider.value?.updateComplete;
    await playMediaMutingIfNecessary(this, this._refProvider.value);
  }

  public async pause(): Promise<void> {
    await this.updateComplete;
    await this._refProvider.value?.updateComplete;
    await this._refProvider.value?.pause();
  }

  public async mute(): Promise<void> {
    await this.updateComplete;
    await this._refProvider.value?.updateComplete;
    await this._refProvider.value?.mute();
  }

  public async unmute(): Promise<void> {
    await this.updateComplete;
    await this._refProvider.value?.updateComplete;
    await this._refProvider.value?.unmute();
  }

  public isMuted(): boolean {
    return this._refProvider.value?.isMuted() ?? true;
  }

  public async seek(seconds: number): Promise<void> {
    await this.updateComplete;
    await this._refProvider.value?.updateComplete;
    await this._refProvider.value?.seek(seconds);
  }

  public async setControls(controls?: boolean): Promise<void> {
    await this.updateComplete;
    await this._refProvider.value?.updateComplete;
    await this._refProvider.value?.setControls(controls);
  }

  public isPaused(): boolean {
    return this._refProvider.value?.isPaused() ?? true;
  }

  public async getScreenshotURL(): Promise<string | null> {
    await this.updateComplete;
    await this._refProvider.value?.updateComplete;
    return await this._refProvider.value?.getScreenshotURL() ?? null;
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
        return 'jsmpeg';
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
        this._importPromises.push(import('./live-image.js'));
      }
      if (this.liveConfig?.zoomable) {
        this._importPromises.push(import('./../zoomer.js'));
      }
    }
    if (changedProps.has('cameraConfig')) {
      const provider = this._getResolvedProvider();
      if (provider === 'jsmpeg') {
        this._importPromises.push(import('./live-jsmpeg.js'));
      } else if (provider === 'ha') {
        this._importPromises.push(import('./live-ha.js'));
      } else if (provider === 'webrtc-card') {
        this._importPromises.push(import('./live-webrtc-card.js'));
      } else if (provider === 'image') {
        this._importPromises.push(import('./live-image.js'));
      } else if (provider === 'go2rtc') {
        this._importPromises.push(import('./live-go2rtc.js'));
      }
    }
  }

  override async getUpdateComplete(): Promise<boolean> {
    // See 'A note on dynamic imports' above for explanation of why this is
    // necessary.
    const result = await super.getUpdateComplete();
    await Promise.all(this._importPromises);
    this._importPromises = [];
    return result;
  }

  protected _useZoomIfRequired(template: TemplateResult): TemplateResult {
    return this.liveConfig?.zoomable
      ? html` <frigate-card-zoomer
          @frigate-card:zoom:zoomed=${() => this.setControls(false)}
          @frigate-card:zoom:unzoomed=${() => this.setControls()}
        >
          ${template}
        </frigate-card-zoomer>`
      : template;
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

    return this._useZoomIfRequired(html`
      ${showImageDuringLoading || provider === 'image'
        ? html` <frigate-card-live-image
            ${ref(this._refProvider)}
            .hass=${this.hass}
            .cameraConfig=${this.cameraConfig}
            @frigate-card:media:loaded=${(ev: Event) => {
              if (provider === 'image') {
                // Only count the media has loaded if the required provider is
                // the image (not just the temporary image shown during
                // loading).
                this._videoMediaShowHandler();
              } else {
                ev.stopPropagation();
              }
            }}
          >
          </frigate-card-live-image>`
        : html``}
      ${provider === 'ha'
        ? html` <frigate-card-live-ha
            ${ref(this._refProvider)}
            class=${classMap(providerClasses)}
            .hass=${this.hass}
            .cameraConfig=${this.cameraConfig}
            ?controls=${this.liveConfig.controls.builtin}
            @frigate-card:media:loaded=${this._videoMediaShowHandler.bind(this)}
          >
          </frigate-card-live-ha>`
        : provider === 'go2rtc'
        ? html`<frigate-card-live-go2rtc
              ${ref(this._refProvider)}
              class=${classMap(providerClasses)}
              .hass=${this.hass}
              .cameraConfig=${this.cameraConfig}
              .cameraEndpoints=${this.cameraEndpoints}
              .microphoneStream=${this.microphoneStream}
              .microphoneConfig=${this.liveConfig.microphone}
              ?controls=${this.liveConfig.controls.builtin}
              @frigate-card:media:loaded=${this._videoMediaShowHandler.bind(this)}
            >
            </frigate-card-live-webrtc-card>`
        : provider === 'webrtc-card'
        ? html`<frigate-card-live-webrtc-card
            ${ref(this._refProvider)}
            class=${classMap(providerClasses)}
            .hass=${this.hass}
            .cameraConfig=${this.cameraConfig}
            .cameraEndpoints=${this.cameraEndpoints}
            .cardWideConfig=${this.cardWideConfig}
            ?controls=${this.liveConfig.controls.builtin}
            @frigate-card:media:loaded=${this._videoMediaShowHandler.bind(this)}
          >
          </frigate-card-live-webrtc-card>`
        : provider === 'jsmpeg'
        ? html` <frigate-card-live-jsmpeg
            ${ref(this._refProvider)}
            class=${classMap(providerClasses)}
            .hass=${this.hass}
            .cameraConfig=${this.cameraConfig}
            .cameraEndpoints=${this.cameraEndpoints}
            .cardWideConfig=${this.cardWideConfig}
            @frigate-card:media:loaded=${this._videoMediaShowHandler.bind(this)}
          >
          </frigate-card-live-jsmpeg>`
        : html``}
    `);
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveProviderStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    FRIGATE_CARD_LIVE_PROVIDER: FrigateCardLiveProvider;
    'frigate-card-live-carousel': FrigateCardLiveCarousel;
    'frigate-card-live': FrigateCardLive;
  }
}
