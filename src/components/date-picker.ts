import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import 'lit-flatpickr';
import { LitFlatpickr } from 'lit-flatpickr';
import { customElement } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import datePickerStyle from '../scss/date-picker.scss';
import { dispatchFrigateCardEvent } from '../utils/basic';

export interface DatePickerEvent {
  date: Date;
}

@customElement('frigate-card-date-picker')
export class FrigateCardDatePicker extends LitElement {
  protected _refInput: Ref<LitFlatpickr> = createRef();

  public open(): void {
    this._refInput.value?.open();
  }

  protected render(): TemplateResult {
    return html` <lit-flatpickr
      ${ref(this._refInput)}
      .onChange=${(dates: Date[]) => {
        if (dates.length) {
          // This is a single date picker, there should be only a single date.
          dispatchFrigateCardEvent<DatePickerEvent>(this, 'date-picker:change', {
            date: dates[0],
          });
        }
      }}
    ></lit-flatpickr>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(datePickerStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-date-picker': FrigateCardDatePicker;
  }
}
