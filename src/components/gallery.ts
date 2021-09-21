/* eslint-disable @typescript-eslint/no-explicit-any */
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators';
import { until } from 'lit/directives/until.js';
import { HomeAssistant } from 'custom-card-helpers';

import type {
  BrowseMediaSource,
  BrowseMediaQueryParameters,
  ExtendedHomeAssistant,
} from '../types';

import { View } from '../view';
import { browseMedia, browseMediaQuery, getFirstTrueMediaChildIndex } from '../common';
import { localize } from '../localize/localize';
import { renderMessage, renderErrorMessage, renderProgressIndicator } from './message';

import galleryStyle from '../scss/gallery.scss';

@customElement('frigate-card-gallery')
export class FrigateCardGallery extends LitElement {
  @property({ attribute: false })
  protected hass!: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view!: View;

  @property({ attribute: false })
  protected browseMediaQueryParameters!: BrowseMediaQueryParameters;

  protected _getMediaType(): 'clips' | 'snapshots' {
    return this.view?.view == 'clips' ? 'clips' : 'snapshots';
  }

  protected render(): TemplateResult | void {
    return html`${until(this._render(), renderProgressIndicator())}`;
  }

  protected async _render(): Promise<TemplateResult> {
    let parent: BrowseMediaSource | null;
    try {
      if (this.view.target) {
        parent = await browseMedia(this.hass, this.view.target.media_content_id);
      } else {
        parent = await browseMediaQuery(this.hass, this.browseMediaQueryParameters);
      }
    } catch (e: any) {
      return renderErrorMessage(e.message);
    }

    if (!parent || !parent.children || getFirstTrueMediaChildIndex(parent) == null) {
      return renderMessage(
        this._getMediaType() == 'clips'
          ? localize('common.no_clips')
          : localize('common.no_snapshots'),
        this._getMediaType() == 'clips' ? 'mdi:filmstrip-off' : 'mdi:camera-off',
      );
    }

    return html` <ul class="mdc-image-list frigate-card-gallery">
      ${this.view && this.view.previous
        ? html`<li class="mdc-image-list__item">
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
          html` <li class="mdc-image-list__item">
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
