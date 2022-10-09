import { HomeAssistant } from 'custom-card-helpers';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import liveFrigateStyle from '../../scss/live-frigate.scss';
import { CameraConfig, LiveImageConfig } from '../../types.js';
import { getStateObjOrDispatchError } from './live.js';
import '../image.js';

@customElement('frigate-card-live-image')
export class FrigateCardLiveImage extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: false })
  public liveImageConfig?: LiveImageConfig;

  @state()
  protected _playing = true;

  /**
   * Play the video.
   */
  public play(): void {
    this._playing = true;
  }

  /**
   * Pause the video.
   */
  public pause(): void {
    this._playing = false;
  }

  /**
   * Mute the video.
   */
  public mute(): void {
    // Not implemented.
  }

  /**
   * Unmute the video.
   */
  public unmute(): void {
    // Not implemented.
  }

  /**
   * Seek the video.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public seek(_seconds: number): void {
    // Not implemented.
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.liveImageConfig) {
      return;
    }

    getStateObjOrDispatchError(this, this.hass, this.cameraConfig);

    return html` <frigate-card-image
      .imageConfig=${{
        mode: 'camera' as const,
        refresh_seconds: this._playing ? this.liveImageConfig.refresh_seconds : 0,
      }}
      .hass=${this.hass}
      .cameraConfig=${this.cameraConfig}
    >
    </frigate-card-image>`;
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
    'frigate-card-live-image': FrigateCardLiveImage;
  }
}
