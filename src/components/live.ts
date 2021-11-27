import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import type {
  BrowseMediaQueryParameters,
  BrowseMediaSource,
  ExtendedHomeAssistant,
  FrigateCardConfig,
  JSMPEGConfig,
  MediaShowInfo,
  WebRTCConfig,
} from '../types.js';
import { HomeAssistant } from 'custom-card-helpers';
import { customElement, property } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';

import { BrowseMediaUtil } from '../browse-media-util.js';
import { ThumbnailCarouselTap } from './thumbnail-carousel.js';
import { View } from '../view.js';
import { localize } from '../localize/localize.js';
import {
  dispatchErrorMessageEvent,
  dispatchExistingMediaShowInfoAsEvent,
  dispatchMediaShowEvent,
  dispatchMessageEvent,
  dispatchPauseEvent,
  dispatchPlayEvent,
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
  protected config?: FrigateCardConfig;

  @property({ attribute: false })
  protected browseMediaQueryParameters?: BrowseMediaQueryParameters;

  @property({ attribute: false })
  set preload(preload: boolean) {
    this._preload = preload;

    if (!preload && this._savedMediaShowInfo) {
      dispatchExistingMediaShowInfoAsEvent(this, this._savedMediaShowInfo);
    }
  }

  // Whether or not the live view is currently being preloaded.
  protected _preload?: boolean;

  // MediaShowInfo object from the underlying live object. In the case of
  // pre-loading it may be propagated upwards later.
  protected _savedMediaShowInfo?: MediaShowInfo;

  /**
   * Handler for media show events that special cases preloaded live views.
   * @param e The media show event.
   */
  protected _mediaShowHandler(e: CustomEvent<MediaShowInfo>): void {
    this._savedMediaShowInfo = e.detail;
    if (this._preload) {
      // If live is being pre-loaded, don't let the event propogate upwards yet
      // as the media is not really being shown.
      e.stopPropagation();
    }
  }

  /**
   * Render thumbnails carousel.
   * @returns A rendered template or void.
   */
  protected renderThumbnails(): TemplateResult | void {
    if (!this.config) {
      return;
    }

    const fetchThumbnailsThenRender = async (): Promise<TemplateResult | void> => {
      if (!this.hass || !this.browseMediaQueryParameters) {
        return;
      }
      let parent: BrowseMediaSource | null;
      try {
        parent = await BrowseMediaUtil.browseMediaQuery(
          this.hass,
          this.browseMediaQueryParameters,
        );
      } catch (e) {
        return dispatchErrorMessageEvent(this, (e as Error).message);
      }

      if (BrowseMediaUtil.getFirstTrueMediaChildIndex(parent) != null) {
        return html` <frigate-card-thumbnail-carousel
          .target=${parent}
          .config=${this.config?.live.controls.thumbnails}
          .highlightSelected=${false}
          @frigate-card:carousel:tap=${(ev: CustomEvent<ThumbnailCarouselTap>) => {
            const mediaType = this.browseMediaQueryParameters?.mediaType;
            if (mediaType && ['snapshots', 'clips'].includes(mediaType)) {
              new View({
                view: mediaType === 'clips' ? 'clip-specific' : 'snapshot-specific',
                target: ev.detail.target,
                childIndex: ev.detail.childIndex,
              }).dispatchChangeEvent(this);
            }
          }}
        >
        </frigate-card-thumbnail-carousel>`;
      }
    };

    return html`${until(fetchThumbnailsThenRender(), renderProgressIndicator())}`;
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.config) {
      return;
    }

    return html`
      ${this.config.live.controls.thumbnails.mode === 'above'
        ? this.renderThumbnails()
        : ''}
      ${this.config.live.provider == 'frigate'
        ? html` <frigate-card-live-frigate
            .hass=${this.hass}
            .cameraEntity=${this.config.camera_entity}
            @frigate-card:media-show=${this._mediaShowHandler}
          >
          </frigate-card-live-frigate>`
        : this.config.live.provider == 'webrtc'
        ? html`<frigate-card-live-webrtc
            .hass=${this.hass}
            .webRTCConfig=${this.config.live.webrtc || {}}
            @frigate-card:media-show=${this._mediaShowHandler}
          >
          </frigate-card-live-webrtc>`
        : html` <frigate-card-live-jsmpeg
            .hass=${this.hass}
            .cameraName=${this.browseMediaQueryParameters?.cameraName}
            .clientId=${this.config.frigate.client_id}
            .jsmpegConfig=${this.config.live.jsmpeg}
            @frigate-card:media-show=${this._mediaShowHandler}
          >
          </frigate-card-live-jsmpeg>`}
      ${this.config.live.controls.thumbnails.mode === 'below'
        ? this.renderThumbnails()
        : ''}
    `;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(liveStyle);
  }
}

