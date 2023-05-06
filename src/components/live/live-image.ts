import { HomeAssistant } from 'custom-card-helpers';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import liveImageStyle from '../../scss/live-image.scss';
import { CameraConfig, FrigateCardMediaPlayer } from '../../types.js';
import { getStateObjOrDispatchError } from './live.js';
import '../image.js';

@customElement('frigate-card-live-image')
export class FrigateCardLiveImage extends LitElement implements FrigateCardMediaPlayer {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @state()
  protected _playing = true;

  public async play(): Promise<void> {
    this._playing = true;
  }

  public async pause(): Promise<void> {
    this._playing = false;
  }

  public async mute(): Promise<void> {
    // Not implemented.
  }

  public async unmute(): Promise<void> {
    // Not implemented.
  }

  public isMuted(): boolean {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async seek(_seconds: number): Promise<void> {
    // Not implemented.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async setControls(_controls: boolean): Promise<void> {
    // Not implemented.
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this.cameraConfig) {
      return;
    }

    getStateObjOrDispatchError(this, this.hass, this.cameraConfig);

    return html` <frigate-card-image
      .imageConfig=${{
        mode: this.cameraConfig.image.url ? ('url' as const) : ('camera' as const),
        refresh_seconds: this._playing ? this.cameraConfig.image.refresh_seconds : 0,
        url: this.cameraConfig.image.url,

        // The live provider will take care of zoom.
        zoomable: false,

        // Don't need to pass layout options as FrigateCardLiveProvider has
        // already taken care of this for us.
      }}
      .hass=${this.hass}
      .cameraConfig=${this.cameraConfig}
    >
    </frigate-card-image>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveImageStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-live-image': FrigateCardLiveImage;
  }
}
