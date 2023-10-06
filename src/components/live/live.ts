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
import { ifDefined } from 'lit/directives/if-defined.js';
import { keyed } from 'lit/directives/keyed.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { CameraConfigs, CameraEndpoints } from '../../camera-manager/types.js';
import {
  ConditionsManagerEpoch,
  getOverriddenConfig,
} from '../../card-controller/conditions-manager.js';
import { MediaGridSelected } from '../../components-lib/media-grid-controller.js';
import {
  CameraConfig,
  CardWideConfig,
  frigateCardConfigDefaults,
  LiveConfig,
  LiveOverrides,
  LiveProvider,
  TransitionEffect,
} from '../../config/types.js';
import { localize } from '../../localize/localize.js';
import basicBlockStyle from '../../scss/basic-block.scss';
import liveCarouselStyle from '../../scss/live-carousel.scss';
import liveProviderStyle from '../../scss/live-provider.scss';
import {
  ExtendedHomeAssistant,
  FrigateCardMediaPlayer,
  MediaLoadedInfo,
  Message,
} from '../../types.js';
import { stopEventFromActivatingCardWideActions } from '../../utils/action.js';
import { contentsChanged } from '../../utils/basic.js';
import { CarouselSelected } from '../../utils/embla/carousel-controller.js';
import { AutoLazyLoad } from '../../utils/embla/plugins/auto-lazy-load/auto-lazy-load.js';
import { AutoMediaActions } from '../../utils/embla/plugins/auto-media-actions/auto-media-actions.js';
import AutoMediaLoadedInfo from '../../utils/embla/plugins/auto-media-loaded-info/auto-media-loaded-info.js';
import AutoSize from '../../utils/embla/plugins/auto-size/auto-size.js';
import {
  dispatchExistingMediaLoadedInfoAsEvent,
  dispatchMediaUnloadedEvent,
} from '../../utils/media-info.js';
import { updateElementStyleFromMediaLayoutConfig } from '../../utils/media-layout.js';
import { playMediaMutingIfNecessary } from '../../utils/media.js';
import { Timer } from '../../utils/timer.js';
import { dispatchViewContextChangeEvent, View } from '../../view/view.js';
import { EmblaCarouselPlugins } from '../carousel.js';
import { renderMessage } from '../message.js';
import '../next-prev-control.js';
import '../surround.js';
import '../title-control.js';
import {
  FrigateCardTitleControl,
  getDefaultTitleConfigForView,
  showTitleControlAfterDelay,
} from '../title-control.js';
import { getStateObjOrDispatchError } from '../../utils/get-state-obj.js';

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

@customElement('frigate-card-live')
export class FrigateCardLive extends LitElement {
  @property({ attribute: false })
  public conditionsManagerEpoch?: ConditionsManagerEpoch;

  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public nonOverriddenLiveConfig?: LiveConfig;

  @property({ attribute: false })
  public overriddenLiveConfig?: LiveConfig;

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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldUpdate(_changedProps: PropertyValues): boolean {
    // Don't process updates if it's in the background and a message was
    // received (otherwise an error message thrown by the background live
    // component may continually be re-spammed hitting performance).
    return !this._inBackground || !this._messageReceivedPostRender;
  }

  connectedCallback(): void {
    this._intersectionObserver.observe(this);
    super.connectedCallback();
  }

  disconnectedCallback(): void {
    super.disconnectedCallback();
    this._intersectionObserver.disconnect();
  }

  protected render(): TemplateResult | void {
    if (
      !this.hass ||
      !this.nonOverriddenLiveConfig ||
      !this.cameraManager ||
      !this.view
    ) {
      return;
    }

    // Notes:
    // - See use of liveConfig and not config below -- the underlying carousel
    //   will independently override the liveConfig to reflect the camera in the
    //   carousel (not necessarily the selected camera).
    // - Various events are captured to prevent them propagating upwards if the
    //   card is in the background.
    // - The entire returned template is keyed to allow for the whole template
    //   to be re-rendered in certain circumstances (specifically: if a message
    //   is received when the card is in the background).
    const result = html`${keyed(
      this._renderKey,
      html`
        <frigate-card-live-grid
          .hass=${this.hass}
          .view=${this.view}
          .nonOverriddenLiveConfig=${this.nonOverriddenLiveConfig}
          .overriddenLiveConfig=${this.overriddenLiveConfig}
          .inBackground=${this._inBackground}
          .conditionsManagerEpoch=${this.conditionsManagerEpoch}
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
        </frigate-card-live-grid>
      `,
    )}`;

    this._messageReceivedPostRender = false;
    return result;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
  }
}

