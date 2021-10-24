/* eslint-disable @typescript-eslint/no-explicit-any */
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';
import { HomeAssistant } from 'custom-card-helpers';

import type {
  BrowseMediaSource,
  BrowseMediaQueryParameters,
  ExtendedHomeAssistant,
} from '../types.js';

import { View } from '../view.js';
import {
  browseMedia,
  browseMediaQuery,
  dispatchErrorMessageEvent,
  dispatchMessageEvent,
  getFirstTrueMediaChildIndex,
} from '../common.js';
import { localize } from '../localize/localize.js';
import { renderProgressIndicator } from './message.js';

import galleryStyle from '../scss/gallery.scss';
import { styleMap } from 'lit/directives/style-map.js';

const MAX_THUMBNAIL_WIDTH = 175;
const DEFAULT_COLUMNS = 5;

@customElement('frigate-card-gallery')
export class FrigateCardGallery extends LitElement {
  @property({ attribute: false })
  protected hass!: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view!: View;

  @property({ attribute: false })
  protected browseMediaQueryParameters!: BrowseMediaQueryParameters;

  protected _resizeObserver: ResizeObserver;

  @state()
  protected _columns = DEFAULT_COLUMNS;

  protected _getMediaType(): 'clips' | 'snapshots' {
    return this.view?.view == 'clips' ? 'clips' : 'snapshots';
  }

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
      Math.floor(this.clientWidth / MAX_THUMBNAIL_WIDTH),
    );
  }

  protected render(): TemplateResult | void {
    return html`${until(this._render(), renderProgressIndicator())}`;
  }

  protected async _render(): Promise<TemplateResult | void> {
    let parent: BrowseMediaSource | null;
    try {
      if (this.view.target) {
        parent = await browseMedia(this.hass, this.view.target.media_content_id);
      } else {
        parent = await browseMediaQuery(this.hass, this.browseMediaQueryParameters);
      }
    } catch (e: any) {
      return dispatchErrorMessageEvent(this, e.message);
    }

    if (!parent || !parent.children || getFirstTrueMediaChildIndex(parent) == null) {
      return dispatchMessageEvent(
        this,
        this._getMediaType() == 'clips'
          ? localize('common.no_clips')
          : localize('common.no_snapshots'),
        this._getMediaType() == 'clips' ? 'mdi:filmstrip-off' : 'mdi:camera-off',
      );
    }

    const styles = {
      // Controls the number of columns in the gallery (allows for 1px gutter).
      width: `calc(${100 / this._columns}% - 1.2px)`,
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
      ${parent.children.map(
        (child, index) =>
          html` <li class="mdc-image-list__item" style="${styleMap(styles)}">
            <div class="mdc-image-list__image-aspect-container">
              ${child.can_expand
                ? html`<div class="mdc-image-list__image">
                    <ha-card
                      @click=${() => {
                        new View({
                          view: this._getMediaType(),
                          target: child,
                          previous: this.view ?? undefined,
                        }).dispatchChangeEvent(this);
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
                      new View({
                        view: this._getMediaType() == 'clips' ? 'clip' : 'snapshot',
                        target: parent ?? undefined,
                        childIndex: index,
                        previous: this.view ?? undefined,
                      }).dispatchChangeEvent(this);
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
