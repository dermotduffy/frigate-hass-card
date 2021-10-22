import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators';
import { until } from 'lit/directives/until.js';
import { HomeAssistant } from 'custom-card-helpers';

import { signedPathSchema } from '../types';
import type { ExtendedHomeAssistant, FrigateCardConfig } from '../types';

import { localize } from '../localize/localize';
import {
  dispatchErrorMessageEvent,
  dispatchMediaLoadEvent,
  dispatchMessageEvent,
  dispatchPauseEvent,
  dispatchPlayEvent,
  homeAssistantWSRequest,
} from '../common';
import { renderProgressIndicator } from '../components/message';

import JSMpeg from '@cycjimmy/jsmpeg-player';

import liveStyle from '../scss/live.scss';

@customElement('frigate-card-live')
export class FrigateCardLive extends LitElement {
  @property({ attribute: false })
  protected hass!: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected config!: FrigateCardConfig;

  @property({ attribute: false })
  protected frigateCameraName!: string;

  protected render(): TemplateResult | void {
    return html` ${this.config.live_provider == 'frigate'
      ? html` <frigate-card-live-frigate
          .hass=${this.hass}
          .cameraEntity=${this.config.camera_entity}
        >
        </frigate-card-live-frigate>`
      : this.config.live_provider == 'webrtc'
      ? html`<frigate-card-live-webrtc
          .hass=${this.hass}
          .webRTCConfig=${this.config.webrtc || {}}
        >
        </frigate-card-live-webrtc>`
      : html` <frigate-card-live-jsmpeg
          .hass=${this.hass}
          .cameraName=${this.frigateCameraName}
          .clientId=${this.config.frigate_client_id}
        >
        </frigate-card-live-jsmpeg>`}`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveStyle);
  }
}

@customElement('frigate-card-live-frigate')
export class FrigateCardLiveFrigate extends LitElement {
  @property({ attribute: false })
  protected hass!: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected cameraEntity?: string;

  protected render(): TemplateResult | void {
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

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveStyle);
  }
}

// Create a wrapper for the WebRTC element
//  - https://github.com/AlexxIT/WebRTC
@customElement('frigate-card-live-webrtc')
export class FrigateCardLiveWebRTC extends LitElement {
  @property({ attribute: false })
  protected webRTCConfig!: Record<string, unknown>;

  protected hass!: HomeAssistant & ExtendedHomeAssistant;
  protected _webRTCElement: HTMLElement | null = null;

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

  protected render(): TemplateResult | void {
    if (!this._webRTCElement) {
      try {
        this._createWebRTC();
      } catch (e) {
        return dispatchErrorMessageEvent(this, (e as Error).message);
      }
    }
    return html`${this._webRTCElement}`;
  }

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
          dispatchMediaLoadEvent(this, video);
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

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveStyle);
  }
}

@customElement('frigate-card-live-jsmpeg')
export class FrigateCardLiveJSMPEG extends LitElement {
  @property({ attribute: false })
  protected cameraName!: string;

  @property({ attribute: false })
  protected clientId!: string;

  protected hass!: HomeAssistant & ExtendedHomeAssistant;
  protected _jsmpegCanvasElement?: HTMLCanvasElement;
  protected _jsmpegVideoPlayer?;
  protected _jsmpegURL?: string | null;

  protected async _getURL(): Promise<string | null> {
    if (!this.hass) {
      return null;
    }

    const request = {
      type: 'auth/sign_path',
      path: `/api/frigate/${this.clientId}` + `/jsmpeg/${this.cameraName}`,
      expires: 60 * 15,
    };
    // Sign the path so it includes an authSig parameter.
    let response;
    try {
      response = await homeAssistantWSRequest(this.hass, signedPathSchema, request);
    } catch (err) {
      console.warn(err);
      return null;
    }
    const url = this.hass.hassUrl(response.path);
    return url.replace(/^http/i, 'ws');
  }

  protected async _createJSMPEGPlayer(): Promise<void> {
    let videoDecoded = false;
    return new Promise<void>((resolve) => {
      this._jsmpegVideoPlayer = new JSMpeg.VideoElement(
        this,
        this._jsmpegURL,
        {
          preserveDrawingBuffer: true,
          canvas: this._jsmpegCanvasElement,
          hooks: {
            // Don't resolve the promise until it's playing to minimize the
            // amount of time the canvas is empty (and show the spinner
            // instead).
            play: () => {
              dispatchPlayEvent(this);
              resolve();
            },
            pause: () => {
              dispatchPauseEvent(this);
            },
          },
        },
        {
          protocols: [],
          audio: false,
          videoBufferSize: 1024 * 1024 * 4,
          onVideoDecode: () => {
            // This is the only callback that is called after the dimensions
            // are available. It's called on every frame decode, so just
            // ignore any subsequent calls.
            if (!videoDecoded && this._jsmpegCanvasElement) {
              videoDecoded = true;
              dispatchMediaLoadEvent(this, this._jsmpegCanvasElement);
            }
          },
        },
      );
    });
  }

  protected render(): TemplateResult | void {
    if (!this._jsmpegCanvasElement) {
      this._jsmpegCanvasElement = document.createElement('canvas');
      this._jsmpegCanvasElement.className = 'media';
    }

    if (this._jsmpegURL === undefined) {
      return html`${until(
        (async () => {
          this._jsmpegURL = await this._getURL();
          this.requestUpdate();
        })(),
        renderProgressIndicator(),
      )}`;
    }
    if (!this._jsmpegURL) {
      return dispatchErrorMessageEvent(
        this,
        'Could not retrieve or sign JSMPEG websocket path',
      );
    }

    if (!this._jsmpegVideoPlayer) {
      return html`${until(
        (async () => {
          await this._createJSMPEGPlayer();
          this.requestUpdate();
        })(),
        renderProgressIndicator(),
      )}`;
    }

    return html`${this._jsmpegCanvasElement}`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveStyle);
  }
}
