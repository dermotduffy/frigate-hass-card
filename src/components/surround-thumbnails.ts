import { HomeAssistant } from 'custom-card-helpers';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import surroundThumbnailsStyle from '../scss/surround.scss';
import {
  BrowseMediaQueryParameters,
  FrigateBrowseMediaSource,
  FrigateCardView,
  ThumbnailsControlConfig
} from '../types.js';
import { contentsChanged, dispatchFrigateCardEvent } from '../utils/basic.js';
import {
  getFirstTrueMediaChildIndex,
  multipleBrowseMediaQueryMerged
} from '../utils/ha/browse-media';
import { View } from '../view.js';
import { dispatchErrorMessageEvent } from './message.js';
import './surround.js';
import { ThumbnailCarouselTap } from './thumbnail-carousel.js';

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

  @property({ attribute: false, hasChanged: contentsChanged })
  protected browseMediaParams?:
    | BrowseMediaQueryParameters
    | BrowseMediaQueryParameters[];

  /**
   * Fetch thumbnail media when a target is not specified in the view (e.g. for
   * the live view).
   * @param param Task parameters.
   * @returns
   */
  protected async _fetchMedia(): Promise<void> {
    if (
      !fetch ||
      !this.hass ||
      !this.view ||
      !this.config ||
      this.config.mode === 'none' ||
      this.view.target ||
      !this.browseMediaParams
    ) {
      return;
    }
    let parent: FrigateBrowseMediaSource | null;
    try {
      parent = await multipleBrowseMediaQueryMerged(this.hass, this.browseMediaParams);
    } catch (e) {
      return dispatchErrorMessageEvent(this, (e as Error).message);
    }
    if (getFirstTrueMediaChildIndex(parent) !== null) {
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
   * Called before each update.
   */
  protected willUpdate(changedProperties: PropertyValues): void {
    // Once the component will certainly update, dispatch a media request. Only
    // do so if properties relevant to the request have changed (as per their
    // hasChanged).
    if (
      ['view', 'targetView', 'fetch', 'browseMediaParams'].some((prop) =>
        changedProperties.has(prop),
      )
    ) {
      this._fetchMedia();
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
      ${this.config && this.config.mode !== 'none'
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
