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
import { CameraEndpoints } from '../../camera-manager/types.js';
import {
  ConditionsManagerEpoch,
  getOverriddenConfig,
} from '../../card-controller/conditions-manager.js';
import { ReadonlyMicrophoneManager } from '../../card-controller/microphone-manager.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { LiveController } from '../../components-lib/live/live-controller.js';
import { MediaActionsController } from '../../components-lib/media-actions-controller.js';
import { MediaGridSelected } from '../../components-lib/media-grid-controller.js';
import {
  PartialZoomSettings,
  ZoomSettingsObserved,
} from '../../components-lib/zoom/types.js';
import { handleZoomSettingsObservedEvent } from '../../components-lib/zoom/zoom-view-context.js';
import {
  CameraConfig,
  CardWideConfig,
  frigateCardConfigDefaults,
  LiveConfig,
  liveConfigAbsoluteRootSchema,
  LiveProvider,
  Overrides,
  TransitionEffect,
} from '../../config/types.js';
import { localize } from '../../localize/localize.js';
import basicBlockStyle from '../../scss/basic-block.scss';
import liveCarouselStyle from '../../scss/live-carousel.scss';
import liveGridStyle from '../../scss/live-grid.scss';
import liveProviderStyle from '../../scss/live-provider.scss';
import { ExtendedHomeAssistant, FrigateCardMediaPlayer } from '../../types.js';
import { stopEventFromActivatingCardWideActions } from '../../utils/action.js';
import { aspectRatioToString, contentsChanged } from '../../utils/basic.js';
import { CarouselSelected } from '../../utils/embla/carousel-controller.js';
import { AutoLazyLoad } from '../../utils/embla/plugins/auto-lazy-load/auto-lazy-load.js';
import AutoMediaLoadedInfo from '../../utils/embla/plugins/auto-media-loaded-info/auto-media-loaded-info.js';
import AutoSize from '../../utils/embla/plugins/auto-size/auto-size.js';
import { getStateObjOrDispatchError } from '../../utils/get-state-obj.js';
import { dispatchMediaUnloadedEvent } from '../../utils/media-info.js';
import { updateElementStyleFromMediaLayoutConfig } from '../../utils/media-layout.js';
import { playMediaMutingIfNecessary } from '../../utils/media.js';
import { getStreamCameraID } from '../../utils/substream.js';
import { View } from '../../view/view.js';
import { EmblaCarouselPlugins } from '../carousel.js';
import { dispatchFrigateCardErrorEvent, renderMessage } from '../message.js';
import '../next-prev-control.js';
import '../ptz.js';
import { FrigateCardPTZ } from '../ptz.js';
import '../surround.js';

const FRIGATE_CARD_LIVE_PROVIDER = 'frigate-card-live-provider';

@customElement('frigate-card-live')
export class FrigateCardLive extends LitElement {
  @property({ attribute: false })
  public conditionsManagerEpoch?: ConditionsManagerEpoch;

  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public nonOverriddenLiveConfig?: LiveConfig;

  @property({ attribute: false })
  public overriddenLiveConfig?: LiveConfig;

  @property({ attribute: false, hasChanged: contentsChanged })
  public overrides?: Overrides;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public microphoneManager?: ReadonlyMicrophoneManager;

  @property({ attribute: false })
  public triggeredCameraIDs?: Set<string>;

  protected _controller = new LiveController(this);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldUpdate(_changedProps: PropertyValues): boolean {
    return this._controller.shouldUpdate();
  }

  protected willUpdate(): void {
    this._controller.clearMessageReceived();
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this.nonOverriddenLiveConfig || !this.cameraManager) {
      return;
    }

    // Implementation notes:
    // - See use of liveConfig and not config below -- the underlying carousel
    //   will independently override the liveConfig to reflect the camera in the
    //   carousel (not necessarily the selected camera).
    // - Various events are captured to prevent them propagating upwards if the
    //   card is in the background.
    // - The entire returned template is keyed to allow for the whole template
    //   to be re-rendered in certain circumstances (specifically: if a message
    //   is received when the card is in the background).
    return html`${keyed(
      this._controller.getRenderEpoch(),
      html`
        <frigate-card-live-grid
          .hass=${this.hass}
          .viewManagerEpoch=${this.viewManagerEpoch}
          .nonOverriddenLiveConfig=${this.nonOverriddenLiveConfig}
          .overriddenLiveConfig=${this.overriddenLiveConfig}
          .inBackground=${this._controller.isInBackground()}
          .conditionsManagerEpoch=${this.conditionsManagerEpoch}
          .overrides=${this.overrides}
          .cardWideConfig=${this.cardWideConfig}
          .cameraManager=${this.cameraManager}
          .microphoneManager=${this.microphoneManager}
          .triggeredCameraIDs=${this.triggeredCameraIDs}
        >
        </frigate-card-live-grid>
      `,
    )}`;
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
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public nonOverriddenLiveConfig?: LiveConfig;

