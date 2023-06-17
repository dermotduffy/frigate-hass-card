import JSMpeg from '@cycjimmy/jsmpeg-player';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';
import { CameraEndpoints } from '../../camera-manager/types.js';
import { renderProgressIndicator } from '../../components/message.js';
import { localize } from '../../localize/localize.js';
import liveJSMPEGStyle from '../../scss/live-jsmpeg.scss';
import {
  CameraConfig,
  CardWideConfig,
  ExtendedHomeAssistant,
  FrigateCardMediaPlayer,
} from '../../types.js';
import { getEndpointAddressOrDispatchError } from '../../utils/endpoint.js';
import {
  dispatchMediaLoadedEvent,
  dispatchMediaPauseEvent,
  dispatchMediaPlayEvent,
} from '../../utils/media-info.js';
import { dispatchErrorMessageEvent } from '../message.js';
import { Timer } from '../../utils/timer.js';

// Number of seconds a signed URL is valid for.
const JSMPEG_URL_SIGN_EXPIRY_SECONDS = 24 * 60 * 60;

// Number of seconds before the expiry to trigger a refresh.
const JSMPEG_URL_SIGN_REFRESH_THRESHOLD_SECONDS = 1 * 60 * 60;

@customElement('frigate-card-live-jsmpeg')
export class FrigateCardLiveJSMPEG extends LitElement implements FrigateCardMediaPlayer {
  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: false })
  public cameraEndpoints?: CameraEndpoints;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected hass?: ExtendedHomeAssistant;

  protected _jsmpegCanvasElement?: HTMLCanvasElement;
  protected _jsmpegVideoPlayer?: JSMpeg.VideoElement;
  protected _refreshPlayerTimer = new Timer();

  public async play(): Promise<void> {
    return this._jsmpegVideoPlayer?.play();
  }

  public async pause(): Promise<void> {
    this._jsmpegVideoPlayer?.stop();
  }

  public async mute(): Promise<void> {
    const player = this._jsmpegVideoPlayer?.player;
    if (player) {
      player.volume = 0;
    }
  }

  public async unmute(): Promise<void> {
    const player = this._jsmpegVideoPlayer?.player;
    if (player) {
      player.volume = 1;
    }
  }

  public isMuted(): boolean {
    return this._jsmpegVideoPlayer ? this._jsmpegVideoPlayer.player.volume === 0 : true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async seek(_seconds: number): Promise<void> {
    // JSMPEG does not support seeking.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async setControls(_controls: boolean): Promise<void> {
    // Not implemented.
  }

  public isPaused(): boolean {
    return this._jsmpegVideoPlayer?.player?.paused ?? true;
  }

  public async getScreenshotURL(): Promise<string | null> {
    return this._jsmpegCanvasElement?.toDataURL('image/jpeg') ?? null;
  }

  /**
   * Create a JSMPEG player.
   * @param url The URL for the player to connect to.
   * @returns A JSMPEG player.
   */
  protected async _createJSMPEGPlayer(url: string): Promise<JSMpeg.VideoElement> {
    this._jsmpegVideoPlayer = await new Promise<JSMpeg.VideoElement>((resolve) => {
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

          // Necessary for screenshots.
          preserveDrawingBuffer: true,

          // Override with user-specified options.
          ...this.cameraConfig?.jsmpeg?.options,

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
              resolve(player);
            }
          },
          onPlay: () => dispatchMediaPlayEvent(this),
          onPause: () => dispatchMediaPauseEvent(this),
        },
      );
    });

    // The media loaded event must be dispatched after the player is assigned to
    // `this._jsmpegVideoPlayer`, since the load call may (will!) result in
    // calls back to the player to check for pause status for menu buttons.
    if (this._jsmpegCanvasElement) {
      dispatchMediaLoadedEvent(this, this._jsmpegCanvasElement, {
        player: this,
        capabilities: {
          supportsPause: true,
        },
      });
    }
  }

  /**
   * Reset / destroy the player.
   */
  protected _resetPlayer(): void {
    this._refreshPlayerTimer.stop();
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
    if (!this.hass) {
      return;
    }
    this._resetPlayer();

    this._jsmpegCanvasElement = document.createElement('canvas');
    this._jsmpegCanvasElement.className = 'media';

    const endpoint = this.cameraEndpoints?.jsmpeg;
    if (!endpoint) {
      return dispatchErrorMessageEvent(this, localize('error.live_camera_no_endpoint'), {
        context: this.cameraConfig,
      });
    }

    const address = await getEndpointAddressOrDispatchError(
      this,
      this.hass,
      endpoint,
      JSMPEG_URL_SIGN_EXPIRY_SECONDS,
    );
    if (!address) {
      return;
    }

    await this._createJSMPEGPlayer(address);
    this._refreshPlayerTimer.start(
      JSMPEG_URL_SIGN_EXPIRY_SECONDS - JSMPEG_URL_SIGN_REFRESH_THRESHOLD_SECONDS,
      () => this.requestUpdate(),
    );
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
    return html`${until(
      _render(),
      renderProgressIndicator({
        cardWideConfig: this.cardWideConfig,
      }),
    )}`;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(liveJSMPEGStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-live-jsmpeg': FrigateCardLiveJSMPEG;
  }
}
