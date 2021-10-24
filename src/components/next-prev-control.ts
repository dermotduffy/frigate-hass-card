import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { BrowseMediaSource, NextPreviousControlStyle } from '../types.js';

import { View } from '../view.js';

import controlStyle from '../scss/next-previous-control.scss';

@customElement('frigate-card-next-previous-control')
export class FrigateCardMessage extends LitElement {
  @property({ attribute: false })
  protected control!: "next" | "previous";

  @property({ attribute: false })
  protected controlStyle!: NextPreviousControlStyle;
  
  @property({ attribute: false })
  protected parent!: BrowseMediaSource;

  @property({ attribute: false })
  protected childIndex!: number;

  @property({ attribute: false })
  protected view!: View;

  protected _changeView(): void {
    new View({
      view: this.view.view,
      target: this.parent,
      childIndex: this.childIndex,
    }).dispatchChangeEvent(this);
  }

  protected render() : TemplateResult {
    if (this.controlStyle == 'none' || !this.parent.children) {
      return html``;
    }
    const target = this.parent.children[this.childIndex];
    if (!target) {
      return html``;
    }

    const classes = {
      controls: true,
      previous: this.control == "previous",
      next: this.control == "next",
      thumbnails: this.controlStyle == "thumbnails",
      chevrons: this.controlStyle == "chevrons",
      button: this.controlStyle == "chevrons",
    };

    if (this.controlStyle == "chevrons") {
      return html` <ha-icon-button
        icon=${this.control == "previous" ? 'mdi:chevron-left' : 'mdi:chevron-right'}
        class="${classMap(classes)}"
        title=${target.title}
        @click=${this._changeView}
      ></ha-icon-button>`;
    }

    if (!target.thumbnail) {
      return html``;
    }
    return html`<img
      src="${target.thumbnail}"
      class="${classMap(classes)}"
      title="${target.title}"
      @click=${this._changeView}
    />`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(controlStyle);
  }
}