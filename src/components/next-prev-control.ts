import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { NextPreviousControlConfig } from '../config/types.js';
import controlStyle from '../scss/next-previous-control.scss';
import { renderTask } from '../utils/task.js';
import { createFetchThumbnailTask } from '../utils/thumbnail.js';

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

    const renderIcon =
      !this.thumbnail || ['chevrons', 'icons'].includes(this._controlConfig.style);

    const classes = {
      controls: true,
      left: this.direction === 'previous',
      right: this.direction === 'next',
      thumbnails: !renderIcon,
      icons: renderIcon,
      button: renderIcon,
    };

    if (renderIcon) {
      const icon =
        !this.thumbnail || !this.icon || this._controlConfig.style === 'chevrons'
          ? this.direction === 'previous'
            ? 'mdi:chevron-left'
            : 'mdi:chevron-right'
          : this.icon;

      return html` <ha-icon-button class="${classMap(classes)}" .label=${this.label}>
        <ha-icon icon=${icon}></ha-icon>
      </ha-icon-button>`;
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
