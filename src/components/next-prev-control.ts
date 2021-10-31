import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { NextPreviousControlStyle } from '../types.js';

import controlStyle from '../scss/next-previous-control.scss';

@customElement('frigate-card-next-previous-control')
export class FrigateCardMessage extends LitElement {
  @property({ attribute: false })
  protected direction?: 'next' | 'previous';

  @property({ attribute: false })
  protected controlStyle?: NextPreviousControlStyle;

  @property({ attribute: false })
  protected thumbnail?: string;

  @property({ attribute: false })
  set controlSize(controlSize: string | undefined) {
    if (controlSize) {
      this.style.setProperty('--frigate-card-next-prev-size', controlSize);
    }
  }

  protected render(): TemplateResult {
    if (!this.controlStyle || this.controlStyle == 'none') {
      return html``;
    }

    const classes = {
      controls: true,
      previous: this.direction == 'previous',
      next: this.direction == 'next',
      thumbnails: this.controlStyle == 'thumbnails',
      chevrons: this.controlStyle == 'chevrons',
      button: this.controlStyle == 'chevrons',
    };

    if (this.controlStyle == 'chevrons') {
      const icon = this.direction == 'previous' ? 'mdi:chevron-left' : 'mdi:chevron-right';

      // TODO: Upon a safe distance from the release of HA 2021.11 these
      // attributes can be removed from the <ha-icon-button>.
      // - icon (replaced with the embedded <ha-icon>)
      // - title (replaced with .label)
      return html` <ha-icon-button
        icon=${icon}
        class="${classMap(classes)}"
        .label=${this.title}
        title=${this.title}
      >
        <ha-icon icon=${icon}></ha-icon>
      </ha-icon-button>`;
    }

    if (!this.thumbnail) {
      return html``;
    }
    return html`<img
      src="${this.thumbnail}"
      class="${classMap(classes)}"
      title="${this.title}"
    />`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(controlStyle);
  }
}
