import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { NextPreviousControlConfig } from '../types.js';

import controlStyle from '../scss/next-previous-control.scss';
import { createFetchThumbnailTask } from '../utils/thumbnail.js';
import { HomeAssistant } from 'custom-card-helpers';
import { renderTask } from '../utils/task.js';

@customElement('frigate-card-next-previous-control')
export class FrigateCardNextPreviousControl extends LitElement {
  @property({ attribute: false })
  public direction?: 'next' | 'previous';

  set controlConfig(controlConfig: NextPreviousControlConfig | undefined) {
    if (controlConfig?.size) {
      this.style.setProperty('--frigate-card-next-prev-size', `${controlConfig.size}px`);
    }
    this._controlConfig = controlConfig;
  }

  @property({ attribute: false })
  public hass?: HomeAssistant;

  @state()
  protected _controlConfig?: NextPreviousControlConfig;

  @property({ attribute: false })
  public thumbnail?: string;

  @property({ attribute: false })
  public icon?: string;

  @property({ attribute: true, type: Boolean })
  public disabled = false;

  // Label that is used for ARIA support and as tooltip.
  @property() label = '';

  protected _embedThumbnailTask = createFetchThumbnailTask(
    this,
    () => this.hass,
    () => this.thumbnail,
  );

  protected render(): TemplateResult {
    if (this.disabled || !this._controlConfig || this._controlConfig.style == 'none') {
      return html``;
    }

    const classes = {
      controls: true,
      previous: this.direction === 'previous',
      next: this.direction === 'next',
      thumbnails: this._controlConfig.style === 'thumbnails',
      icons: ['chevrons', 'icons'].includes(this._controlConfig.style),
      button: ['chevrons', 'icons'].includes(this._controlConfig.style),
    };

    if (['chevrons', 'icons'].includes(this._controlConfig.style)) {
      let icon: string;
      if (this._controlConfig.style === 'chevrons') {
        icon = this.direction === 'previous' ? 'mdi:chevron-left' : 'mdi:chevron-right';
      } else {
        if (!this.icon) {
          return html``;
        }
        icon = this.icon;
      }

      return html` <ha-icon-button class="${classMap(classes)}" .label=${this.label}>
        <ha-icon icon=${icon}></ha-icon>
      </ha-icon-button>`;
    }

    if (!this.thumbnail) {
      return html``;
    }

    return renderTask(
      this,
      this._embedThumbnailTask,
      (embeddedThumbnail: string | null) =>
        embeddedThumbnail
          ? html`<img
              src="${embeddedThumbnail}"
              class="${classMap(classes)}"
              title="${this.label}"
              aria-label="${this.label}"
            />`
          : html``,
      { inProgressFunc: () => html`<div class=${classMap(classes)}></div>` },
    );
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(controlStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-next-previous-control': FrigateCardNextPreviousControl;
  }
}
