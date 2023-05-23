import {
  css,
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
} from 'lit';
import { customElement, state } from 'lit/decorators.js';
import { setOrRemoveAttribute } from '../utils/basic.js';
import { Zoom } from '../utils/zoom/zoom.js';

@customElement('frigate-card-zoomer')
export class FrigateCardZoomer extends LitElement {
  protected _zoom = new Zoom(this);

  @state()
  protected _zoomed = false;

  protected _zoomHandler = () => (this._zoomed = true);
  protected _unzoomHandler = () => (this._zoomed = false);

  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('frigate-card:zoom:zoomed', this._zoomHandler);
    this.addEventListener('frigate-card:zoom:unzoomed', this._unzoomHandler);
    this._zoom.activate();
  }

  disconnectedCallback(): void {
    this._zoom.deactivate();
    this.removeEventListener('frigate-card:zoom:zoomed', this._zoomHandler);
    this.removeEventListener('frigate-card:zoom:unzoomed', this._unzoomHandler);
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('_zoomed')) {
      setOrRemoveAttribute(this, this._zoomed, 'zoomed');
    }
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
        cursor: auto;
      }
      :host([zoomed]) {
        cursor: move;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-zoomer': FrigateCardZoomer;
  }
}
