import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { dispatchMediaShowEvent } from '../common.js';

import type { ImageViewConfig } from '../types.js';
import defaultImage from '../images/frigate-bird-in-sky.jpg'

import imageStyle from '../scss/image.scss';

@customElement('frigate-card-image')
export class FrigateCardImage extends LitElement {
  @property({ attribute: false })
  protected imageConfig?: ImageViewConfig;

  protected render(): TemplateResult | void {
    return html` <img
      src=${this.imageConfig?.src || defaultImage}
      @load=${(e) => {
        dispatchMediaShowEvent(this, e);
      }}
    >`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(imageStyle);
  }
}
