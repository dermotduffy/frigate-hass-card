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

  @property({ attribute: true, reflect: true, type: Boolean })
  public control = true;

  @property({ type: Boolean, reflect: true, attribute: true })
  public open = false;

  protected _refDrawer: Ref<HTMLElement & { open: boolean }> = createRef();
  protected _refSlot: Ref<HTMLSlotElement> = createRef();

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
    this._refDrawer.value?.shadowRoot?.appendChild(style);
  }

  protected _slotChanged(): void {
    const elements = this._refSlot.value?.assignedElements({ flatten: true });
    if (elements && elements.length && this._refDrawer.value) {
      // Hide the drawer unless there is content.
      this._refDrawer.value.hidden = false;
    }
  }

  protected render(): TemplateResult {
    return html`
      <side-drawer
        ${ref(this._refDrawer)}
        ?hidden=${true}
        location="${this.location}"
        ?open=${this.open}
      >
        ${this.control
          ? html`
              <div
                class="control-surround"
                @click=${() => {
                  this.open = !this.open;
                }}
              >
                <ha-icon
                  class="control"
                  icon="${this.open ? 'mdi:menu-open' : 'mdi:menu'}"
                >
                </ha-icon>
              </div>
            `
          : ''}
        <slot ${ref(this._refSlot)} @slotchange=${this._slotChanged}></slot>
      </side-drawer>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(drawerStyle);
  }
}
