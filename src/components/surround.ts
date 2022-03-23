import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { customElement } from 'lit/decorators.js';

import { FrigateCardDrawer } from './drawer.js';

import './drawer.js';

import surroundStyle from '../scss/surround.scss';

interface FrigateCardDrawerOpen {
  drawer: 'left' | 'right';
}

@customElement('frigate-card-surround')
export class FrigateCardSurround extends LitElement {
  protected _refDrawerLeft: Ref<FrigateCardDrawer> = createRef();
  protected _refDrawerRight: Ref<FrigateCardDrawer> = createRef();
  protected _boundDrawerOpenHandler = this._drawerOpen.bind(this);

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('frigate-card:drawer:open', this._boundDrawerOpenHandler);
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('frigate-card:drawer:open', this._boundDrawerOpenHandler);
  }

  protected _drawerOpen(ev: Event) {
    const drawer = (ev as CustomEvent<FrigateCardDrawerOpen>).detail.drawer;
    if (drawer === 'left' && this._refDrawerLeft.value) {
      this._refDrawerLeft.value.open = true;
    } else if (drawer === 'right' && this._refDrawerRight.value) {
      this._refDrawerRight.value.open = true;
    }
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    return html` <slot name="above"></slot>
      <slot></slot>
      <frigate-card-drawer ${ref(this._refDrawerLeft)} location="left">
        <slot name="left"></slot>
      </frigate-card-drawer>
      <frigate-card-drawer ${ref(this._refDrawerRight)} location="right">
        <slot name="right"></slot>
      </frigate-card-drawer>
      <slot name="below"></slot>`;
  }

  /**
   * Return compiled CSS styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(surroundStyle);
  }
}
