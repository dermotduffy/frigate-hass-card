import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { dispatchMediaLoadEvent } from '../common.js';

import imageStyle from '../scss/image.scss';
import defaultImage from '../images/frigate-bird-in-sky.jpg'

@customElement('frigate-card-image')
export class FrigateCardImage extends LitElement {
  @property({ attribute: false })
  protected image?: string;

  protected render(): TemplateResult | void {
    return html` <img
      src=${this.image || defaultImage}
      @load=${(e) => {
        dispatchMediaLoadEvent(this, e);
      }}
    >`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(imageStyle);
  }
}
