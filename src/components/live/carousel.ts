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
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { CameraManager } from '../../camera-manager/manager.js';
import {
  ConditionsManagerEpoch,
  getOverriddenConfig,
} from '../../card-controller/conditions-manager.js';
import { ReadonlyMicrophoneManager } from '../../card-controller/microphone-manager.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { MediaActionsController } from '../../components-lib/media-actions-controller.js';
import { ZoomSettingsObserved } from '../../components-lib/zoom/types.js';
import { handleZoomSettingsObservedEvent } from '../../components-lib/zoom/zoom-view-context.js';
import {
  CameraConfig,
  CardWideConfig,
  frigateCardConfigDefaults,
  LiveConfig,
  liveConfigAbsoluteRootSchema,
  Overrides,
  TransitionEffect,
} from '../../config/types.js';
import liveCarouselStyle from '../../scss/live-carousel.scss';
import { ExtendedHomeAssistant } from '../../types.js';
import { stopEventFromActivatingCardWideActions } from '../../utils/action.js';
import { contentsChanged } from '../../utils/basic.js';
import { CarouselSelected } from '../../utils/embla/carousel-controller.js';
import { AutoLazyLoad } from '../../utils/embla/plugins/auto-lazy-load/auto-lazy-load.js';
import AutoMediaLoadedInfo from '../../utils/embla/plugins/auto-media-loaded-info/auto-media-loaded-info.js';
import AutoSize from '../../utils/embla/plugins/auto-size/auto-size.js';
import { getStreamCameraID } from '../../utils/substream.js';
import { View } from '../../view/view.js';
import { EmblaCarouselPlugins } from '../carousel.js';
import { dispatchFrigateCardErrorEvent } from '../message.js';
import '../next-prev-control.js';
import '../ptz.js';
import { FrigateCardPTZ } from '../ptz.js';
import './provider.js';
import { FrigateCardLiveProvider } from './provider.js';

const FRIGATE_CARD_LIVE_PROVIDER = 'frigate-card-live-provider';

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

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-live-carousel': FrigateCardLiveCarousel;
  }
}