  @property({ attribute: false })
  public overriddenLiveConfig?: LiveConfig;

  @property({ attribute: false, hasChanged: contentsChanged })
  public overrides?: Overrides;

  @property({ attribute: false })
  public conditionsManagerEpoch?: ConditionsManagerEpoch;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public microphoneManager?: ReadonlyMicrophoneManager;

  @property({ attribute: false })
  public triggeredCameraIDs?: Set<string>;

  protected _renderCarousel(cameraID?: string): TemplateResult {
    const view = this.viewManagerEpoch?.manager.getView();
    const triggeredCameraID = cameraID ?? view?.camera;

    return html`
      <frigate-card-live-carousel
        grid-id=${ifDefined(cameraID)}
        .hass=${this.hass}
        .viewManagerEpoch=${this.viewManagerEpoch}
        .viewFilterCameraID=${cameraID}
        .nonOverriddenLiveConfig=${this.nonOverriddenLiveConfig}
        .overriddenLiveConfig=${this.overriddenLiveConfig}
        .conditionsManagerEpoch=${this.conditionsManagerEpoch}
        .overrides=${this.overrides}
        .cardWideConfig=${this.cardWideConfig}
        .cameraManager=${this.cameraManager}
        .microphoneManager=${this.microphoneManager}
        ?triggered=${triggeredCameraID &&
        !!this.triggeredCameraIDs?.has(triggeredCameraID)}
      >
      </frigate-card-live-carousel>
    `;
  }

  protected _gridSelectCamera(cameraID: string): void {
    this.viewManagerEpoch?.manager.setViewByParameters({
      params: {
        camera: cameraID,
      },
    });
  }

