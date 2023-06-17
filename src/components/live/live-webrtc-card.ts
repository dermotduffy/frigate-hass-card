import { Task } from '@lit-labs/task';
import { HomeAssistant } from 'custom-card-helpers';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CameraEndpoints } from '../../camera-manager/types.js';
import { localize } from '../../localize/localize.js';
import liveWebRTCCardStyle from '../../scss/live-webrtc-card.scss';
import {
  CameraConfig,
  CardWideConfig,
  FrigateCardError,
  FrigateCardMediaPlayer,
} from '../../types.js';
import { mayHaveAudio } from '../../utils/audio.js';
import {
  dispatchMediaLoadedEvent,
  dispatchMediaPauseEvent,
  dispatchMediaPlayEvent,
  dispatchMediaVolumeChangeEvent,
} from '../../utils/media-info.js';
import {
  hideMediaControlsTemporarily,
  MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
  setControlsOnVideo,
} from '../../utils/media.js';
import { screenshotMedia } from '../../utils/screenshot.js';
import { renderTask } from '../../utils/task.js';
import { dispatchErrorMessageEvent, renderProgressIndicator } from '../message.js';

// Create a wrapper for AlexxIT's WebRTC card
//  - https://github.com/AlexxIT/WebRTC
@customElement('frigate-card-live-webrtc-card')
export class FrigateCardLiveWebRTCCard
  extends LitElement
  implements FrigateCardMediaPlayer
{
  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: false })
  public cameraEndpoints?: CameraEndpoints;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: true, type: Boolean })
  public controls = false;

  protected hass?: HomeAssistant;

  // A task to await the load of the WebRTC component.
  protected _webrtcTask = new Task(this, this._getWebRTCCardElement, () => [1]);

  public async play(): Promise<void> {
    return this._getPlayer()?.play();
  }

  public async pause(): Promise<void> {
    this._getPlayer()?.pause();
  }

  public async mute(): Promise<void> {
    const player = this._getPlayer();
    if (player) {
      player.muted = true;
    }
  }

  public async unmute(): Promise<void> {
    const player = this._getPlayer();
    if (player) {
      player.muted = false;
    }
  }

  public isMuted(): boolean {
    return this._getPlayer()?.muted ?? true;
  }

  public async seek(seconds: number): Promise<void> {
    const player = this._getPlayer();
    if (player) {
      player.currentTime = seconds;
    }
  }

  public async setControls(controls?: boolean): Promise<void> {
    const player = this._getPlayer();
    if (player) {
      setControlsOnVideo(player, controls ?? this.controls);
    }
  }

  public isPaused(): boolean {
    return this._getPlayer()?.paused ?? true;
  }

  public async getScreenshotURL(): Promise<string | null> {
    const video = this._getPlayer();
    return video ? screenshotMedia(video) : null;
  }

  connectedCallback(): void {
    super.connectedCallback();

    // Reset the player when reconnected to the DOM.
    // https://github.com/dermotduffy/frigate-hass-card/issues/996
    this.requestUpdate();
  }

  /**
   * Get the underlying video player.
   * @returns The player or `null` if not found.
   */
  protected _getPlayer(): HTMLVideoElement | null {
    const root = this.renderRoot?.querySelector('#webrtc') as
      | (HTMLElement & { video?: HTMLVideoElement })
      | null;
    return root?.video ?? null;
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
    if (webrtcElement && this.hass && this.cameraConfig) {
      const webrtc = new webrtcElement() as HTMLElement & {
        hass: HomeAssistant;
        setConfig: (config: Record<string, unknown>) => void;
      };
      const config = { ...this.cameraConfig.webrtc_card };
      if (!config.url && !config.entity && this.cameraEndpoints?.webrtcCard) {
        // This will never need to be signed, it is just used internally by the
        // card as a stream name lookup.
        config.url = this.cameraEndpoints.webrtcCard.endpoint;
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
            ? e.message
            : localize('error.webrtc_card_reported_error') + ': ' + (e as Error).message,
          { context: (e as FrigateCardError).context },
        );
      }
      if (webrtcElement) {
        // Set the id to ensure that the relevant CSS styles will have
        // sufficient specifity to overcome some styles that are otherwise
        // applied to <ha-card> in Safari.
        webrtcElement.id = 'webrtc';
      }
      return html`${webrtcElement}`;
    };

    // Use a task to allow us to asynchronously wait for the WebRTC card to
    // load, but yet still have the card load be followed by the updated()
    // lifecycle callback (unlike just using `until`).
    return renderTask(this, this._webrtcTask, render, {
      inProgressFunc: () =>
        renderProgressIndicator({
          message: localize('error.webrtc_card_waiting'),
          cardWideConfig: this.cardWideConfig,
        }),
    });
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
        setControlsOnVideo(video, this.controls);
        video.onloadeddata = () => {
          if (this.controls) {
            hideMediaControlsTemporarily(video, MEDIA_LOAD_CONTROLS_HIDE_SECONDS);
          }
          dispatchMediaLoadedEvent(this, video, {
            player: this,
            capabilities: {
              supportsPause: true,
              hasAudio: mayHaveAudio(video),
            },
          });
        };
        video.onplay = () => dispatchMediaPlayEvent(this);
        video.onpause = () => dispatchMediaPauseEvent(this);
        video.onvolumechange = () => dispatchMediaVolumeChangeEvent(this);
      }
    });
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(liveWebRTCCardStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-live-webrtc-card': FrigateCardLiveWebRTCCard;
  }
}
