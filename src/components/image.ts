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
  protected _boundVisibilityHandler = this._visibilityHandler.bind(this);
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
    if (!this.hass || document.visibilityState !== 'visible') {
      return false;
    }

    // If camera mode is enabled, reject all updates if hass is older than
    // HASS_REJECTION_CUTOFF_MS or if HASS is not currently connected. By using
    // an older hass (even if it is not the property being updated), we run the
    // risk that the JS has an old access token for the camera, and that results
    // in a notification on the HA UI about a failed login. See
    // https://github.com/dermotduffy/frigate-hass-card/issues/398 .
    const cameraEntity = this._getCameraEntity();
    const state = cameraEntity ? this.hass.states[cameraEntity] : undefined;
    if (
      this._imageConfig?.mode === 'camera' &&
      (!this.hass.connected ||
        !state ||
        Date.now() - Date.parse(state.last_updated) >= HASS_REJECTION_CUTOFF_MS)
    ) {
      return false;
    }

    if (
      changedProps.has('hass') &&
      changedProps.size == 1 &&
      this._imageConfig?.mode === 'camera' &&
      cameraEntity
    ) {
      if (shouldUpdateBasedOnHass(this.hass, changedProps.get('hass'), [cameraEntity])) {
        // If the state of the camera entity has changed, remove the cached
        // value (will be re-calculated in willUpdate). This is important to
        // ensure a changed access token is immediately used.
        this._cachedValueController?.clearValue();
        return true;
      }
      return false;
    }
    return true;
  }

  /**
   * Ensure there is a cached value before an update.
   * @param _changedProps The changed properties
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected willUpdate(_changedProps: PropertyValues): void {
    if (!this._cachedValueController?.value) {
      this._cachedValueController?.updateValue();
    }
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this._boundVisibilityHandler);
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    document.removeEventListener('visibilitychange', this._boundVisibilityHandler);
    super.disconnectedCallback();
  }

  /**
   * Handle document visibility changes.
   */
  protected _visibilityHandler(): void {
    if (!this._image) {
      return;
    }
    if (document.visibilityState === 'hidden') {
      // Set the image to default when the document is hidden. This is to avoid
      // some browsers (e.g. Firefox) eagerly re-loading the old image when the
      // document regains visibility -- for some images (e.g. camera mode) the
      // image may be using an old-expired token and re-use prior to
      // re-generation of a new URL would generate an unauthorized request
      // (401), see:
      // https://github.com/dermotduffy/frigate-hass-card/issues/398
      this._cachedValueController?.clearValue();
      this._image.src = defaultImage;
    } else {
      // If the document is freshly re-visible, immediately re-render it to
      // restore the image src. If the HASS object is old (i.e. browser tab was
      // inactive for some time) this update request may be (correctly)
      // rejected.
      this.requestUpdate();
    }
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
