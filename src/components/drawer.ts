import {
  CSSResultGroup,
  LitElement,
  TemplateResult,
  html,
  unsafeCSS,
  PropertyValues,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import 'side-drawer';

import drawerStyle from '../scss/drawer.scss';
import drawerInjectStyle from '../scss/drawer-inject.scss';

@customElement('frigate-card-drawer')
export class FrigateCardDrawer extends LitElement {
  @property({ attribute: true, reflect: true })
  public location: 'left' | 'right' = 'left';

  /**
   * Set the timeline configuration.
   */
  @property({ type: Boolean, reflect: true, attribute: true })
  set open(open: boolean) {
    if (this._drawerRef.value) {
      const old = this._drawerRef.value.open;
      this._drawerRef.value.open = open;
      this.requestUpdate('open', old);
    }
  }

  get open(): boolean {
    return this._drawerRef.value?.open ?? false;
  }

  protected _drawerRef: Ref<HTMLElement & { open: boolean }> = createRef();

  /**
   * Called on the first update.
   * @param changedProps The changed properties.
   */
  protected firstUpdated(changedProps: PropertyValues): void {
    super.firstUpdated(changedProps);

    // The `side-drawer` component (and the material drawer for that matter)
    // only do fixed drawers (i.e. a drawer for the whole viewport). Hackily
    // override the style to customize the drawer to be absolute within the div.
    const style = document.createElement('style');
    style.innerHTML = drawerInjectStyle;
    this._drawerRef.value?.shadowRoot?.appendChild(style);
  }

  protected render(): TemplateResult {
    return html` <side-drawer location="${this.location}" ${ref(this._drawerRef)}>
      <slot></slot>
    </side-drawer>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(drawerStyle);
  }
}
