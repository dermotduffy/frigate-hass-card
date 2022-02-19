import {
  CSSResultGroup,
  LitElement,
  PropertyValues,
  TemplateResult,
  html,
  unsafeCSS,
} from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { customElement, property, state } from 'lit/decorators.js';

import { CachedValueController } from '../cached-value-controller.js';
import { CameraConfig, ImageViewConfig } from '../types.js';
import { View } from '../view.js';
import { dispatchMediaShowEvent, shouldUpdateBasedOnHass } from '../common.js';
import defaultImage from '../images/frigate-bird-in-sky.jpg';

import imageStyle from '../scss/image.scss';

@customElement('frigate-card-image')
export class FrigateCardImage extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected cameraConfig?: CameraConfig;

  @state()
  protected _imageConfig?: ImageViewConfig;

  protected _cachedValueController?: CachedValueController<string>;

  /**
   * Set the image configuration.
   */
  set imageConfig(imageConfig: ImageViewConfig) {
    this._imageConfig = imageConfig;
    if (this._cachedValueController) {
      this._cachedValueController.removeController();
    }
    this._cachedValueController = new CachedValueController(
      this,
      this._imageConfig.refresh_seconds,
      this._getImageSource.bind(this),
    );
  }

  /**
   * Get the camera entity for the current camera configuration.
   * @returns The entity or undefined if no camera entity is available.
   */
  protected _getCameraEntity(): string | undefined {
    return this.cameraConfig?.camera_entity || this.cameraConfig?.webrtc_card?.entity;
  }

  /**
   * Determine whether the element should be updated.
   * @param changedProps The changed properties if any.
   * @returns `true` if the element should be updated.
   */
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
    let shouldUpdate = !oldHass || changedProps.size != 1;

    // Image needs to update if the image view is in camera mode and the camera
    // entity changes, as this could be a security token change.
    if (oldHass && this._imageConfig?.mode === 'camera') {
      const cameraEntity = this._getCameraEntity();
      if (
        shouldUpdateBasedOnHass(this.hass, oldHass, cameraEntity ? [cameraEntity] : [])
      ) {
        shouldUpdate ||= true;
        this._cachedValueController?.updateValue();
      }
    }
    return shouldUpdate;
  }

  /**
   * Build a working absolute image URL that the browser will not cache.
   * @param url An input URL (may be relative to document origin)
   * @returns A new URL (absolute, will not be browser cached).
   */
  protected _buildImageURL(url: string): string {
    const urlObj = new URL(url, document.baseURI);
    urlObj.searchParams.append('_t', String(Date.now()));
    return urlObj.toString();
  }

  protected _getImageSource(): string {
    if (this._imageConfig?.mode === 'url' && this._imageConfig?.url) {
      return this._buildImageURL(this._imageConfig.url);
    } else if (this.hass && this._imageConfig?.mode === 'camera') {
      const entity = this._getCameraEntity();
      if (entity) {
        const state = this.hass.states[entity];
        if (state && state.attributes.entity_picture) {
          return this._buildImageURL(state.attributes.entity_picture);
        }
      }
    }
    return defaultImage;
  }

  protected render(): TemplateResult | void {
    const src = this._cachedValueController?.value;
    return src
      ? html` <img
          src=${src}
          @load=${(e) => {
            dispatchMediaShowEvent(this, e);
          }}
        />`
      : html``;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(imageStyle);
  }
}
