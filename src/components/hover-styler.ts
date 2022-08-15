import { html, LitElement, PropertyValues, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { StyleInfo } from 'lit/directives/style-map.js';
import { merge } from 'lodash-es';
import { contentsChanged } from '../utils/basic';

// This component exists to allow user-provided styles to applied dynamically on
// hover. This is implemented this way because:
// - Inline styling does not support hover (i.e. dynamic hover styles cannot be
//   set directly on an element).
// - In some cases we may wish to apply styles selectively further "down the
//   DOM" (e.g. styling an mwc-list-item during hover will require styling the
//   child elements to override their set styles -- CSS style inheritance will
//   not work in these cases).

@customElement('frigate-card-hover-styler')
export class FrigateCardHoverStyle extends LitElement {
  // Use contentsChanged here since the menu dynamically refreshes its state
  // (e.g. icons, colors) and that causes the object for the style to change
  // continuously even though the contents won't.
  @property({ attribute: false, hasChanged: contentsChanged })
  public baseStyle?: StyleInfo;

  @property({ attribute: false, hasChanged: contentsChanged })
  public hoverStyle?: StyleInfo;

  @property({ attribute: false })
  public selector?: string;

  protected _refSlot: Ref<HTMLSlotElement> = createRef();

  protected _baseStyle?: string;
  protected _hoverStyle?: string;

  protected _styleInfoToString(styleInfo: StyleInfo): string {
    // styleMap() cannot be used directly as it raises an exception if it's not
    // used on the style attribute directly, so do the conversion manually:
    // Inspired by lit-html:
    // https://github.com/lit/lit/blob/main/packages/lit-html/src/directives/style-map.ts#L45
    return Object.keys(styleInfo).reduce((style, prop) => {
      const value: string | null | undefined = styleInfo[prop]
        ?.trim();
      if (value === null || value === undefined) {
        return style;
      }
      prop = prop.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g, '-$&').toLowerCase();
      return style + `${prop}:${value};`;
    }, '');
  }

  /**
   * Called before each update.
   */
  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('baseStyle')) {
      this._baseStyle = this._styleInfoToString(this.baseStyle ?? {});
    }
    if (changedProps.has('baseStyle') || changedProps.has('hoverStyle')) {
      const mergedHoverStyle = {};
      merge(mergedHoverStyle, this.baseStyle ?? {}, this.hoverStyle ?? {});
      this._hoverStyle = this._styleInfoToString(mergedHoverStyle);
    }
  }

  /**
   * Called before each update.
   */
  protected updated(): void {
    this._applyStyle(false);
  }

  /**
   * Apply the relevant styles.
   * @param hover Whether to apply the hover style.
   */
  protected _applyStyle(hover: boolean): void {
    const slottedElements = this._refSlot.value?.assignedElements({ flatten: true });
    if (!slottedElements) {
      return;
    }

    let targetElements: Element[] = [];
    if (this.selector) {
      for (const slottedElement of slottedElements) {
        targetElements.push(...slottedElement.querySelectorAll(this.selector));
      }
    } else {
      targetElements = slottedElements;
    }

    targetElements.forEach((element) => {
      element.setAttribute('style', (hover ? this._hoverStyle : this._baseStyle) ?? '');
    });
  }

  public render(): TemplateResult {
    return html` <slot
      ${ref(this._refSlot)}
      @mouseover=${() => this._applyStyle(true)}
      @mouseout=${() => this._applyStyle(false)}
      @slotchange=${() => this._applyStyle(false)}
    >
    </slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-hover-styler': FrigateCardHoverStyle;
  }
}
