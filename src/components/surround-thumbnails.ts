import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { Task } from '@lit-labs/task';
import { customElement, property, state } from 'lit/decorators.js';

import { BrowseMediaUtil } from '../browse-media-util.js';
import {
  BrowseMediaQueryParameters,
  ExtendedHomeAssistant,
  FrigateBrowseMediaSource,
  FrigateCardView,
  ThumbnailsControlConfig,
} from '../types.js';

import { ThumbnailCarouselTap } from './thumbnail-carousel.js';
import { View } from '../view.js';
import { dispatchErrorMessageEvent, dispatchFrigateCardEvent } from '../common.js';

import './surround.js';

import surroundThumbnailsStyle from '../scss/surround.scss';

interface FrigateCardThumbnailsSet {
  target?: FrigateBrowseMediaSource;
  childIndex?: number;
}

@customElement('frigate-card-surround-thumbnails')
export class FrigateCardSurround extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected config?: ThumbnailsControlConfig;

  @property({ attribute: false })
  protected targetView?: FrigateCardView;

  @property({ attribute: false })
  protected browseMediaParams?: BrowseMediaQueryParameters;

  @state()
  protected _thumbnailTarget?: FrigateBrowseMediaSource;

  @state()
  protected _thumbnailSelected?: number | null;

  // A task to await the load of the WebRTC component.
  protected _browseTask = new Task(this, this._fetchMedia.bind(this), () => [
    this.hass,
    this.browseMediaParams,
  ]);

  /**
   * Fetch thumbnail media.
   * @param param Task parameters.
   * @returns
   */
  protected async _fetchMedia([hass, browseMediaParams]: (
    | (HomeAssistant & ExtendedHomeAssistant)
    | BrowseMediaQueryParameters
    | undefined
  )[]): Promise<void> {
    hass = hass as HomeAssistant & ExtendedHomeAssistant;
    browseMediaParams = browseMediaParams as BrowseMediaQueryParameters;

    if (!hass || !browseMediaParams) {
      return;
    }
    let parent: FrigateBrowseMediaSource | null;
    try {
      parent = await BrowseMediaUtil.browseMediaQuery(hass, browseMediaParams);
    } catch (e) {
      return dispatchErrorMessageEvent(this, (e as Error).message);
    }
    if (BrowseMediaUtil.getFirstTrueMediaChildIndex(parent) != null) {
      this._thumbnailTarget = parent;
      this._thumbnailSelected = null;
    }
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.view || !this.config) {
      return;
    }

    return html` <frigate-card-surround
      @frigate-card:thumbnails:set=${(ev: CustomEvent<FrigateCardThumbnailsSet>) => {
        if (ev.detail.target) {
          this._thumbnailTarget = ev.detail.target;
        }
        this._thumbnailSelected = ev.detail.childIndex;
      }}
      @frigate-card:thumbnails:open=${(ev: CustomEvent) => {
        if (this.config && ['left', 'right'].includes(this.config.mode)) {
          // Protects encapsulation: Catches the request to view thumbnails and
          // re-dispatches a request to open the drawer (if the thumbnails are
          // in a drawer). The new event needs to be dispatched from the origin
          // of the inbound event, so it can be handled by
          // <frigate-card-surround> .
          dispatchFrigateCardEvent(ev.composedPath()[0], 'drawer:open', {
            drawer: this.config.mode,
          });
        }
      }}
    >
      ${this.config?.mode !== 'none'
        ? html` <frigate-card-thumbnail-carousel
            slot=${this.config.mode}
            .config=${this.config}
            .target=${this._thumbnailTarget ?? this.view.target}
            .selected=${this._thumbnailSelected ?? this.view.childIndex ?? null}
            @frigate-card:carousel:tap=${(ev: CustomEvent<ThumbnailCarouselTap>) => {
              this.view
                ?.evolve({
                  ...(this.targetView && { view: this.targetView }),
                  target: ev.detail.target,
                  childIndex: ev.detail.childIndex,
                })
                .dispatchChangeEvent(this);
            }}
          >
          </frigate-card-thumbnail-carousel>`
        : ''}
      <slot></slot>
    </frigate-card-surround>`;
  }

  /**
   * Return compiled CSS styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(surroundThumbnailsStyle);
  }
}
