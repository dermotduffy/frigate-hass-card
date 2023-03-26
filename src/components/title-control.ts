import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { customElement, property } from 'lit/decorators.js';
import { TitleControlConfig } from '../types.js';

import titleStyle from '../scss/title-control.scss';

type PaperToast = HTMLElement & {
  opened: boolean;
};

@customElement('frigate-card-title-control')
export class FrigateCardTitleControl extends LitElement {
  @property({ attribute: false })
  public config?: TitleControlConfig;

  @property({ attribute: false })
  public text?: string;

  @property({ attribute: false })
  public fitInto?: HTMLElement;

  @property({ attribute: false })
  public logo?: string;

  protected _toastRef: Ref<PaperToast> = createRef();

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult {
    if (!this.text || !this.config || this.config.mode == 'none' || !this.fitInto) {
      return html``;
    }

    const verticalAlign = this.config.mode.match(/-top-/) ? 'top' : 'bottom';
    const horizontalAlign = this.config.mode.match(/-left$/) ? 'left' : 'right';

    return html` <paper-toast
      ${ref(this._toastRef)}
      class="capsule"
      .duration=${this.config.duration_seconds * 1000}
      .verticalAlign=${verticalAlign}
      .horizontalAlign=${horizontalAlign}
      .text="${this.text}"
      .fitInto=${this.fitInto}
    >
      ${this.logo ? html`<img src=${this.logo} />` : ''}
    </paper-toast>`;
  }

  /**
   * Determine if the toast is visible.
   * @returns `true` if the toast is visible, `false` otherwise.
   */
  public isVisible(): boolean {
    return this._toastRef.value?.opened ?? false;
  }

  /**
   * Show the toast.
   */
  public hide(): void {
    if (this._toastRef.value) {
      // Set it to false first, to ensure the timer resets.
      this._toastRef.value.opened = false;
    }
  }

  /**
   * Show the toast.
   */
  public show(): void {
    if (this._toastRef.value) {
      // Set it to false first, to ensure the timer resets.
      this._toastRef.value.opened = false;
      this._toastRef.value.opened = true;
    }
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(titleStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-title-control': FrigateCardTitleControl;
  }
}
