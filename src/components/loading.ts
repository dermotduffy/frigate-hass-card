import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import loadingStyle from '../scss/loading.scss';
import { getReleaseVersion } from '../utils/diagnostics';
import './icon';

@customElement('advanced-camera-card-loading')
export class AdvancedCameraCardLoading extends LitElement {
  protected render(): TemplateResult {
    return html`<advanced-camera-card-icon
        .icon=${{ icon: 'iris' }}
      ></advanced-camera-card-icon
      ><span>${getReleaseVersion()}</span>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(loadingStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'advanced-camera-card-loading': AdvancedCameraCardLoading;
  }
}
