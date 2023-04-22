import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import liveMSEStyle from '../../scss/live-go2rtc.scss';
import {
  CameraConfig,
  ExtendedHomeAssistant,
  FrigateCardMediaPlayer,
} from '../../types.js';
import '../image.js';
import {
  hideMediaControlsTemporarily,
  MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
} from '../../utils/media';
import { dispatchMediaLoadedEvent } from '../../utils/media-info';
import { localize } from '../../localize/localize';
import { dispatchErrorMessageEvent } from '../message';
import { VideoRTC } from '../../external/go2rtc/video-rtc';
import { CameraEndpoints } from '../../camera-manager/types.js';
import { getEndpointAddressOrDispatchError } from '../../utils/endpoint';

// Note (2023-02-18): Depending on the behavior of the player / browser is
// possible this URL will need to be re-signed in order to avoid HA spamming
// logs after the expiry time, but this complexity is not added for now until
// there are verified cases of this being an issue (see equivalent in the JSMPEG
// provider).
const GO2RTC_URL_SIGN_EXPIRY_SECONDS = 24 * 60 * 60;

@customElement('frigate-card-live-go2rtc-player')
class FrigateCardGo2RTCPlayer extends VideoRTC {
  public play(): void {
    // Let Frigate card control auto playing.
  }

  public oninit(): void {
    super.oninit();

    if (this.video) {
      const onloadeddata = this.video.onloadeddata;
      this.video.onloadeddata = (e) => {
        if (onloadeddata) {
          onloadeddata.call(this.video, e);
        }
        hideMediaControlsTemporarily(this.video, MEDIA_LOAD_CONTROLS_HIDE_SECONDS);
        dispatchMediaLoadedEvent(this, this.video);
      };

      // Always started muted. Media may be unmuted in accordance with user
      // configuration.
      this.video.muted = true;
    }
  }
}

@customElement('frigate-card-live-go2rtc')
export class FrigateCardGo2RTC extends LitElement implements FrigateCardMediaPlayer {
  // Not an reactive property to avoid resetting the video.
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: false })
  public cameraEndpoints?: CameraEndpoints;

  protected _player?: FrigateCardGo2RTCPlayer;

  public async play(): Promise<void> {
    return this._player?.video?.play();
  }

  public async pause(): Promise<void> {
    this._player?.video?.pause();
  }

  public async mute(): Promise<void> {
    if (this._player?.video) {
      this._player.video.muted = true;
    }
  }

  public async unmute(): Promise<void> {
    if (this._player?.video) {
      this._player.video.muted = false;
    }
  }

  public isMuted(): boolean {
    return this._player?.video.muted ?? true;
  }

  public async seek(seconds: number): Promise<void> {
    if (this._player?.video) {
      this._player.video.currentTime = seconds;
    }
  }

  public async setControls(controls: boolean): Promise<void> {
    if (this._player?.video) {
      this._player.video.controls = controls;
    }
  }

  disconnectedCallback(): void {
    this._player = undefined;
  }

  connectedCallback(): void {
    super.connectedCallback();

    // Reset the player when reconnected to the DOM.
    // https://github.com/dermotduffy/frigate-hass-card/issues/996
    this.requestUpdate();
  }

  protected async _createPlayer(): Promise<void> {
    if (!this.hass) {
      return;
    }

    const endpoint = this.cameraEndpoints?.go2rtc;
    if (!endpoint) {
      return dispatchErrorMessageEvent(this, localize('error.live_camera_no_endpoint'), {
        context: this.cameraConfig,
      });
    }

    const address = await getEndpointAddressOrDispatchError(
      this,
      this.hass,
      endpoint,
      GO2RTC_URL_SIGN_EXPIRY_SECONDS,
    );
    if (!address) {
      return;
    }

    this._player = new FrigateCardGo2RTCPlayer();
    this._player.src = address;
    this._player.visibilityCheck = false;

    if (this.cameraConfig?.go2rtc?.modes && this.cameraConfig.go2rtc.modes.length) {
      this._player.mode = this.cameraConfig.go2rtc.modes.join(',');
    }

    this.requestUpdate();
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (!this._player || changedProps.has('cameraEndpoints')) {
      this._createPlayer();
    }
  }

  protected render(): TemplateResult | void {
    return html`${this._player}`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveMSEStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-live-go2rtc': FrigateCardGo2RTC;
  }
}
