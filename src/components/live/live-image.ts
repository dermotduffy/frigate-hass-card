import { HomeAssistant } from 'custom-card-helpers';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import liveImageStyle from '../../scss/live-image.scss';
import { CameraConfig, FrigateCardMediaPlayer } from '../../types.js';
import '../image.js';
import { getStateObjOrDispatchError } from './live.js';

@customElement('frigate-card-live-image')
export class FrigateCardLiveImage extends LitElement implements FrigateCardMediaPlayer {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  protected _refImage: Ref<Element & FrigateCardMediaPlayer> = createRef();

  public async play(): Promise<void> {
    await this._refImage.value?.play();
  }

  public async pause(): Promise<void> {
    await this._refImage.value?.pause();
  }

  public async mute(): Promise<void> {
    await this._refImage.value?.mute();
  }

  public async unmute(): Promise<void> {
    await this._refImage.value?.unmute();
  }

  public isMuted(): boolean {
    return !!this._refImage.value?.isMuted();
  }

  public async seek(seconds: number): Promise<void> {
    await this._refImage.value?.seek(seconds);
  }

  public async setControls(controls?: boolean): Promise<void> {
    await this._refImage.value?.setControls(controls);
  }

  public isPaused(): boolean {
    return this._refImage.value?.isPaused() ?? true;
  }

  public async getScreenshotURL(): Promise<string | null> {
    return await this._refImage.value?.getScreenshotURL() ?? null;
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this.cameraConfig) {
      return;
    }

    getStateObjOrDispatchError(this, this.hass, this.cameraConfig);

    return html` <frigate-card-image
      ${ref(this._refImage)}
      .imageConfig=${{
        mode: this.cameraConfig.image.url ? ('url' as const) : ('camera' as const),
        refresh_seconds: this.cameraConfig.image.refresh_seconds,
        url: this.cameraConfig.image.url,

        // The live provider will take care of zoom and layout options.
        zoomable: false,
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
