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
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { CameraEndpoints } from '../../camera-manager/types.js';
import { PartialZoomSettings } from '../../components-lib/zoom/types.js';
import {
  CameraConfig,
  CardWideConfig,
  frigateCardConfigDefaults,
  LiveConfig,
  LiveProvider,
} from '../../config/types.js';
import { localize } from '../../localize/localize.js';
import liveProviderStyle from '../../scss/live-provider.scss';
import { ExtendedHomeAssistant, FrigateCardMediaPlayer } from '../../types.js';
import { aspectRatioToString } from '../../utils/basic.js';
import { dispatchMediaUnloadedEvent } from '../../utils/media-info.js';
import { updateElementStyleFromMediaLayoutConfig } from '../../utils/media-layout.js';
import { playMediaMutingIfNecessary } from '../../utils/media.js';
import { renderMessage } from '../message.js';
import '../next-prev-control.js';
import '../ptz.js';
import '../surround.js';
import { dispatchLiveErrorEvent } from '../../components-lib/live/utils/dispatch-live-error.js';

@customElement('frigate-card-live-provider')
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

  @state()
  protected _hasProviderError = false;

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
      !!this.liveConfig?.show_image_during_load &&
      // Do not continue to show image during loading if an error has occurred.
      !this._hasProviderError
    );
  }

  public disconnectedCallback(): void {
    this._isVideoMediaLoaded = false;
  }

  protected _videoMediaShowHandler(): void {
    this._isVideoMediaLoaded = true;
  }

  protected _providerErrorHandler(): void {
    this._hasProviderError = true;
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
        this._importPromises.push(import('./providers/image.js'));
      }
      if (this.liveConfig?.zoomable) {
        this._importPromises.push(import('../zoomer.js'));
      }
    }

    if (changedProps.has('cameraConfig')) {
      const provider = this._getResolvedProvider();
      if (provider === 'jsmpeg') {
        this._importPromises.push(import('./providers/jsmpeg.js'));
      } else if (provider === 'ha') {
        this._importPromises.push(import('./providers/ha.js'));
      } else if (provider === 'webrtc-card') {
        this._importPromises.push(import('./providers/webrtc-card.js'));
      } else if (provider === 'image') {
        this._importPromises.push(import('./providers/image.js'));
      } else if (provider === 'go2rtc') {
        this._importPromises.push(import('./providers/go2rtc/index.js'));
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

    if (
      provider === 'ha' ||
      provider === 'image' ||
      (this.cameraConfig?.camera_entity &&
        this.cameraConfig.always_error_if_entity_unavailable)
    ) {
      if (!this.cameraConfig?.camera_entity) {
        dispatchLiveErrorEvent(this);
        return renderMessage({
          message: localize('error.no_live_camera'),
          type: 'error',
          icon: 'mdi:camera',
          context: this.cameraConfig,
        });
      }

      const stateObj = this.hass.states[this.cameraConfig.camera_entity];
      if (!stateObj) {
        dispatchLiveErrorEvent(this);
        return renderMessage({
          message: localize('error.live_camera_not_found'),
          type: 'error',
          icon: 'mdi:camera',
          context: this.cameraConfig,
        });
      }

      if (stateObj.state === 'unavailable') {
        dispatchLiveErrorEvent(this);
        dispatchMediaUnloadedEvent(this);
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
            @frigate-card:live:error=${() => this._providerErrorHandler()}
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
            @frigate-card:live:error=${() => this._providerErrorHandler()}
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
              @frigate-card:live:error=${() => this._providerErrorHandler()}
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
                @frigate-card:live:error=${() => this._providerErrorHandler()}
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
                  @frigate-card:live:error=${() => this._providerErrorHandler()}
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
  }
}
