import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import selectStyle from '../scss/select.scss';
import { contentsChanged, dispatchFrigateCardEvent } from '../utils/basic';
import { ScopedRegistryHost } from '@lit-labs/scoped-registry-mixin';
import { grSelectElements } from '../scoped-elements/gr-select';
import isEqual from 'lodash-es/isEqual';
import '../scoped-elements/gr-select';

export interface SelectOption {
  label: string;
  value: string;
}

export type SelectValues = string | string[];

type SelectElement = HTMLElement & {
  value: SelectValues;
};

export class FrigateCardSelect extends ScopedRegistryHost(LitElement) {
  @property({ attribute: false, hasChanged: contentsChanged })
  public options?: SelectOption[];

  @property({ attribute: false, hasChanged: contentsChanged })
  public value?: SelectValues;

  @property({ attribute: true })
  public label?: string;

  @property({ attribute: true })
  public placeholder?: string;

  @property({ attribute: true, type: Boolean })
  public multiple?: boolean = false;

  @property({ attribute: true, type: Boolean })
  public clearable?: boolean = false;

  protected _previouslyReportedValue?: SelectValues;
  protected _refSelect: Ref<SelectElement> = createRef();

  static elementDefinitions = {
    ...grSelectElements,
  };

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _valueChangedHandler(_ev: CustomEvent<{ value: unknown }>): void {
    const value: SelectValues | undefined = this._refSelect.value?.value;
    // The underlying gr-select element is very sensitive and occasionally fires
    // the change event even if the value has not actually changed. Prevent that
    // from propagating upwards.
    if (value !== undefined && !isEqual(this.value, value)) {
      this.value = value;
      dispatchFrigateCardEvent(this, 'select:change', value);
    }
  }

  protected render(): TemplateResult | void {
    return html` <gr-select
      ${ref(this._refSelect)}
      label=${this.label ?? ''}
      placeholder=${this.placeholder ?? ''}
      size="small"
      ?multiple=${this.multiple}
      ?clearable=${this.clearable}
      .value=${this.value ?? this._refSelect.value?.value ?? []}
      @gr-change=${this._valueChangedHandler.bind(this)}
    >
      ${this.options?.map(
        (option) =>
          html`<gr-menu-item value="${option.value ?? ''}"
            >${option.label}</gr-menu-item
          >`,
      )}
    </gr-select>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(selectStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-select': FrigateCardSelect;
  }
}
