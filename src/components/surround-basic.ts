import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { customElement, property } from 'lit/decorators.js';
import { DrawerIcons, FrigateCardDrawer } from './drawer.js';

import './drawer.js';

import surroundBasicStyle from '../scss/surround-basic.scss';

interface FrigateCardDrawerOpen {
  drawer: 'left' | 'right';
}

@customElement('frigate-card-surround-basic')
export class FrigateCardSurroundBasic extends LitElement {
  @property({ attribute: false })
  public drawerIcons?: {
    left?: DrawerIcons;
    right?: DrawerIcons;
  };

  protected _refDrawerLeft: Ref<FrigateCardDrawer> = createRef();
  protected _refDrawerRight: Ref<FrigateCardDrawer> = createRef();
  protected _boundDrawerHandler = this._drawerHandler.bind(this);

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    this.addEventListener('frigate-card:drawer:open', this._boundDrawerHandler);
    this.addEventListener('frigate-card:drawer:close', this._boundDrawerHandler);
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    super.disconnectedCallback();
    this.removeEventListener('frigate-card:drawer:open', this._boundDrawerHandler);
    this.removeEventListener('frigate-card:drawer:close', this._boundDrawerHandler);
  }

  protected _drawerHandler(ev: Event) {
    const drawer = (ev as CustomEvent<FrigateCardDrawerOpen>).detail.drawer;
    const open = ev.type.endsWith(':open');
    if (drawer === 'left' && this._refDrawerLeft.value) {
      this._refDrawerLeft.value.open = open;
    } else if (drawer === 'right' && this._refDrawerRight.value) {
      this._refDrawerRight.value.open = open;
    }
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    return html` <slot name="above"></slot>
      <slot></slot>
      <frigate-card-drawer
        ${ref(this._refDrawerLeft)}
        location="left"
        .icons=${this.drawerIcons?.left}
      >
        <slot name="left"></slot>
      </frigate-card-drawer>
      <frigate-card-drawer
        ${ref(this._refDrawerRight)}
        location="right"
        .icons=${this.drawerIcons?.right}
      >
        <slot name="right"></slot>
      </frigate-card-drawer>
      <slot name="below"></slot>`;
  }

  /**
   * Return compiled CSS styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(surroundBasicStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-surround-basic': FrigateCardSurroundBasic;
  }
}
