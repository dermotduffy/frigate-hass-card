/* eslint-disable @typescript-eslint/no-explicit-any */
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import type { BrowseMediaQueryParameters, ExtendedHomeAssistant } from '../types.js';
import { BrowseMediaUtil } from '../browse-media-util.js';
import { View } from '../view.js';
import { renderProgressIndicator } from './message.js';

import galleryStyle from '../scss/gallery.scss';

const MAX_THUMBNAIL_WIDTH = 175;
const DEFAULT_COLUMNS = 5;

@customElement('frigate-card-gallery')
export class FrigateCardGallery extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected browseMediaQueryParameters?: BrowseMediaQueryParameters;

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.view || !this.browseMediaQueryParameters) {
      return;
    }

    if (!this.view.target) {
      BrowseMediaUtil.fetchLatestMediaAndDispatchViewChange(
        this,
        this.hass,
        this.view,
        this.browseMediaQueryParameters,
      );
      return renderProgressIndicator();
    }

    return html`
      <frigate-card-gallery-core .hass=${this.hass} .view=${this.view}>
      </frigate-card-gallery-core>
    `;
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(galleryStyle);
  }
}

@customElement('frigate-card-gallery-core')
export class FrigateCardGalleryCore extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  protected _resizeObserver: ResizeObserver;

  @state()
  protected _columns = DEFAULT_COLUMNS;

  constructor() {
    super();
    this._resizeObserver = new ResizeObserver(this._resizeHandler.bind(this));
  }

  connectedCallback(): void {
    super.connectedCallback();
    this._resizeObserver?.observe(this);
  }

  disconnectedCallback(): void {
    this._resizeObserver.disconnect();
    super.disconnectedCallback();
  }

  protected _resizeHandler(): void {
    this._columns = Math.max(
      DEFAULT_COLUMNS,
      Math.ceil(this.clientWidth / MAX_THUMBNAIL_WIDTH),
    );
  }

  protected render(): TemplateResult | void {
    if (
      !this.hass ||
      !this.view ||
      !this.view.target ||
      !this.view.target.children ||
      !(this.view.is('clips') || this.view.is('snapshots'))
    ) {
      return html``;
    }

    const styles = {
      // Controls the number of columns in the gallery (allows for 5px gutter).
      width: `calc(${100 / this._columns}% - 5.25px)`,
    };

    return html` <ul class="mdc-image-list frigate-card-gallery">
      ${this.view && this.view.previous
        ? html`<li class="mdc-image-list__item" style="${styleMap(styles)}">
            <div class="mdc-image-list__image-aspect-container">
              <div class="mdc-image-list__image">
                <ha-card
                  @click=${() => {
                    if (this.view && this.view.previous) {
                      this.view.previous.dispatchChangeEvent(this);
                    }
                  }}
                  outlined=""
                  class="frigate-card-gallery-folder"
                >
                  <ha-icon .icon=${'mdi:arrow-left'}></ha-icon>
                </ha-card>
              </div>
            </div>
          </li>`
        : ''}
      ${this.view.target.children.map(
        (child, index) =>
          html` <li class="mdc-image-list__item" style="${styleMap(styles)}">
            <div class="mdc-image-list__image-aspect-container">
              ${child.can_expand
                ? html`<div class="mdc-image-list__image">
                    <ha-card
                      @click=${() => {
                        if (this.hass && this.view) {
                          BrowseMediaUtil.fetchChildMediaAndDispatchViewChange(
                            this,
                            this.hass,
                            this.view,
                            child,
                          );
                        }
                      }}
                      outlined=""
                      class="frigate-card-gallery-folder"
                    >
                      <div>${child.title}</div>
                    </ha-card>
                  </div>`
                : child.thumbnail
                ? html`<img
                    title="${child.title}"
                    class="mdc-image-list__image"
                    src="${child.thumbnail}"
                    @click=${() => {
                      if (this.view) {
                        this.view
                          .evolve({
                            view: this.view.is('clips') ? 'clip' : 'snapshot',
                            childIndex: index,
                            previous: this.view,
                          })
                          .dispatchChangeEvent(this);
                      }
                    }}
                  />`
                : ``}
            </div>
          </li>`,
      )}
    </ul>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(galleryStyle);
  }
}
