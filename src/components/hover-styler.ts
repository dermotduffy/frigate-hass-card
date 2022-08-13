import { html, LitElement, TemplateResult } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { StyleInfo } from 'lit/directives/style-map.js';

// This component exists to allow user-provided styles to applied dynamically on
// hover (inline styling does not support hover by default, so this component
// attempts to mimic it).

@customElement('frigate-card-hover-styler')
export class FrigateCardHoverStyle extends LitElement {
  @property({ attribute: false })
  public nonHoverStyle?: StyleInfo;

  @property({ attribute: false })
  public hoverStyle?: StyleInfo;

  protected _styleInfoToString(styleInfo: StyleInfo): string {
    // StyleMap() cannot be used directly as it raises an exception if it's not
    // used on the style attribute directly, so do the conversion manually:
    // Inspired by lit-html:
    // https://github.com/lit/lit/blob/main/packages/lit-html/src/directives/style-map.ts#L45
    return Object.keys(styleInfo).reduce((style, prop) => {
      const value: string | null | undefined = styleInfo[prop]
        ?.trim()
        .replace(/;+$/, '');
      if (value === null || value === undefined) {
        return style;
      }
      prop = prop.replace(/(?:^(webkit|moz|ms|o)|)(?=[A-Z])/g, '-$&').toLowerCase();

      // All styles need to be mandatorily applied in order to have the same or
      // greater precedence as inline styling on the element which this
      // component is intended as a replacement for.
      const alreadyImportant = value.endsWith('!important');
      return style + `${prop}:${value} ${alreadyImportant ? '' : '!important'};`;
    }, '');
  }

  public render(): TemplateResult {
    // This is not especially performant. See:
    // https://lit.dev/docs/components/styles/#style-element
    return html` <style>
        ::slotted(*) { ${this._styleInfoToString(this.nonHoverStyle ?? {})} }
        ::slotted(*:hover) { ${this._styleInfoToString(this.hoverStyle ?? {})} }
      </style>
      <slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-hover-styler': FrigateCardHoverStyle;
  }
}
