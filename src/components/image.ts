import {
  CSSResultGroup,
  LitElement,
  TemplateResult,
  html,
  unsafeCSS,
  ReactiveController,
  ReactiveControllerHost,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

import { ImageViewConfig } from '../types.js';
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
  @state()
  protected _imageConfig?: ImageViewConfig;

  // A new view should trigger an image re-render.
  @property({ attribute: false })
  protected view?: Readonly<View>;
  protected _cachedValueController?: CachedValueController<string>;

  protected _getImageSource(): string {
    if (this._imageConfig?.src) {
      const url = new URL(this._imageConfig.src);
      url.searchParams.append('t', String(Date.now()));
      return url.toString();
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
