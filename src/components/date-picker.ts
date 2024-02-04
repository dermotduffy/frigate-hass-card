import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { localize } from '../localize/localize';
import datePickerStyle from '../scss/date-picker.scss';
import { stopEventFromActivatingCardWideActions } from '../utils/action';
import { dispatchFrigateCardEvent } from '../utils/basic';

export interface DatePickerEvent {
  date: Date;
}

@customElement('frigate-card-date-picker')
export class FrigateCardDatePicker extends LitElement {
  protected _refInput: Ref<HTMLInputElement> = createRef();

  protected render(): TemplateResult {
    return html`<input
        aria-label="${localize('timeline.select_date')}"
        title="${localize('timeline.select_date')}"
        ${ref(this._refInput)}
        type="datetime-local"
        @input=${() => {
          const value = this._refInput.value?.value;
          if (value) {
            dispatchFrigateCardEvent<DatePickerEvent>(this, 'date-picker:change', {
              date: new Date(value),
            });
          }
        }}
      />
      <ha-icon
        aria-label="${localize('timeline.select_date')}"
        title="${localize('timeline.select_date')}"
        .icon=${`mdi:calendar-search`}
        @click=${(ev: Event) => {
          stopEventFromActivatingCardWideActions(ev);
          this._refInput.value?.showPicker();
        }}
      >
      </ha-icon>`;
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
