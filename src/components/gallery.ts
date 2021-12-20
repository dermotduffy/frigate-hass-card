/* eslint-disable @typescript-eslint/no-explicit-any */
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { customElement, property, state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { until } from 'lit/directives/until.js';

import type {
  BrowseMediaSource,
  BrowseMediaQueryParameters,
  ExtendedHomeAssistant,
} from '../types.js';
import { BrowseMediaUtil } from '../browse-media-util.js';
import { View } from '../view.js';
import { dispatchErrorMessageEvent, dispatchMessageEvent } from '../common.js';
import { localize } from '../localize/localize.js';
import { renderProgressIndicator } from './message.js';

import galleryStyle from '../scss/gallery.scss';
import { actionHandler } from '../action-handler-directive.js';

const MAX_THUMBNAIL_WIDTH = 175;
const DEFAULT_COLUMNS = 5;

@customElement('frigate-card-gallery')
export class FrigateCardGallery extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: View;

  @property({ attribute: false })
  protected browseMediaQueryParameters?: BrowseMediaQueryParameters;

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    return html`${until(this._render(), renderProgressIndicator())}`;
  }

  /**
   * Asyncronously render the element.
   * @returns A rendered template.
   */
  protected async _render(): Promise<TemplateResult | void> {
    if (
      !this.hass ||
      !this.view ||
      !this.browseMediaQueryParameters ||
      !(this.view.is('clips') || this.view.is('snapshots'))
    ) {
      return html``;
    }

    let parent: BrowseMediaSource | null;
    try {
      if (this.view.target) {
        parent = await BrowseMediaUtil.browseMedia(
          this.hass,
          this.view.target.media_content_id,
        );
      } else {
        parent = await BrowseMediaUtil.browseMediaQuery(
          this.hass,
          this.browseMediaQueryParameters,
        );
      }
    } catch (e: any) {
      return dispatchErrorMessageEvent(this, e.message);
    }

    if (
      !parent ||
      !parent.children ||
      BrowseMediaUtil.getFirstTrueMediaChildIndex(parent) == null
    ) {
      return dispatchMessageEvent(
        this,
        this.view.is('clips')
          ? localize('common.no_clips')
          : localize('common.no_snapshots'),
        this.view.is('clips') ? 'mdi:filmstrip-off' : 'mdi:camera-off',
      );
    }

    this.view.target = parent;

    return html` <frigate-card-gallery-core .hass=${this.hass} .view=${this.view}>
    </frigate-card-gallery-core>`;
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
  protected view?: View;

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
                  .actionHandler=${actionHandler({
                    hasHold: false,
                    hasDoubleClick: false,
                  })}
                  @action=${() => {
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
                      .actionHandler=${actionHandler({
                        hasHold: false,
                        hasDoubleClick: false,
                      })}
                      @action=${() => {
                        if (this.view) {
                          new View({
                            view: this.view.view,
                            camera: this.view.camera,
                            target: child,
                            previous: this.view ?? undefined,
                          }).dispatchChangeEvent(this);
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
                    .actionHandler=${actionHandler({
                      hasHold: false,
                      hasDoubleClick: false,
                    })}
                    @action=${() => {
                      if (this.view) {
                        new View({
                          view: this.view.is('clips')
                            ? 'clip-specific'
                            : 'snapshot-specific',
                          camera: this.view.camera,
                          target: this.view.target ?? undefined,
                          childIndex: index,
                          previous: this.view ?? undefined,
                        }).dispatchChangeEvent(this);
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
