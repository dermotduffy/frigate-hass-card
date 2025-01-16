import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import loadingStyle from '../scss/loading.scss';
import { getReleaseVersion } from '../utils/diagnostics';
import './icon';

@customElement('frigate-card-loading')
export class FrigateCardLoading extends LitElement {
  protected render(): TemplateResult {
    return html`<frigate-card-icon .icon=${{ icon: 'iris' }}></frigate-card-icon
      ><span>${getReleaseVersion()}</span>`;
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
