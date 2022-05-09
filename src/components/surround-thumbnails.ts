import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { Task } from '@lit-labs/task';
import { customElement, property } from 'lit/decorators.js';

import { BrowseMediaUtil } from '../browse-media-util.js';
import {
  BrowseMediaQueryParameters,
  FrigateBrowseMediaSource,
  FrigateCardView,
  ThumbnailsControlConfig,
} from '../types.js';

import { ThumbnailCarouselTap } from './thumbnail-carousel.js';
import { View } from '../view.js';
import { dispatchErrorMessageEvent, dispatchFrigateCardEvent } from '../common.js';

import './surround.js';

import surroundThumbnailsStyle from '../scss/surround.scss';

@customElement('frigate-card-surround-thumbnails')
export class FrigateCardSurround extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected config?: ThumbnailsControlConfig;

  @property({ attribute: false })
  protected targetView?: FrigateCardView;

  @property({ attribute: true, type: Boolean })
  protected fetch?: boolean;

  @property({ attribute: false })
  protected browseMediaParams?:
    | BrowseMediaQueryParameters
    | BrowseMediaQueryParameters[];

  protected _browseTask = new Task(this, this._fetchMedia.bind(this), () => [
    this.view,
    this.browseMediaParams,
    this.fetch,
  ]);

  /**
   * Fetch thumbnail media when a target is not specified in the view (e.g. for
   * the live view).
   * @param param Task parameters.
   * @returns
   */
  protected async _fetchMedia([view, browseMediaParams, fetch]: (
    | Readonly<View>
    | BrowseMediaQueryParameters
    | BrowseMediaQueryParameters[]
    | boolean
    | undefined
  )[]): Promise<void> {
    view = view as Readonly<View>;
    browseMediaParams = browseMediaParams as
      | BrowseMediaQueryParameters
      | BrowseMediaQueryParameters[];
    fetch = fetch as boolean;

    if (!fetch || !this.hass || !view || view.target || !browseMediaParams) {
      return;
    }
    let parent: FrigateBrowseMediaSource | null;
    try {
      parent = await BrowseMediaUtil.multipleBrowseMediaQueryMerged(this.hass, browseMediaParams);
    } catch (e) {
      return dispatchErrorMessageEvent(this, (e as Error).message);
    }
    if (BrowseMediaUtil.getFirstTrueMediaChildIndex(parent) !== null) {
      this.view
        ?.evolve({
          ...(this.targetView && { view: this.targetView }),
          target: parent,
          childIndex: null,

          // Don't carry over history of this 'empty' view.
          previous: null,
        })
        .dispatchChangeEvent(this);
    }
  }

  /**
   * Determine if a drawer is being used.
   * @returns `true` if a drawer is used, `false` otherwise.
   */
  protected _hasDrawer(): boolean {
    return !!this.config && ['left', 'right'].includes(this.config.mode);
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.view || !this.config) {
      return;
    }

    const changeDrawer = (ev: CustomEvent, action: 'open' | 'close') => {
      // The event catch/re-dispatch below protect encapsulation: Catches the
      // request to view thumbnails and re-dispatches a request to open the drawer
      // (if the thumbnails are in a drawer). The new event needs to be dispatched
      // from the origin of the inbound event, so it can be handled by
      // <frigate-card-surround> .
      if (this.config && this._hasDrawer()) {
        dispatchFrigateCardEvent(ev.composedPath()[0], 'drawer:' + action, {
          drawer: this.config.mode,
        });
      }
    };

    return html` <frigate-card-surround
      @frigate-card:thumbnails:open=${(ev: CustomEvent) => changeDrawer(ev, 'open')}
      @frigate-card:thumbnails:close=${(ev: CustomEvent) => changeDrawer(ev, 'close')}
    >
      ${this.config?.mode !== 'none'
        ? html` <frigate-card-thumbnail-carousel
            slot=${this.config.mode}
            .config=${this.config}
            .view=${this.view}
            .target=${this.view.target}
            .selected=${this.view.childIndex}
            @frigate-card:change-view=${(ev: CustomEvent) => changeDrawer(ev, 'close')}
            @frigate-card:carousel:tap=${(ev: CustomEvent<ThumbnailCarouselTap>) => {
              this.view
                ?.evolve({
                  view: this.targetView || 'event',
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
