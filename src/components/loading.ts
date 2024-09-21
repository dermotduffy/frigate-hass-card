import {
  CSSResultGroup,
  LitElement,
  PropertyValues,
  TemplateResult,
  html,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import irisLogo from '../images/camera-iris.svg';
import controlStyle from '../scss/loading.scss';
import { Timer } from '../utils/timer';

// Number of seconds after the loading spinner is hidden before rendering this
// component as empty. Should be longer than the opacity css transition time.
const LOADING_EMPTY_SECONDS = 2;

@customElement('frigate-card-loading')
export class FrigateCardLoading extends LitElement {
  @property({ attribute: true, reflect: true, type: Boolean })
  public show = false;

  @state()
  protected _empty = false;

  protected _timer = new Timer();

  protected render(): TemplateResult {
    return this._empty ? html`` : html` <img src="${irisLogo}" /> `;
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('show') && !this.show) {
      this._timer.start(LOADING_EMPTY_SECONDS, () => {
        this._empty = true;
      });
    }
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(controlStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-loading': FrigateCardLoading;
  }
}
