import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { CameraManager } from '../camera-manager/manager';
import { ViewManagerEpoch } from '../card-controller/view/types';
import { ZoomSettingsObserved } from '../components-lib/zoom/types';
import { handleZoomSettingsObservedEvent } from '../components-lib/zoom/zoom-view-context';
import { CameraConfig, ImageViewConfig } from '../config/types';
import { IMAGE_VIEW_ZOOM_TARGET_SENTINEL } from '../const';
import basicBlockStyle from '../scss/basic-block.scss';
import { AdvancedCameraCardMediaPlayer, FullscreenElement } from '../types.js';
import { aspectRatioToString } from '../utils/basic';
import { updateElementStyleFromMediaLayoutConfig } from '../utils/media-layout.js';
import './image-base';
import { resolveImageMode } from './image-base';
import './zoomer.js';

@customElement('advanced-camera-card-image')
export class AdvancedCameraCardImage
  extends LitElement
  implements AdvancedCameraCardMediaPlayer
{
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public imageConfig?: ImageViewConfig;

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

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('cameraConfig') || changedProps.has('imageConfig')) {
      if (
        resolveImageMode({
          imageConfig: this.imageConfig,
          cameraConfig: this.cameraConfig,
        }) === 'camera'
      ) {
        updateElementStyleFromMediaLayoutConfig(
          this,
          this.cameraConfig?.dimensions?.layout,
        );
        this.style.aspectRatio = aspectRatioToString({
          ratio: this.cameraConfig?.dimensions?.aspect_ratio,
        });
      } else {
        updateElementStyleFromMediaLayoutConfig(this);
        this.style.removeProperty('aspect-ratio');
      }
    }
  }

  protected _useZoomIfRequired(template: TemplateResult): TemplateResult {
    const zoomTarget = IMAGE_VIEW_ZOOM_TARGET_SENTINEL;
    const view = this.viewManagerEpoch?.manager.getView();
    const mode = resolveImageMode({
      imageConfig: this.imageConfig,
      cameraConfig: this.cameraConfig,
    });

    return this.imageConfig?.zoomable
      ? html` <advanced-camera-card-zoomer
          .defaultSettings=${guard(
            [this.imageConfig, this.cameraConfig?.dimensions?.layout],
            () =>
              mode === 'camera' && this.cameraConfig?.dimensions?.layout
                ? {
                    pan: this.cameraConfig.dimensions.layout.pan,
                    zoom: this.cameraConfig.dimensions.layout.zoom,
                  }
                : undefined,
          )}
          .settings=${view?.context?.zoom?.[zoomTarget]?.requested}
          @advanced-camera-card:zoom:change=${(ev: CustomEvent<ZoomSettingsObserved>) =>
            handleZoomSettingsObservedEvent(
              ev,
              this.viewManagerEpoch?.manager,
              zoomTarget,
            )}
        >
          ${template}
        </advanced-camera-card-zoomer>`
      : template;
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this.cameraConfig) {
      return;
    }

    return this._useZoomIfRequired(html`
      <advanced-camera-card-image-base
        ${ref(this._refImage)}
        .hass=${this.hass}
        .view=${this.viewManagerEpoch?.manager.getView()}
        .imageConfig=${this.imageConfig}
        .cameraConfig=${this.cameraConfig}
      >
      </advanced-camera-card-image-base>
    `);
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-image': AdvancedCameraCardImage;
  }
}
