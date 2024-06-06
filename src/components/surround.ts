import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CameraManager } from '../camera-manager/manager.js';
import {
  CardWideConfig,
  MiniTimelineControlConfig,
  ThumbnailsControlConfig,
} from '../config/types.js';
import basicBlockStyle from '../scss/basic-block.scss';
import { ExtendedHomeAssistant } from '../types.js';
import { contentsChanged, dispatchFrigateCardEvent } from '../utils/basic.js';
import { View } from '../view/view.js';
import './surround-basic.js';
import { ThumbnailCarouselTap } from './thumbnail-carousel.js';

@customElement('frigate-card-surround')
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
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected _cameraIDsForTimeline?: Set<string>;

  /**
   * Determine if a drawer is being used.
   * @returns `true` if a drawer is used, `false` otherwise.
   */
  protected _hasDrawer(): boolean {
    return (
      !!this.thumbnailConfig && ['left', 'right'].includes(this.thumbnailConfig.mode)
    );
  }

  protected willUpdate(changedProperties: PropertyValues): void {
    if (this.timelineConfig?.mode && this.timelineConfig.mode !== 'none') {
      import('./timeline-core.js');
    }

    // Only reset the timeline cameraIDs when the media or display mode
    // materially changes (and not on every view change, since the view will
    // change frequently when the user is scrubbing video).
    const oldView = changedProperties.get('view');
    if (
      changedProperties.has('view') &&
      (View.isMajorMediaChange(oldView, this.view) ||
        oldView.displayMode !== this.view?.displayMode)
    ) {
      this._cameraIDsForTimeline = this._getCameraIDsForTimeline() ?? undefined;
    }
  }

  protected _getCameraIDsForTimeline(): Set<string> | null {
    if (!this.view || !this.cameraManager) {
      return null;
    }
    if (this.view.is('live')) {
      const capabilitySearch = {
        anyCapabilities: ['clips' as const, 'snapshots' as const, 'recordings' as const],
      };
      if (this.view.supportsMultipleDisplayModes() && this.view.isGrid()) {
        return this.cameraManager
          .getStore()
          .getCameraIDsWithCapability(capabilitySearch);
      } else {
        return this.cameraManager
          .getStore()
          .getAllDependentCameras(this.view.camera, capabilitySearch);
      }
    }
    if (this.view.isViewerView()) {
      return this.view.query?.getQueryCameraIDs() ?? null;
    }
    return null;
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this.view) {
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

    return html` <frigate-card-surround-basic
      @frigate-card:thumbnails:open=${(ev: CustomEvent) => changeDrawer(ev, 'open')}
      @frigate-card:thumbnails:close=${(ev: CustomEvent) => changeDrawer(ev, 'close')}
    >
      ${this.thumbnailConfig && this.thumbnailConfig.mode !== 'none'
        ? html` <frigate-card-thumbnail-carousel
            slot=${this.thumbnailConfig.mode}
            .hass=${this.hass}
            .config=${this.thumbnailConfig}
            .cameraManager=${this.cameraManager}
            .fadeThumbnails=${this.view.isViewerView()}
            .view=${this.view}
            .selected=${this.view.queryResults?.getSelectedIndex() ?? undefined}
            @frigate-card:view:change=${(ev: CustomEvent) => changeDrawer(ev, 'close')}
            @frigate-card:thumbnail-carousel:tap=${(
              ev: CustomEvent<ThumbnailCarouselTap>,
            ) => {
              const media = ev.detail.queryResults.getSelectedResult();
              if (media) {
                this.view
                  ?.evolve({
                    view: 'media',
                    queryResults: ev.detail.queryResults,
                    ...(media.getCameraID() && { camera: media.getCameraID() }),
                  })
                  .removeContext('timeline')
                  .removeContext('mediaViewer')
                  // Send the view change from the source of the tap event, so
                  // the view change will be caught by the handler above (to
                  // close the drawer).
                  .dispatchChangeEvent(ev.composedPath()[0]);
              }
            }}
          >
          </frigate-card-thumbnail-carousel>`
        : ''}
      ${this.timelineConfig && this.timelineConfig.mode !== 'none'
        ? html` <frigate-card-timeline-core
            slot=${this.timelineConfig.mode}
            .hass=${this.hass}
            .view=${this.view}
            .itemClickAction=${this.view.isViewerView() ||
            !this.thumbnailConfig ||
            this.thumbnailConfig?.mode === 'none'
              ? 'play'
              : 'select'}
            .cameraIDs=${this._cameraIDsForTimeline}
            .mini=${true}
            .timelineConfig=${this.timelineConfig}
            .thumbnailConfig=${this.thumbnailConfig}
            .cameraManager=${this.cameraManager}
            .cardWideConfig=${this.cardWideConfig}
          >
          </frigate-card-timeline-core>`
        : ''}
      <slot></slot>
    </frigate-card-surround-basic>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-surround': FrigateCardSurround;
  }
}