@customElement('frigate-card-live-grid')
export class FrigateCardLiveGrid extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public nonOverriddenLiveConfig?: LiveConfig;

  @property({ attribute: false })
  public overriddenLiveConfig?: LiveConfig;

  @property({ attribute: false, hasChanged: contentsChanged })
  public liveOverrides?: LiveOverrides;

  @property({ attribute: false })
  public conditionsManagerEpoch?: ConditionsManagerEpoch;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public microphoneStream?: MediaStream;

  protected _renderCarousel(cameraID?: string): TemplateResult {
    return html`
      <frigate-card-live-carousel
        grid-id=${ifDefined(cameraID)}
        .hass=${this.hass}
        .view=${this.view}
        .viewFilterCameraID=${cameraID}
        .nonOverriddenLiveConfig=${this.nonOverriddenLiveConfig}
        .overriddenLiveConfig=${this.overriddenLiveConfig}
        .conditionsManagerEpoch=${this.conditionsManagerEpoch}
        .liveOverrides=${this.liveOverrides}
        .cardWideConfig=${this.cardWideConfig}
        .cameraManager=${this.cameraManager}
        .microphoneStream=${this.microphoneStream}
      >
      </frigate-card-live-carousel>
    `;
  }

  protected _gridSelectCamera(cameraID: string, view?: View): void {
    (view ?? this.view)
      ?.evolve({
        camera: cameraID,
      })
      .dispatchChangeEvent(this);
  }

  protected _needsGrid(): boolean {
    const cameraIDs = this.cameraManager?.getStore().getVisibleCameraIDs();
    return (
      !!this.view?.isGrid() &&
      !!this.view?.supportsMultipleDisplayModes() &&
      !!cameraIDs &&
      cameraIDs.size > 1
    );
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('view') && this._needsGrid()) {
      import('../media-grid.js');
    }
  }

  protected render(): TemplateResult | void {
    if (!this.conditionsManagerEpoch || !this.nonOverriddenLiveConfig) {
      return;
    }
    const cameraIDs = this.cameraManager?.getStore().getVisibleCameraIDs();
    if (!cameraIDs || !this._needsGrid()) {
      return this._renderCarousel();
    }
    return html`
      <frigate-card-media-grid
        .selected=${this.view?.camera}
        .displayConfig=${this.overriddenLiveConfig?.display}
        @frigate-card:media-grid:selected=${(ev: CustomEvent<MediaGridSelected>) =>
          this._gridSelectCamera(ev.detail.selected)}
        @frigate-card:view:change=${(ev: CustomEvent<View>) => {
          ev.stopPropagation();
          this._gridSelectCamera(ev.detail.camera, ev.detail);
        }}
      >
        ${[...cameraIDs].map((cameraID) => this._renderCarousel(cameraID))}
      </frigate-card-media-grid>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
  }
}

@customElement('frigate-card-live-carousel')
export class FrigateCardLiveCarousel extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public nonOverriddenLiveConfig?: LiveConfig;

  @property({ attribute: false })
  public overriddenLiveConfig?: LiveConfig;

  @property({ attribute: false, hasChanged: contentsChanged })
  public liveOverrides?: LiveOverrides;

  @property({ attribute: false })
  public conditionsManagerEpoch?: ConditionsManagerEpoch;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public microphoneStream?: MediaStream;

  @property({ attribute: false })
  public viewFilterCameraID?: string;

  // Index between camera name and slide number.
  protected _cameraToSlide: Record<string, number> = {};
  protected _titleTimer = new Timer();
  protected _refTitleControl: Ref<FrigateCardTitleControl> = createRef();

  protected _getTransitionEffect(): TransitionEffect {
    return (
      this.overriddenLiveConfig?.transition_effect ??
      frigateCardConfigDefaults.live.transition_effect
    );
  }

  protected _getSelectedCameraIndex(): number {
    const cameraIDs = this.cameraManager?.getStore().getVisibleCameraIDs();
    if (!cameraIDs || !this.view || this.viewFilterCameraID) {
      // If the carousel is limited to a single cameraID, the first (only)
      // element is always the selected one.
      return 0;
    }
    return Math.max(0, Array.from(cameraIDs).indexOf(this.view.camera));
  }

  protected _getPlugins(): EmblaCarouselPlugins {
    return [
      AutoLazyLoad({
        ...(this.overriddenLiveConfig?.lazy_load && {
          lazyLoadCallback: (index, slide) =>
            this._lazyloadOrUnloadSlide('load', index, slide),
        }),
        lazyUnloadCondition: this.overriddenLiveConfig?.lazy_unload,
        lazyUnloadCallback: (index, slide) =>
          this._lazyloadOrUnloadSlide('unload', index, slide),
      }),
      AutoMediaLoadedInfo(),
      AutoMediaActions({
        playerSelector: FRIGATE_CARD_LIVE_PROVIDER,
        ...(this.overriddenLiveConfig?.auto_play && {
          autoPlayCondition: this.overriddenLiveConfig.auto_play,
        }),
        ...(this.overriddenLiveConfig?.auto_pause && {
          autoPauseCondition: this.overriddenLiveConfig.auto_pause,
        }),
        ...(this.overriddenLiveConfig?.auto_mute && {
          autoMuteCondition: this.overriddenLiveConfig.auto_mute,
        }),
        ...(this.overriddenLiveConfig?.auto_unmute && {
          autoUnmuteCondition: this.overriddenLiveConfig.auto_unmute,
        }),
      }),
      AutoSize(),
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
    return this.overriddenLiveConfig?.lazy_load === false ? null : 0;
  }

  protected _getSlides(): [TemplateResult[], Record<string, number>] {
    let cameras: CameraConfigs | null = null;
    if (this.viewFilterCameraID) {
      const config = this.cameraManager
        ?.getStore()
        .getCameraConfig(this.viewFilterCameraID);
      if (config) {
        cameras = new Map([[this.viewFilterCameraID, config]]);
      }
    } else {
      cameras = this.cameraManager?.getStore().getVisibleCameras() ?? null;
    }
    if (!cameras) {
      return [[], {}];
    }

    const slides: TemplateResult[] = [];
    const cameraToSlide: Record<string, number> = {};

    for (const [cameraID, cameraConfig] of cameras) {
      const liveCameraID =
        this.view?.context?.live?.overrides?.get(cameraID) ?? cameraID;
      const liveCameraConfig =
        cameraID === liveCameraID
          ? cameraConfig
          : this.cameraManager?.getStore().getCameraConfig(liveCameraID);

      const slide = liveCameraConfig
        ? this._renderLive(liveCameraID, liveCameraConfig)
        : null;
      if (slide) {
        cameraToSlide[cameraID] = slides.length;
        slides.push(slide);
      }
    }
    return [slides, cameraToSlide];
  }

  protected _setViewHandler(ev: CustomEvent<CarouselSelected>): void {
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
      liveProvider.load = action === 'load';
    }
  }

  protected _renderLive(
    cameraID: string,
    cameraConfig: CameraConfig,
  ): TemplateResult | void {
    if (
      !this.overriddenLiveConfig ||
      !this.nonOverriddenLiveConfig ||
      !this.hass ||
      !this.cameraManager ||
      !this.conditionsManagerEpoch
    ) {
      return;
    }
    // The condition controller object contains the currently live camera, which
    // (in the carousel for example) is not necessarily the live camera *this*
    // <frigate-card-live-provider> is rendering right now, so we provide a
    // stateOverride to evaluate the condition in that context.
    const config = getOverriddenConfig(
      this.conditionsManagerEpoch.manager,
      this.nonOverriddenLiveConfig,
      this.liveOverrides,
      { camera: cameraID },
    ) as LiveConfig;

    const cameraMetadata = this.cameraManager.getCameraMetadata(cameraID);

    return html`
      <div class="embla__slide">
        <frigate-card-live-provider
          ?load=${!config.lazy_load}
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
        >
        </frigate-card-live-provider>
      </div>
    `;
  }

  protected _getCameraIDsOfNeighbors(): [string | null, string | null] {
    const cameras = this.cameraManager?.getStore().getVisibleCameras();
    if (this.viewFilterCameraID || !cameras || !this.view || !this.hass) {
      return [null, null];
    }

    const cameraID = this.viewFilterCameraID ?? this.view.camera;
    const keys = Array.from(cameras.keys());
    const currentIndex = keys.indexOf(cameraID);

    if (currentIndex < 0 || cameras.size <= 1) {
      return [null, null];
    }

    return [
      keys[currentIndex > 0 ? currentIndex - 1 : cameras.size - 1],
      keys[currentIndex + 1 < cameras.size ? currentIndex + 1 : 0],
    ];
  }

  protected render(): TemplateResult | void {
    if (!this.overriddenLiveConfig || !this.view || !this.hass || !this.cameraManager) {
      return;
    }

    const [slides, cameraToSlide] = this._getSlides();
    this._cameraToSlide = cameraToSlide;
    if (!slides.length) {
      return;
    }

    const hasMultipleCameras = slides.length > 1;
    const [prevID, nextID] = this._getCameraIDsOfNeighbors();

    const overrideCameraID = (cameraID: string): string => {
      return this.view?.context?.live?.overrides?.get(cameraID) ?? cameraID;
    };

    const cameraMetadataPrevious = prevID
      ? this.cameraManager.getCameraMetadata(overrideCameraID(prevID))
      : null;
    const cameraMetadataCurrent = this.cameraManager.getCameraMetadata(
      overrideCameraID(this.viewFilterCameraID ?? this.view.camera),
    );
    const cameraMetadataNext = nextID
      ? this.cameraManager.getCameraMetadata(overrideCameraID(nextID))
      : null;

    const titleConfig = getDefaultTitleConfigForView(
      this.view,
      this.overriddenLiveConfig?.controls.title,
    );

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
      <frigate-card-carousel
        .loop=${hasMultipleCameras}
        .dragEnabled=${hasMultipleCameras && this.overriddenLiveConfig?.draggable}
        .plugins=${guard(
          [this.cameraManager, this.overriddenLiveConfig],
          this._getPlugins.bind(this),
        )}
        .selected=${this._getSelectedCameraIndex()}
        transitionEffect=${this._getTransitionEffect()}
        @frigate-card:carousel:select=${this._setViewHandler.bind(this)}
        @frigate-card:carousel:settle=${() => {
          // Fetch the thumbnails after the carousel has settled.
          dispatchViewContextChangeEvent(this, { thumbnails: { fetch: true } });
        }}
        @frigate-card:media:loaded=${() => {
          if (this._refTitleControl.value) {
            showTitleControlAfterDelay(this._refTitleControl.value, this._titleTimer);
          }
        }}
      >
        <frigate-card-next-previous-control
          slot="previous"
          .hass=${this.hass}
          .direction=${'previous'}
          .controlConfig=${this.overriddenLiveConfig.controls.next_previous}
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
          .controlConfig=${this.overriddenLiveConfig.controls.next_previous}
          .label=${cameraMetadataNext?.title ?? ''}
          .icon=${cameraMetadataNext?.icon}
          ?disabled=${nextID === null}
          @click=${(ev) => {
            this._setViewCameraID(nextID);
            stopEventFromActivatingCardWideActions(ev);
          }}
        >
        </frigate-card-next-previous-control>
      </frigate-card-carousel>
      ${cameraMetadataCurrent && titleConfig
        ? html`<frigate-card-title-control
            ${ref(this._refTitleControl)}
            .config=${titleConfig}
            .text="${cameraMetadataCurrent
              ? `${localize('common.live')}: ${cameraMetadataCurrent.title}`
              : ''}"
            .logo="${cameraMetadataCurrent?.engineLogo}"
            .fitInto=${this as HTMLElement}
          >
          </frigate-card-title-control> `
        : ``}
    `;
  }

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

  // Whether or not to load the video for this camera. If `false`, no contents
  // are rendered until this attribute is set to `true` (this is useful for lazy
  // loading).
  @property({ attribute: true, type: Boolean })
  public load = false;

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
    return (await this._refProvider.value?.getScreenshotURL()) ?? null;
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
    if (changedProps.has('load')) {
      if (!this.load) {
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
    if (!this.load || !this.hass || !this.liveConfig || !this.cameraConfig) {
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

    if (provider === 'ha' || provider === 'image') {
      const stateObj = getStateObjOrDispatchError(this, this.hass, this.cameraConfig);
      if (!stateObj) {
        return;
      }
      if (stateObj.state === 'unavailable') {
        // An unavailable camera gets a message rendered in place vs dispatched,
        // as this may be a common occurrence (e.g. Frigate cameras that stop
        // receiving frames). Otherwise a single temporarily unavailable camera
        // would render a whole carousel inoperable.
        return renderMessage({
          message: localize('error.live_camera_unavailable'),
          type: 'error',
          context: this.cameraConfig,
        });
      }
    }

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
    'frigate-card-live-grid': FrigateCardLiveGrid;
    'frigate-card-live': FrigateCardLive;
  }
}
