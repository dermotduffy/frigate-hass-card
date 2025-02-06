import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { CameraConfig } from '../../../config/types';
import basicBlockStyle from '../../../scss/basic-block.scss';
import { AdvancedCameraCardMediaPlayer, FullscreenElement } from '../../../types.js';
import '../../image-base.js';

@customElement('advanced-camera-card-live-image')
export class AdvancedCameraCardLiveImage
  extends LitElement
  implements AdvancedCameraCardMediaPlayer
{
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  protected _refImage: Ref<Element & AdvancedCameraCardMediaPlayer> = createRef();

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
    return (await this._refImage.value?.getScreenshotURL()) ?? null;
  }

  public getFullscreenElement(): FullscreenElement | null {
    return this._refImage.value?.getFullscreenElement() ?? null;
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this.cameraConfig) {
      return;
    }

    return html`
      <advanced-camera-card-image-base
        ${ref(this._refImage)}
        .hass=${this.hass}
        .imageConfig=${this.cameraConfig.image}
        .cameraConfig=${this.cameraConfig}
      >
      </advanced-camera-card-image-base>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-live-image': AdvancedCameraCardLiveImage;
  }
}
