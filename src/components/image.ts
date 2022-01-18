import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { dispatchMediaShowEvent } from '../common.js';

import type { ImageViewConfig } from '../types.js';
import defaultImage from '../images/frigate-bird-in-sky.jpg';

import imageStyle from '../scss/image.scss';
import { View } from '../view.js';

@customElement('frigate-card-image')
export class FrigateCardImage extends LitElement {
  @property({ attribute: false })
  protected imageConfig?: ImageViewConfig;

  // A new view should trigger an image re-render.
  @property({ attribute: false })
  protected view?: Readonly<View>;

  protected _getImageSource(): string {
    if (this.imageConfig?.src) {
      const url = new URL(this.imageConfig.src);
      url.searchParams.append('t', String(Date.now()));
      return url.toString();
    }
    return defaultImage;
  }

  protected render(): TemplateResult | void {
    return html` <img
      src=${this._getImageSource()}
      @load=${(e) => {
        dispatchMediaShowEvent(this, e);
      }}
    />`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(imageStyle);
  }
}
