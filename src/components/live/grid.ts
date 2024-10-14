import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { ConditionsManagerEpoch } from '../../card-controller/conditions-manager.js';
import { ReadonlyMicrophoneManager } from '../../card-controller/microphone-manager.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { MediaGridSelected } from '../../components-lib/media-grid-controller.js';
import { CardWideConfig, LiveConfig, Overrides } from '../../config/types.js';
import liveGridStyle from '../../scss/live-grid.scss';
import { ExtendedHomeAssistant } from '../../types.js';
import { contentsChanged } from '../../utils/basic.js';
import './carousel.js';

@customElement('frigate-card-live-grid')
export class FrigateCardLiveGrid extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public nonOverriddenLiveConfig?: LiveConfig;

  @property({ attribute: false })
  public overriddenLiveConfig?: LiveConfig;

  @property({ attribute: false, hasChanged: contentsChanged })
  public overrides?: Overrides;

  @property({ attribute: false })
  public conditionsManagerEpoch?: ConditionsManagerEpoch;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public microphoneManager?: ReadonlyMicrophoneManager;

  @property({ attribute: false })
  public triggeredCameraIDs?: Set<string>;

  protected _renderCarousel(cameraID?: string): TemplateResult {
    const view = this.viewManagerEpoch?.manager.getView();
    const triggeredCameraID = cameraID ?? view?.camera;

    return html`
      <frigate-card-live-carousel
        grid-id=${ifDefined(cameraID)}
        .hass=${this.hass}
        .viewManagerEpoch=${this.viewManagerEpoch}
        .viewFilterCameraID=${cameraID}
        .nonOverriddenLiveConfig=${this.nonOverriddenLiveConfig}
        .overriddenLiveConfig=${this.overriddenLiveConfig}
        .conditionsManagerEpoch=${this.conditionsManagerEpoch}
        .overrides=${this.overrides}
        .cardWideConfig=${this.cardWideConfig}
        .cameraManager=${this.cameraManager}
        .microphoneManager=${this.microphoneManager}
        ?triggered=${triggeredCameraID &&
        !!this.triggeredCameraIDs?.has(triggeredCameraID)}
      >
      </frigate-card-live-carousel>
    `;
  }

  protected _gridSelectCamera(cameraID: string): void {
    this.viewManagerEpoch?.manager.setViewByParameters({
      params: {
        camera: cameraID,
      },
    });
  }

  protected _needsGrid(): boolean {
    const cameraIDs = this.cameraManager?.getStore().getCameraIDsWithCapability('live');
    const view = this.viewManagerEpoch?.manager.getView();
    return (
      !!view?.isGrid() &&
      !!view?.supportsMultipleDisplayModes() &&
      !!cameraIDs &&
      cameraIDs.size > 1
    );
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('viewManagerEpoch') && this._needsGrid()) {
      import('../media-grid.js');
    }
  }

  protected render(): TemplateResult | void {
    if (!this.conditionsManagerEpoch || !this.nonOverriddenLiveConfig) {
      return;
    }
    const cameraIDs = this.cameraManager?.getStore().getCameraIDsWithCapability('live');
    if (!cameraIDs?.size || !this._needsGrid()) {
      return this._renderCarousel();
    }

    return html`
      <frigate-card-media-grid
        .selected=${this.viewManagerEpoch?.manager.getView()?.camera}
        .displayConfig=${this.overriddenLiveConfig?.display}
        @frigate-card:media-grid:selected=${(ev: CustomEvent<MediaGridSelected>) =>
          this._gridSelectCamera(ev.detail.selected)}
      >
        ${[...cameraIDs].map((cameraID) => this._renderCarousel(cameraID))}
      </frigate-card-media-grid>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(liveGridStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-live-grid': FrigateCardLiveGrid;
  }
}
