/* eslint-disable @typescript-eslint/no-explicit-any */
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import {
  CameraConfig,
  ExtendedHomeAssistant,
  GalleryConfig,
  THUMBNAIL_WIDTH_MAX,
  frigateCardConfigDefaults,
} from '../types.js';
import { BrowseMediaUtil } from '../browse-media-util.js';
import { View } from '../view.js';
import { localize } from '../localize/localize.js';
import { renderProgressIndicator } from './message.js';
import { stopEventFromActivatingCardWideActions } from '../common.js';

import galleryStyle from '../scss/gallery.scss';

@customElement('frigate-card-gallery')
export class FrigateCardGallery extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected cameraConfig?: CameraConfig;

  @property({ attribute: false })
  protected galleryConfig?: GalleryConfig;

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.view || !this.cameraConfig || !this.view.isGalleryView()) {
      return;
    }

    if (!this.view.target) {
      const browseMediaQueryParameters = BrowseMediaUtil.setMediaTypeFromView(
        BrowseMediaUtil.getBrowseMediaQueryParametersBaseOrDispatchError(
          this,
          this.cameraConfig,
        ),
        this.view,
      );
      if (!browseMediaQueryParameters) {
        return;
      }

      BrowseMediaUtil.fetchLatestMediaAndDispatchViewChange(
        this,
        this.hass,
        this.view,
        browseMediaQueryParameters,
      );
      return renderProgressIndicator();
    }

    return html`
      <frigate-card-gallery-core
        .hass=${this.hass}
        .view=${this.view}
        .galleryConfig=${this.galleryConfig}
      >
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

  @property({ attribute: false })
  protected galleryConfig?: GalleryConfig;

  protected _resizeObserver: ResizeObserver;

  @state()
  protected _columns = frigateCardConfigDefaults.event_gallery.min_columns;

  constructor() {
    super();
    this._resizeObserver = new ResizeObserver(this._resizeHandler.bind(this));
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    this._resizeObserver.observe(this);
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    this._resizeObserver.disconnect();
    super.disconnectedCallback();
  }

  /**
   * Handle gallery resize.
   */
  protected _resizeHandler(): void {
    this._columns = Math.max(
      this.galleryConfig?.min_columns ??
        frigateCardConfigDefaults.event_gallery.min_columns,
      Math.ceil(this.clientWidth / THUMBNAIL_WIDTH_MAX),
    );
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
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

    const itemStyle = {
      // Controls the number of columns in the gallery (allows for 5px gutter).
      width: `calc(${100 / this._columns}% - 5.25px)`,
    };

    const folderStyle = {
      // Values derived from experimentation on typical Lovelace card sizes.
      'font-size': `${Math.min(
        1.1,
        (0.6 * (this.clientWidth / this._columns)) / 50.0,
      )}em`,
    };

    return html` <ul class="mdc-image-list frigate-card-gallery">
      ${this.view && this.view.previous
        ? html`<li class="mdc-image-list__item" style="${styleMap(itemStyle)}">
            <div class="mdc-image-list__image-aspect-container">
              <div class="mdc-image-list__image">
                <ha-card
                  @click=${(ev) => {
                    if (this.view && this.view.previous) {
                      this.view.previous.dispatchChangeEvent(this);
                    }
                    stopEventFromActivatingCardWideActions(ev);
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
          html` <li class="mdc-image-list__item" style="${styleMap(itemStyle)}">
            <div class="mdc-image-list__image-aspect-container">
              ${child.can_expand
                ? html`<div class="mdc-image-list__image">
                    <ha-card
                      @click=${(ev) => {
                        if (this.hass && this.view) {
                          BrowseMediaUtil.fetchChildMediaAndDispatchViewChange(
                            this,
                            this.hass,
                            this.view,
                            child,
                          );
                        }
                        stopEventFromActivatingCardWideActions(ev);
                      }}
                      outlined=""
                      class="frigate-card-gallery-folder"
                    >
                      <div style="${styleMap(folderStyle)}">${child.title}</div>
                    </ha-card>
                  </div>`
                : child.thumbnail
                ? html`<img
                      aria-label="${child.title}"
                      class="mdc-image-list__image"
                      src="${child.thumbnail}"
                      title="${child.title}"
                      @click=${(ev: Event) => {
                        if (this.view) {
                          this.view
                            .evolve({
                              view: this.view.is('clips') ? 'clip' : 'snapshot',
                              childIndex: index,
                            })
                            .dispatchChangeEvent(this);
                        }
                        stopEventFromActivatingCardWideActions(ev);
                      }}
                    />${child.frigate?.event?.retain_indefinitely
                      ? html`<ha-icon
                          class="favorite"
                          icon="mdi:star"
                          title=${localize('thumbnail.retain_indefinitely')}
                        />`
                      : ``}`
                : ``}
            </div>
          </li>`,
      )}
    </ul>`;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(galleryStyle);
  }
}
