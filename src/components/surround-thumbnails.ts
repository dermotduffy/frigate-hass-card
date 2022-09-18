import './surround.js';
import './timeline';

import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';

import surroundThumbnailsStyle from '../scss/surround.scss';
import {
  BrowseMediaQueryParameters,
  CameraConfig,
  ExtendedHomeAssistant,
  FrigateBrowseMediaSource,
  FrigateCardError,
  MiniTimelineControlConfig,
  ThumbnailsControlConfig,
} from '../types.js';
import { contentsChanged, dispatchFrigateCardEvent } from '../utils/basic.js';
import {
  getFirstTrueMediaChildIndex,
  multipleBrowseMediaQueryMerged,
} from '../utils/ha/browse-media';
import { TimelineDataManager } from '../utils/timeline-data-manager';
import { View } from '../view.js';
import { dispatchFrigateCardErrorEvent } from './message.js';
import { ThumbnailCarouselTap } from './thumbnail-carousel.js';

interface ThumbnailViewContext {
  // Whetherr or not to fetch thumbnails.
  fetch?: boolean;
}

declare module 'view' {
  interface ViewContext {
    thumbnails?: ThumbnailViewContext;
  }
}

@customElement('frigate-card-surround-thumbnails')
export class FrigateCardSurround extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false, hasChanged: contentsChanged })
  public thumbnailConfig?: ThumbnailsControlConfig;

  @property({ attribute: false, hasChanged: contentsChanged })
  public timelineConfig?: MiniTimelineControlConfig;

  @property({ attribute: false })
  public inBackground?: boolean;

  @property({ attribute: false, hasChanged: contentsChanged })
  public browseMediaParams?: BrowseMediaQueryParameters | BrowseMediaQueryParameters[];

  @property({ attribute: false })
  public cameras?: Map<string, CameraConfig>;

  @property({ attribute: false })
  public timelineDataManager?: TimelineDataManager;

  /**
   * Fetch thumbnail media when a target is not specified in the view (e.g. for
   * the live view).
   * @param param Task parameters.
   * @returns
   */
  protected async _fetchMedia(): Promise<void> {
    if (
      this.inBackground ||
      !this.hass ||
      !this.view ||
      !this.thumbnailConfig ||
      this.thumbnailConfig.mode === 'none' ||
      this.view.target ||
      !this.browseMediaParams ||
      !(this.view.context?.thumbnails?.fetch ?? true)
    ) {
      return;
    }
    let parent: FrigateBrowseMediaSource | null;
    try {
      parent = await multipleBrowseMediaQueryMerged(this.hass, this.browseMediaParams);
    } catch (e) {
      return dispatchFrigateCardErrorEvent(this, e as FrigateCardError);
    }
    if (getFirstTrueMediaChildIndex(parent) !== null) {
      this.view
        ?.evolve({
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
    return (
      !!this.thumbnailConfig && ['left', 'right'].includes(this.thumbnailConfig.mode)
    );
  }

  /**
   * Called before each update.
   */
  protected willUpdate(changedProperties: PropertyValues): void {
    // Once the component will certainly update, dispatch a media request. Only
    // do so if properties relevant to the request have changed (as per their
    // hasChanged).
    if (
      ['view', 'fetch', 'browseMediaParams', 'inBackground'].some((prop) =>
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
    if (!this.hass || !this.view || !this.thumbnailConfig) {
      return;
    }

    const changeDrawer = (ev: CustomEvent, action: 'open' | 'close') => {
      // The event catch/re-dispatch below protect encapsulation: Catches the
      // request to view thumbnails and re-dispatches a request to open the drawer
      // (if the thumbnails are in a drawer). The new event needs to be dispatched
      // from the origin of the inbound event, so it can be handled by
      // <frigate-card-surround> .
      if (this.thumbnailConfig && this._hasDrawer()) {
        dispatchFrigateCardEvent(ev.composedPath()[0], 'drawer:' + action, {
          drawer: this.thumbnailConfig.mode,
        });
      }
    };

    return html` <frigate-card-surround
      @frigate-card:thumbnails:open=${(ev: CustomEvent) => changeDrawer(ev, 'open')}
      @frigate-card:thumbnails:close=${(ev: CustomEvent) => changeDrawer(ev, 'close')}
    >
      ${this.thumbnailConfig &&
      this.thumbnailConfig.mode !== 'none' &&
      !this.inBackground
        ? html` <frigate-card-thumbnail-carousel
            slot=${this.thumbnailConfig.mode}
            .hass=${this.hass}
            .config=${this.thumbnailConfig}
            .view=${this.view}
            .target=${this.view.target}
            .selected=${this.view.childIndex}
            .cameras=${this.cameras}
            @frigate-card:view:change=${(ev: CustomEvent) => changeDrawer(ev, 'close')}
            @frigate-card:thumbnail-carousel:tap=${(
              ev: CustomEvent<ThumbnailCarouselTap>,
            ) => {
              const child: FrigateBrowseMediaSource | null =
                ev.detail.target?.children?.[ev.detail.childIndex] ?? null;
              // Send the view change from the source of the tap event, so the
              // view change will be caught by the handler above (to close the drawer).
              if (child) {
                this.view
                  ?.evolve({
                    view: this.view.is('recording') ? 'recording' : 'media',
                    target: ev.detail.target,
                    childIndex: ev.detail.childIndex,
                    context: null,
                    ...(child?.frigate?.cameraID && {
                      camera: child?.frigate?.cameraID,
                    }),
                  })
                  .dispatchChangeEvent(ev.composedPath()[0]);
              }
            }}
          >
          </frigate-card-thumbnail-carousel>`
        : ''}
      ${this.timelineConfig && !this.inBackground
        ? html` <frigate-card-timeline-core
            slot=${this.timelineConfig.mode}
            .hass=${this.hass}
            .view=${this.view}
            .cameras=${this.cameras}
            .mini=${true}
            .timelineConfig=${this.timelineConfig}
            .thumbnailDetails=${this.thumbnailConfig?.show_details}
            .thumbnailSize=${this.thumbnailConfig?.size}
            .timelineDataManager=${this.timelineDataManager}
          >
          </frigate-card-timeline-core>`
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

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-surround-thumbnails': FrigateCardSurround;
  }
}
