import {
  CSSResultGroup,
  LitElement,
  TemplateResult,
  html,
  unsafeCSS,
  ReactiveController,
  ReactiveControllerHost,
} from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { customElement, property, state } from 'lit/decorators.js';

import { CameraConfig, ImageViewConfig } from '../types.js';
import { View } from '../view.js';
import { dispatchMediaShowEvent } from '../common.js';
import defaultImage from '../images/frigate-bird-in-sky.jpg';

import imageStyle from '../scss/image.scss';

export class CachedValueController<T> implements ReactiveController {
  public value?: T;

  protected _host: ReactiveControllerHost;
  protected _timerSeconds: number;
  protected _callback: () => T;
  protected _timerID?: number;

  constructor(host: ReactiveControllerHost, timerSeconds: number, callback: () => T) {
    this._timerSeconds = timerSeconds;
    this._callback = callback;
    (this._host = host).addController(this);
  }

  public removeController(): void {
    this._host.removeController(this);
  }

  protected _updateValue(): void {
    this.value = this._callback();
    this._host.requestUpdate();
  }

  hostConnected(): void {
    this._updateValue();

    // Start a timer when the host is connected
    if (this._timerSeconds > 0) {
      this._timerID = window.setInterval(() => {
        this._updateValue();
      }, this._timerSeconds * 1000);
    }
  }
  hostDisconnected(): void {
    // Clear the timer when the host is disconnected
    clearInterval(this._timerID);
    this._timerID = undefined;
  }
}

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
      const entity =
        this.cameraConfig?.camera_entity || this.cameraConfig?.webrtc_card?.entity;
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
