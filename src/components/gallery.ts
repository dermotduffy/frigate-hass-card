/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CSSResultGroup,
  LitElement,
  PropertyValues,
  TemplateResult,
  css,
  html,
  unsafeCSS,
} from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { customElement, property } from 'lit/decorators.js';

import {
  CameraConfig,
  ExtendedHomeAssistant,
  GalleryConfig,
  frigateCardConfigDefaults,
} from '../types.js';
import { BrowseMediaUtil } from '../browse-media-util.js';
import { View } from '../view.js';
import { THUMBNAIL_DETAILS_WIDTH_MIN } from './thumbnail.js';
import { renderProgressIndicator } from './message.js';
import { stopEventFromActivatingCardWideActions } from '../common.js';

import './thumbnail.js';

import galleryStyle from '../scss/gallery.scss';

@customElement('frigate-card-gallery')
export class FrigateCardGallery extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant;

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
    return css`
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
    `;
  }
}

@customElement('frigate-card-gallery-core')
export class FrigateCardGalleryCore extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected galleryConfig?: GalleryConfig;

  protected _resizeObserver: ResizeObserver;

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
    const thumbnailSize =
      this.galleryConfig?.controls.thumbnails.size ??
      frigateCardConfigDefaults.event_gallery.controls.thumbnails.size;
    this.style.setProperty(
      '--frigate-card-gallery-columns',
      String(
        !this.galleryConfig?.controls.thumbnails.show_details
          ? Math.round(this.clientWidth / thumbnailSize)
          : Math.max(1, Math.floor(this.clientWidth / THUMBNAIL_DETAILS_WIDTH_MIN)),
      ),
    );
  }

  /**
   * Determine whether the back arrow should be displayed.
   * @returns `true` if the back arrow should be displayed, `false` otherwise.
   */
  protected _showBackArrow(): boolean {
    return (
      !!this.view?.previous &&
      !!this.view.previous.target &&
      this.view.previous.view === this.view.view
    );
  }

  /**
   * Called when an update will occur.
   * @param changedProps The changed properties
   */
  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('galleryConfig')) {
      if (this.galleryConfig?.controls.thumbnails.show_details) {
        this.setAttribute('details', '');
      } else {
        this.removeAttribute('details');
      }
      if (this.galleryConfig?.controls.thumbnails.size) {
        this.style.setProperty(
          '--frigate-card-thumbnail-size',
          `${this.galleryConfig.controls.thumbnails.size}px`,
        );
      }
    }
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

    return html`
      ${this._showBackArrow()
        ? html` <ha-card
            @click=${(ev) => {
              if (this.view && this.view.previous) {
                this.view.previous.dispatchChangeEvent(this);
              }
              stopEventFromActivatingCardWideActions(ev);
            }}
            outlined=""
          >
            <ha-icon .icon=${'mdi:arrow-left'}></ha-icon>
          </ha-card>`
        : ''}
      ${this.view.target.children.map(
        (child, index) =>
          html`
            ${child.can_expand
              ? html`
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
                    class="foo"
                  >
                    <div>${child.title}</div>
                  </ha-card>
                `
              : child.thumbnail
              ? html`<frigate-card-thumbnail
                  .view=${this.view}
                  .target=${this.view?.target ?? null}
                  .childIndex=${index}
                  ?details=${!!this.galleryConfig?.controls.thumbnails.show_details}
                  ?controls=${!!this.galleryConfig?.controls.thumbnails.show_controls}
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
                >
                </frigate-card-thumbnail>`
              : ``}
          `,
      )}
    `;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(galleryStyle);
  }
}