  protected _needsGrid(): boolean {
    const cameraIDs = this.cameraManager?.getStore().getCameraIDsWithCapability('live');
    const view = this.viewManagerEpoch?.manager.getView();
    return (
      !!view?.isGrid() &&
      !!view?.supportsMultipleDisplayModes() &&
      !!cameraIDs &&
      cameraIDs.size > 1
    );
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('viewManagerEpoch') && this._needsGrid()) {
      import('../media-grid.js');
    }
  }

  protected render(): TemplateResult | void {
    if (!this.conditionsManagerEpoch || !this.nonOverriddenLiveConfig) {
      return;
    }
    const cameraIDs = this.cameraManager?.getStore().getCameraIDsWithCapability('live');
    if (!cameraIDs?.size || !this._needsGrid()) {
      return this._renderCarousel();
    }

    return html`
      <frigate-card-media-grid
        .selected=${this.viewManagerEpoch?.manager.getView()?.camera}
        .displayConfig=${this.overriddenLiveConfig?.display}
        @frigate-card:media-grid:selected=${(ev: CustomEvent<MediaGridSelected>) =>
          this._gridSelectCamera(ev.detail.selected)}
      >
        ${[...cameraIDs].map((cameraID) => this._renderCarousel(cameraID))}
      </frigate-card-media-grid>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveGridStyle);
  }
}

@customElement('frigate-card-live-carousel')
export class FrigateCardLiveCarousel extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public nonOverriddenLiveConfig?: LiveConfig;

  @property({ attribute: false })
  public overriddenLiveConfig?: LiveConfig;

  @property({ attribute: false, hasChanged: contentsChanged })
  public overrides?: Overrides;

  @property({ attribute: false })
  public conditionsManagerEpoch?: ConditionsManagerEpoch;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public microphoneManager?: ReadonlyMicrophoneManager;

  @property({ attribute: false })
  public viewFilterCameraID?: string;

  // Index between camera name and slide number.
  protected _cameraToSlide: Record<string, number> = {};
  protected _refPTZControl: Ref<FrigateCardPTZ> = createRef();
  protected _refCarousel: Ref<HTMLElement> = createRef();

  protected _mediaActionsController = new MediaActionsController();

  @state()
  protected _mediaHasLoaded = false;

  public connectedCallback(): void {
    super.connectedCallback();

    // Request update in order to reinitialize the media action controller.
    this.requestUpdate();
  }

  public disconnectedCallback(): void {
    this._mediaActionsController.destroy();
    super.disconnectedCallback();
  }

  protected _getTransitionEffect(): TransitionEffect {
    return (
      this.overriddenLiveConfig?.transition_effect ??
      frigateCardConfigDefaults.live.transition_effect
    );
  }

  protected _getSelectedCameraIndex(): number {
    if (this.viewFilterCameraID) {
      // If the carousel is limited to a single cameraID, the first (only)
      // element is always the selected one.
      return 0;
    }

    const cameraIDs = this.cameraManager?.getStore().getCameraIDsWithCapability('live');
    const view = this.viewManagerEpoch?.manager.getView();
    if (!cameraIDs?.size || !view) {
      return 0;
    }
    return Math.max(0, Array.from(cameraIDs).indexOf(view.camera));
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (
      changedProps.has('microphoneManager') ||
      changedProps.has('overriddenLiveConfig')
    ) {
      this._mediaActionsController.setOptions({
        playerSelector: FRIGATE_CARD_LIVE_PROVIDER,
        ...(this.overriddenLiveConfig?.auto_play && {
          autoPlayConditions: this.overriddenLiveConfig.auto_play,
        }),
        ...(this.overriddenLiveConfig?.auto_pause && {
          autoPauseConditions: this.overriddenLiveConfig.auto_pause,
        }),
        ...(this.overriddenLiveConfig?.auto_mute && {
          autoMuteConditions: this.overriddenLiveConfig.auto_mute,
        }),
        ...(this.overriddenLiveConfig?.auto_unmute && {
          autoUnmuteConditions: this.overriddenLiveConfig.auto_unmute,
        }),
        ...((this.overriddenLiveConfig?.auto_unmute ||
          this.overriddenLiveConfig?.auto_mute) && {
          microphoneManager: this.microphoneManager,
          microphoneMuteSeconds:
            this.overriddenLiveConfig.microphone.mute_after_microphone_mute_seconds,
        }),
      });
    }
  }

  protected _getPlugins(): EmblaCarouselPlugins {
    return [
      AutoLazyLoad({
        ...(this.overriddenLiveConfig?.lazy_load && {
          lazyLoadCallback: (index, slide) =>
            this._lazyloadOrUnloadSlide('load', index, slide),
        }),
        lazyUnloadConditions: this.overriddenLiveConfig?.lazy_unload,
        lazyUnloadCallback: (index, slide) =>
          this._lazyloadOrUnloadSlide('unload', index, slide),
      }),
      AutoMediaLoadedInfo(),
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
    if (!this.cameraManager) {
      return [[], {}];
    }

    const view = this.viewManagerEpoch?.manager.getView();
    const cameraIDs = this.viewFilterCameraID
      ? new Set([this.viewFilterCameraID])
      : this.cameraManager?.getStore().getCameraIDsWithCapability('live');

    const slides: TemplateResult[] = [];
    const cameraToSlide: Record<string, number> = {};

    for (const [cameraID, cameraConfig] of this.cameraManager
      .getStore()
      .getCameraConfigEntries(cameraIDs)) {
      const liveCameraID = this._getSubstreamCameraID(cameraID, view);
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
    const cameraIDs = this.cameraManager?.getStore().getCameraIDsWithCapability('live');
    if (cameraIDs?.size && ev.detail.index !== this._getSelectedCameraIndex()) {
      this._setViewCameraID([...cameraIDs][ev.detail.index]);
    }
  }

  protected _setViewCameraID(cameraID?: string | null): void {
    if (cameraID) {
      this.viewManagerEpoch?.manager.setViewByParametersWithNewQuery({
        params: {
          camera: cameraID,
        },
      });
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

    let liveConfig: LiveConfig | null = null;

    try {
      // The condition controller object contains the currently live camera, which
      // (in the carousel for example) is not necessarily the live camera *this*
      // <frigate-card-live-provider> is rendering right now, so we provide a
      // stateOverride to evaluate the condition in that context.
      liveConfig = getOverriddenConfig(
        this.conditionsManagerEpoch.manager,
        { live: this.nonOverriddenLiveConfig },
        {
          configOverrides: this.overrides,
          stateOverrides: { camera: cameraID },
          schema: liveConfigAbsoluteRootSchema,
        },
      ).live;
    } catch (ev) {
      return dispatchFrigateCardErrorEvent(this, ev);
    }

    const cameraMetadata = this.cameraManager.getCameraMetadata(cameraID);
    const view = this.viewManagerEpoch?.manager.getView();

    return html`
      <div class="embla__slide">
        <frigate-card-live-provider
          ?load=${!liveConfig.lazy_load}
          .microphoneStream=${view?.camera === cameraID
            ? this.microphoneManager?.getStream()
            : undefined}
          .cameraConfig=${cameraConfig}
          .cameraEndpoints=${guard(
            [this.cameraManager, cameraID],
            () => this.cameraManager?.getCameraEndpoints(cameraID) ?? undefined,
          )}
          .label=${cameraMetadata?.title ?? ''}
          .liveConfig=${liveConfig}
          .hass=${this.hass}
          .cardWideConfig=${this.cardWideConfig}
          .zoomSettings=${view?.context?.zoom?.[cameraID]?.requested}
          @frigate-card:zoom:change=${(ev: CustomEvent<ZoomSettingsObserved>) =>
            handleZoomSettingsObservedEvent(
              ev,
              this.viewManagerEpoch?.manager,
              cameraID,
            )}
        >
        </frigate-card-live-provider>
      </div>
    `;
  }

  protected _getCameraIDsOfNeighbors(): [string | null, string | null] {
    const cameraIDs = this.cameraManager
      ? [...this.cameraManager?.getStore().getCameraIDsWithCapability('live')]
      : [];
    const view = this.viewManagerEpoch?.manager.getView();

    if (this.viewFilterCameraID || cameraIDs.length <= 1 || !view || !this.hass) {
      return [null, null];
    }

    const cameraID = this.viewFilterCameraID ?? view.camera;
    const currentIndex = cameraIDs.indexOf(cameraID);

    if (currentIndex < 0) {
      return [null, null];
    }

    return [
      cameraIDs[currentIndex > 0 ? currentIndex - 1 : cameraIDs.length - 1],
      cameraIDs[currentIndex + 1 < cameraIDs.length ? currentIndex + 1 : 0],
    ];
  }

  protected _getSubstreamCameraID(cameraID: string, view?: View | null): string {
    return view?.context?.live?.overrides?.get(cameraID) ?? cameraID;
  }

  protected render(): TemplateResult | void {
    const view = this.viewManagerEpoch?.manager.getView();
    if (!this.overriddenLiveConfig || !this.hass || !view || !this.cameraManager) {
      return;
    }

    const [slides, cameraToSlide] = this._getSlides();
    this._cameraToSlide = cameraToSlide;
    if (!slides.length) {
      return;
    }

    const hasMultipleCameras = slides.length > 1;
    const [prevID, nextID] = this._getCameraIDsOfNeighbors();

    const cameraMetadataPrevious = prevID
      ? this.cameraManager.getCameraMetadata(this._getSubstreamCameraID(prevID, view))
      : null;
    const cameraMetadataNext = nextID
      ? this.cameraManager.getCameraMetadata(this._getSubstreamCameraID(nextID, view))
      : null;
    const forcePTZVisibility =
      !this._mediaHasLoaded ||
      (!!this.viewFilterCameraID && this.viewFilterCameraID !== view.camera) ||
      view.context?.ptzControls?.enabled === false
        ? false
        : view.context?.ptzControls?.enabled;

    // Notes on the below:
    // - guard() is used to avoid reseting the carousel unless the
    //   options/plugins actually change.

    return html`
      <frigate-card-carousel
        ${ref(this._refCarousel)}
        .loop=${hasMultipleCameras}
        .dragEnabled=${hasMultipleCameras && this.overriddenLiveConfig?.draggable}
        .plugins=${guard(
          [this.cameraManager, this.overriddenLiveConfig, this.microphoneManager],
          this._getPlugins.bind(this),
        )}
        .selected=${this._getSelectedCameraIndex()}
        transitionEffect=${this._getTransitionEffect()}
        @frigate-card:carousel:select=${this._setViewHandler.bind(this)}
        @frigate-card:media:loaded=${() => {
          this._mediaHasLoaded = true;
        }}
        @frigate-card:media:unloaded=${() => {
          this._mediaHasLoaded = false;
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
      <frigate-card-ptz
        .config=${this.overriddenLiveConfig.controls.ptz}
        .cameraManager=${this.cameraManager}
        .cameraID=${getStreamCameraID(view, this.viewFilterCameraID)}
        .forceVisibility=${forcePTZVisibility}
      >
      </frigate-card-ptz>
    `;
  }

  protected _setMediaTarget(): void {
    const view = this.viewManagerEpoch?.manager.getView();
    const selectedCameraIndex = this._getSelectedCameraIndex();

    if (this.viewFilterCameraID) {
      this._mediaActionsController.setTarget(
        selectedCameraIndex,
        // Camera in this carousel is only selected if the camera from the
        // view matches the filtered camera.
        view?.camera === this.viewFilterCameraID,
      );
    } else {
      // Carousel is not filtered, so the targeted camera is always selected.
      this._mediaActionsController.setTarget(selectedCameraIndex, true);
    }
  }

  public updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    let initialized = false;
    if (!this._mediaActionsController.hasRoot() && this._refCarousel.value) {
      this._mediaActionsController.initialize(this._refCarousel.value);
      initialized = true;
    }

    // If the view has changed, or if the media actions controller has just been
    // initialized, then call the necessary media action.
    // See: https://github.com/dermotduffy/frigate-hass-card/issues/1626
    if (initialized || changedProperties.has('viewManagerEpoch')) {
      this._setMediaTarget();
    }
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

  @property({ attribute: false })
  public zoomSettings?: PartialZoomSettings | null;

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
        return 'ha';
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

  public disconnectedCallback(): void {
    this._isVideoMediaLoaded = false;
  }

  protected _videoMediaShowHandler(): void {
    this._isVideoMediaLoaded = true;
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('load')) {
      if (!this.load) {
        this._isVideoMediaLoaded = false;
        dispatchMediaUnloadedEvent(this);
      }
    }
    if (changedProps.has('liveConfig')) {
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

      updateElementStyleFromMediaLayoutConfig(
        this,
        this.cameraConfig?.dimensions?.layout,
      );
      this.style.aspectRatio = aspectRatioToString({
        ratio: this.cameraConfig?.dimensions?.aspect_ratio,
      });
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
          .defaultSettings=${guard([this.cameraConfig?.dimensions?.layout], () =>
            this.cameraConfig?.dimensions?.layout
              ? {
                  pan: this.cameraConfig.dimensions.layout.pan,
                  zoom: this.cameraConfig.dimensions.layout.zoom,
                }
              : undefined,
          )}
          .settings=${this.zoomSettings}
          @frigate-card:zoom:zoomed=${() => this.setControls(false)}
          @frigate-card:zoom:unzoomed=${() => this.setControls()}
        >
          ${template}
        </frigate-card-zoomer>`
      : template;
  }

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
        dispatchMediaUnloadedEvent(this);

        // An unavailable camera gets a message rendered in place vs dispatched,
        // as this may be a common occurrence (e.g. Frigate cameras that stop
        // receiving frames). Otherwise a single temporarily unavailable camera
        // would render a whole carousel inoperable.
        return renderMessage({
          message: `${localize('error.live_camera_unavailable')}${
            this.label ? `: ${this.label}` : ''
          }`,
          type: 'info',
          icon: 'mdi:cctv-off',
          dotdotdot: true,
        });
      }
    }

    return html`${this._useZoomIfRequired(html`
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
            </frigate-card-live-go2rtc>`
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
    `)}
    ${showImageDuringLoading && !this._isVideoMediaLoaded
      ? html`<ha-icon
          title=${localize('error.awaiting_live')}
          icon="mdi:progress-helper"
        ></ha-icon>`
      : ''} `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveProviderStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-live-provider': FrigateCardLiveProvider;
    'frigate-card-live-carousel': FrigateCardLiveCarousel;
    'frigate-card-live-grid': FrigateCardLiveGrid;
    'frigate-card-live': FrigateCardLive;
  }
}
