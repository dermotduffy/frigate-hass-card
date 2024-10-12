import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import irisLogo from '../images/camera-iris-transparent.svg';
import loadingStyle from '../scss/loading.scss';

@customElement('frigate-card-loading')
export class FrigateCardLoading extends LitElement {
  protected render(): TemplateResult {
    return html` <img src="${irisLogo}" /> `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(loadingStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-loading': FrigateCardLoading;
  }
}
