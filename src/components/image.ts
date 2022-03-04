import {
  CSSResultGroup,
  LitElement,
  PropertyValues,
  TemplateResult,
  html,
  unsafeCSS,
} from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { customElement, property, query, state } from 'lit/decorators.js';

import { CachedValueController } from '../cached-value-controller.js';
import { CameraConfig, ImageViewConfig } from '../types.js';
import { View } from '../view.js';
import { dispatchMediaShowEvent, shouldUpdateBasedOnHass } from '../common.js';
import defaultImage from '../images/frigate-bird-in-sky.jpg';

import imageStyle from '../scss/image.scss';

// See: https://github.com/home-assistant/core/blob/dev/homeassistant/components/camera/__init__.py#L101
const HASS_REJECTION_CUTOFF_MS = 5 * 60 * 1000;

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

  @query('img')
  protected _image?: HTMLImageElement;

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
    this._cachedValueController.startTimer();
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
    if (!this.hass) {
      return false;
    }

    // If camera mode is enabled, reject all updates if hass is older than
    // HASS_REJECTION_CUTOFF_MS. By using an older hass (even if it is not the
    // property being updated), we run the risk that the JS has an old access
    // token for the camera, and that results in a notification on the HA UI
    // about a failed login. See
    // https://github.com/dermotduffy/frigate-hass-card/issues/398 .
    const cameraEntity = this._getCameraEntity();
    const state = cameraEntity ? this.hass.states[cameraEntity] : undefined;
    if (
      this._imageConfig?.mode === 'camera' &&
      state &&
      Date.now() - Date.parse(state.last_updated) >=
      HASS_REJECTION_CUTOFF_MS
    ) {
      return false;
    }

    if (changedProps.has('hass') &&
        changedProps.size == 1 &&
        this._imageConfig?.mode === 'camera' &&
        cameraEntity) {
      if (shouldUpdateBasedOnHass(this.hass, changedProps.get('hass'), [cameraEntity])) {
        // Image needs to update if the image view is in camera mode and the camera
        // entity changes, as this could be a security token change.
        this._cachedValueController?.updateValue();
        this._cachedValueController?.startTimer();
        return true;
      }
      return false;
    }
    return true;
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
