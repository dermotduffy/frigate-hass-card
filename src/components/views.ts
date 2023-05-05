import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CameraManager } from '../camera-manager/manager.js';
import { ConditionControllerEpoch, getOverridesByKey } from '../conditions';
import viewsStyle from '../scss/views.scss';
import { CardWideConfig, ExtendedHomeAssistant, FrigateCardConfig } from '../types.js';
import { ResolvedMediaCache } from '../utils/ha/resolved-media';
import { View } from '../view/view.js';
import './surround.js';

@customElement('frigate-card-views')
export class FrigateCardViews extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public config?: FrigateCardConfig;

  @property({ attribute: false })
  public nonOverriddenConfig?: FrigateCardConfig;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public resolvedMediaCache?: ResolvedMediaCache;

  @property({ attribute: false })
  public conditionControllerEpoch?: ConditionControllerEpoch;

  @property({ attribute: false })
  public hide?: boolean;

  @property({ attribute: false })
  public microphoneStream?: MediaStream;

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('view') || changedProps.has('config')) {
      if (this.view?.is('live') || this._shouldLivePreload()) {
        import('./live/live.js');
      }
      if (this.view?.isGalleryView()) {
        import('./gallery.js');
      } else if (this.view?.isViewerView()) {
        import('./viewer.js');
      } else if (this.view?.is('image')) {
        import('./image.js');
      } else if (this.view?.is('timeline')) {
        import('./timeline.js');
      }
    }

    if (changedProps.has('hide')) {
      if (this.hide) {
        this.setAttribute('hidden', '');
      } else {
        this.removeAttribute('hidden');
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldUpdate(_: PropertyValues): boolean {
    // Future: Updates to `hass` and `conditionState` here will be frequent.
    // Throttling here may be necessary if users report performance degradation
    // > v5.0.0-beta1 .
    //
    // These updates are necessary in these cases:
    // - conditionState: Required to let `frigate-card-live` calculate its own
    //   overrides.
    // - hass: Required for anything that needs to sign URLs. Of note is
    //   anything that renders an image (e.g. a thumbnail -- almost everything,
    //   or the main `frigate-card-image` view).
    //
    // It should instead be possible to pass conditionState to live only (every
    // update required), and pass hass only once / 5 minutes (see
    // HASS_REJECTION_CUTOFF_MS).
    return true;
  }

  protected _shouldLivePreload(): boolean {
    return !!this.config?.live.preload;
  }

  protected render(): TemplateResult | void {
    // Only essential items should be added to the below list, since we want the
    // overall views pane to render in ~almost all cases (e.g. for a camera
    // initialization error to display, `view` and `cameraConfig` may both be
    // undefined, but we still want to render).
    if (!this.hass || !this.config || !this.nonOverriddenConfig) {
      return html``;
    }

    // Render but hide the live view if there's a message, or if it's preload
    // mode and the view is not live.
    const liveClasses = {
      hidden: this._shouldLivePreload() && !this.view?.is('live'),
    };
    const overallClasses = {
      hidden: !!this.hide,
    };

    const thumbnailConfig = this.view?.is('live')
      ? this.config.live.controls.thumbnails
      : this.view?.isViewerView()
      ? this.config.media_viewer.controls.thumbnails
      : this.view?.is('timeline')
      ? this.config.timeline.controls.thumbnails
      : undefined;

    const miniTimelineConfig = this.view?.is('live')
      ? this.config.live.controls.timeline
      : this.view?.isViewerView()
      ? this.config.media_viewer.controls.timeline
      : undefined;

    const cameraConfig = this.view
      ? this.cameraManager?.getStore().getCameraConfig(this.view.camera) ?? null
      : null;

    return html` <frigate-card-surround
      class="${classMap(overallClasses)}"
      .hass=${this.hass}
      .view=${this.view}
      .fetchMedia=${this.view?.is('live')
        ? this.config.live.controls.thumbnails.media
        : undefined}
      .thumbnailConfig=${!this.hide ? thumbnailConfig : undefined}
      .timelineConfig=${!this.hide ? miniTimelineConfig : undefined}
      .cameraManager=${this.cameraManager}
      .cardWideConfig=${this.cardWideConfig}
    >
      ${!this.hide && this.view?.is('image') && cameraConfig
        ? html` <frigate-card-image
            .imageConfig=${this.config.image}
            .view=${this.view}
            .hass=${this.hass}
            .cameraConfig=${cameraConfig}
            .supportZoom=${true}
          >
          </frigate-card-image>`
        : ``}
      ${!this.hide && this.view?.isGalleryView()
        ? html` <frigate-card-gallery
            .hass=${this.hass}
            .view=${this.view}
            .galleryConfig=${this.config.media_gallery}
            .cameraManager=${this.cameraManager}
            .cardWideConfig=${this.cardWideConfig}
          >
          </frigate-card-gallery>`
        : ``}
      ${!this.hide && this.view?.isViewerView()
        ? html`
            <frigate-card-viewer
              .hass=${this.hass}
              .view=${this.view}
              .viewerConfig=${this.config.media_viewer}
              .resolvedMediaCache=${this.resolvedMediaCache}
              .cameraManager=${this.cameraManager}
              .cardWideConfig=${this.cardWideConfig}
            >
            </frigate-card-viewer>
          `
        : ``}
      ${!this.hide && this.view?.is('timeline')
        ? html` <frigate-card-timeline
            .hass=${this.hass}
            .view=${this.view}
            .timelineConfig=${this.config.timeline}
            .cameraManager=${this.cameraManager}
            .cardWideConfig=${this.cardWideConfig}
          >
          </frigate-card-timeline>`
        : ``}
      ${
        // Note: Subtle difference in condition below vs the other views in order
        // to always render the live view for live.preload mode.

        // Note: <frigate-card-live> uses nonOverriddenConfig rather than the
        // overriden config as it does it's own overriding as part of the camera
        // carousel.
        this._shouldLivePreload() || (!this.hide && this.view?.is('live'))
          ? html`
              <frigate-card-live
                .hass=${this.hass}
                .view=${this.view}
                .liveConfig=${this.nonOverriddenConfig.live}
                .conditionControllerEpoch=${this.conditionControllerEpoch}
                .liveOverrides=${getOverridesByKey('live', this.config.overrides)}
                .cameraManager=${this.cameraManager}
                .cardWideConfig=${this.cardWideConfig}
                .microphoneStream=${this.microphoneStream}
                class="${classMap(liveClasses)}"
              >
              </frigate-card-live>
            `
          : ``
      }
    </frigate-card-surround>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(viewsStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-views': FrigateCardViews;
  }
}
