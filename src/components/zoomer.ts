import { css, CSSResultGroup, html, LitElement, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { Zoom } from '../utils/zoom/zoom.js';

@customElement('frigate-card-zoomer')
export class FrigateCardZoomer extends LitElement {
  protected _zoom = new Zoom(this);

  connectedCallback(): void {
    super.connectedCallback();
    this._zoom.activate();
  }

  disconnectedCallback(): void {
    this._zoom.deactivate();
  }

  protected render(): TemplateResult | void {
    return html` <slot></slot> `;
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        width: 100%;
        height: 100%;
        display: block;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-zoomer': FrigateCardZoomer;
  }
}
