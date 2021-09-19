/* eslint-disable @typescript-eslint/no-explicit-any */
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators';
import { until } from 'lit/directives/until.js';

import { renderMessage, renderErrorMessage, renderProgressIndicator } from './message';

import { HomeAssistant } from 'custom-card-helpers';

import galleryStyle from '../scss/gallery.scss';

import type { ExtendedHomeAssistant } from '../types';
import { localize } from '../localize/localize';

import { browseMedia, browseMediaQuery, getFirstTrueMediaChildIndex } from '../common';
import { View } from '../view';

@customElement('frigate-card-gallery')
export class FrigateCardGallery extends LitElement {
  @property({ attribute: false })
  protected hass: (HomeAssistant & ExtendedHomeAssistant) | null = null;

  @property({ attribute: false })
  protected cameraName: string | null = null;

  @property({ attribute: false })
  protected clientId: string | null = null;

  @property({ attribute: false })
  protected view: View | null = null;

  @property({ attribute: false })
  protected label?: string;

  @property({ attribute: false })
  protected zone?: string;

  protected _getMediaType(): 'clips' | 'snapshots' {
    return this.view?.view == 'clips' ? 'clips' : 'snapshots';
  }

  protected render(): TemplateResult | void {
    return html`${until(this._renderEvents(), renderProgressIndicator())}`;
  }

  protected async _renderEvents(): Promise<TemplateResult> {
    if (!this.hass || !this.clientId || !this.cameraName || !this.view) {
      return renderErrorMessage(localize('error.internal'));
    }

    let parent;
    try {
      if (this.view.target) {
        parent = await browseMedia(this.hass, this.view.target.media_content_id);
      } else {
        parent = await browseMediaQuery({
          hass: this.hass,
          clientId: this.clientId,
          mediaType: this._getMediaType(),
          cameraName: this.cameraName,
          label: this.label,
          zone: this.zone,
        });
      }
    } catch (e: any) {
      return renderErrorMessage(e.message);
    }

    if (getFirstTrueMediaChildIndex(parent) == null) {
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
                      this.view.previous.generateChangeEvent(this);
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
                        }).generateChangeEvent(this);
                      }}
                      outlined=""
                      class="frigate-card-gallery-folder"
                    >
                      <div>${child.title}</div>
                    </ha-card>
                  </div>`
                : html`<img
                    title="${child.title}"
                    class="mdc-image-list__image"
                    src="${child.thumbnail}"
                    @click=${() => {
                      new View({
                        view: this._getMediaType() == 'clips' ? 'clip' : 'snapshot',
                        target: parent,
                        childIndex: index,
                        previous: this.view ?? undefined,
                      }).generateChangeEvent(this);
                    }}
                  />`}
            </div>
          </li>`,
      )}
    </ul>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(galleryStyle);
  }
}
