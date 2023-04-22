import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import 'side-drawer';
import { SideDrawer } from 'side-drawer';
import drawerInjectStyle from '../scss/drawer-inject.scss';
import drawerStyle from '../scss/drawer.scss';
import { stopEventFromActivatingCardWideActions } from '../utils/action';
import { isHoverableDevice } from '../utils/basic';

export interface DrawerIcons {
  open?: string;
  closed?: string;
}

@customElement('frigate-card-drawer')
export class FrigateCardDrawer extends LitElement {
  @property({ attribute: true, reflect: true })
  public location: 'left' | 'right' = 'left';

  @property({ attribute: true, reflect: true, type: Boolean })
  public control = true;

  @property({ type: Boolean, reflect: true, attribute: true })
  public open = false;

  @property({ attribute: false })
  public icons?: DrawerIcons;

  // The 'empty' attribute is used in the styling to change the drawer
  // visibility and that of all descendants if there is no content. Styling is
  // used rather than display or hidden in order to ensure the contents continue
  // to have a measurable size.
  @property({ type: Boolean, reflect: true, attribute: true })
  public empty = true;

  protected _refDrawer: Ref<HTMLElement & { open: boolean }> = createRef();
  protected _refSlot: Ref<HTMLSlotElement> = createRef();

  protected _resizeObserver = new ResizeObserver(() => this._hideDrawerIfNecessary());

  protected readonly _isHoverableDevice = isHoverableDevice();

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

  /**
   * Called when the slotted children in the drawer change.
   */
  protected _slotChanged(): void {
    const elements = this._refSlot.value?.assignedElements({ flatten: true });

    // Watch all slot children for size changes.
    this._resizeObserver.disconnect();
    for (const element of elements ?? []) {
      this._resizeObserver.observe(element);
    }
    this._hideDrawerIfNecessary();
  }

  /**
   * Hide the drawer if there is nothing to show.
   * @returns
   */
  protected _hideDrawerIfNecessary(): void {
    if (!this._refDrawer.value) {
      return;
    }

    const elements = this._refSlot.value?.assignedElements({ flatten: true });
    this.empty =
      !elements ||
      !elements.length ||
      elements.every((element) => {
        const box = element.getBoundingClientRect();
        return !box.width || !box.height;
      });
  }

  protected render(): TemplateResult {
    return html`
      <side-drawer
        ${ref(this._refDrawer)}
        location="${this.location}"
        ?open=${this.open}
        @mouseleave=${() => {
          if (this.open) {
            this.open = false;
          }
        }}
      >
        ${this.control
          ? html`
              <div
                class="control-surround"
                @click=${(ev: Event) => {
                  stopEventFromActivatingCardWideActions(ev);
                  this.open = !this.open;
                }}
              >
                <ha-icon
                  class="control"
                  icon="${this.open
                    ? this.icons?.open ?? 'mdi:menu-open'
                    : this.icons?.closed ?? 'mdi:menu'}"
                  @mouseenter=${() => {
                    // Only open the drawer on mousenter when the device
                    // supports hover (otherwise iOS may end up passing on
                    // subsequent click events to a different element, see:
                    // https://github.com/dermotduffy/frigate-hass-card/issues/801
                    if (this._isHoverableDevice && !this.open) {
                      this.open = true;
                    }
                  }}
                >
                </ha-icon>
              </div>
            `
          : ''}
        <slot ${ref(this._refSlot)} @slotchange=${() => this._slotChanged()}></slot>
      </side-drawer>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(drawerStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-drawer': FrigateCardDrawer;
    'side-drawer': SideDrawer;
  }
}