@customElement('frigate-card-live-frigate')
export class FrigateCardLiveFrigate extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected cameraEntity?: string;

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
  @property({ attribute: false })
  protected webRTCConfig?: WebRTCConfig;

  protected hass?: HomeAssistant & ExtendedHomeAssistant;
  protected _webRTCElement: HTMLElement | null = null;

  /**
   * Create the WebRTC element. May throw.
   */
  protected _createWebRTC(): TemplateResult | void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const webrtcElement = customElements.get('webrtc-camera') as any;
    if (webrtcElement) {
      const webrtc = new webrtcElement();
      webrtc.setConfig(this.webRTCConfig);
      webrtc.hass = this.hass;
      this._webRTCElement = webrtc;
    } else {
      throw new Error(localize('error.missing_webrtc'));
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
    if (!this._webRTCElement) {
      try {
        this._createWebRTC();
      } catch (e) {
        return dispatchErrorMessageEvent(this, (e as Error).message);
      }
    }
    return html`${this._webRTCElement}`;
  }

  /**
   * Updated lifecycle callback.
   */
  public updated(): void {
    // Extract the video component after it has been rendered and generate the
    // media load event.
    this.updateComplete.then(() => {
      const video = this.renderRoot.querySelector('#video') as HTMLVideoElement;
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
  protected cameraName?: string;

  @property({ attribute: false })
  protected clientId?: string;

  @property({ attribute: false })
  protected jsmpegConfig?: JSMPEGConfig;

  protected hass?: HomeAssistant & ExtendedHomeAssistant;
  protected _jsmpegCanvasElement?: HTMLCanvasElement;
  protected _jsmpegVideoPlayer?: JSMpeg.VideoElement;
  protected _jsmpegURL?: string | null;
  protected _refreshPlayerTimerID?: number;

  /**
   * Get a signed player URL.
   * @returns A URL or null.
   */
  protected async _getURL(): Promise<string | null> {
    if (!this.hass || !this.clientId || !this.cameraName) {
      return null;
    }

    let response: string | null | undefined;
    try {
      response = await homeAssistantSignPath(
        this.hass,
        `/api/frigate/${this.clientId}` + `/jsmpeg/${this.cameraName}`,
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
   * @returns A JSMPEG player.
   */
  protected _createJSMPEGPlayer(): JSMpeg.VideoElement {
    let videoDecoded = false;

    const jsmpegOptions = {
      pauseWhenHidden: false,
      protocols: [],
      audio: false,
      videoBufferSize: 1024 * 1024 * 4,
      onVideoDecode: () => {
        // This is the only callback that is called after the dimensions
        // are available. It's called on every frame decode, so just
        // ignore any subsequent calls.
        if (!videoDecoded && this._jsmpegCanvasElement) {
          videoDecoded = true;
          dispatchMediaShowEvent(this, this._jsmpegCanvasElement);
        }
      },
    };

    // Override with user-specified options.
    Object.assign(jsmpegOptions, this.jsmpegConfig?.options);

    return new JSMpeg.VideoElement(
      this,
      this._jsmpegURL,
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
      jsmpegOptions,
    );
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
    this._jsmpegURL = undefined;
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

    this._jsmpegURL = await this._getURL();
    if (this._jsmpegURL) {
      this._jsmpegVideoPlayer = this._createJSMPEGPlayer();

      this._refreshPlayerTimerID = window.setTimeout(() => {
        this._refreshPlayer();
      }, (URL_SIGN_EXPIRY_SECONDS - URL_SIGN_REFRESH_THRESHOLD_SECONDS) * 1000);
    }
    this.requestUpdate();
  }

  /**
   * Master render method.
   */
  protected render(): TemplateResult | void {
    if (
      this._jsmpegURL === undefined ||
      !this._jsmpegVideoPlayer ||
      !this._jsmpegCanvasElement
    ) {
      return html`${until(this._refreshPlayer(), renderProgressIndicator())}`;
    }
    if (!this._jsmpegURL) {
      return dispatchErrorMessageEvent(this, localize('error.jsmpeg_no_sign'));
    }
    if (!this._jsmpegVideoPlayer || !this._jsmpegCanvasElement) {
      return dispatchErrorMessageEvent(this, localize('error.jsmpeg_no_player'));
    }
    return html`${this._jsmpegCanvasElement}`;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(liveJSMPEGStyle);
  }
}
