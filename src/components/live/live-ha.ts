import { HomeAssistant } from 'custom-card-helpers';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import liveFrigateStyle from '../../scss/live-frigate.scss';
import { CameraConfig, FrigateCardMediaPlayer } from '../../types.js';
import { getStateObjOrDispatchError } from './live.js';
import '../../patches/ha-camera-stream';
import '../../patches/ha-hls-player.js';
import '../../patches/ha-web-rtc-player.ts';


@customElement('frigate-card-live-ha')
export class FrigateCardLiveHA extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  protected _playerRef: Ref<Element & FrigateCardMediaPlayer> = createRef();

  /**
   * Play the video.
   */
  public play(): void {
    this._playerRef.value?.play();
  }

  /**
   * Pause the video.
   */
  public pause(): void {
    this._playerRef.value?.pause();
  }

  /**
   * Mute the video.
   */
  public mute(): void {
    this._playerRef.value?.mute();
  }

  /**
   * Unmute the video.
   */
  public unmute(): void {
    this._playerRef.value?.unmute();
  }

  /**
   * Seek the video.
   */
  public seek(seconds: number): void {
    this._playerRef.value?.seek(seconds);
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass) {
      return;
    }

    const stateObj = getStateObjOrDispatchError(this, this.hass, this.cameraConfig);
    if (!stateObj) {
      return;
    }

    return html` <frigate-card-ha-camera-stream
      ${ref(this._playerRef)}
      .hass=${this.hass}
      .stateObj=${stateObj}
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

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-live-ha': FrigateCardLiveHA;
  }
}
