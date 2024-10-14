import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { ConditionsManagerEpoch } from '../../card-controller/conditions-manager.js';
import { ReadonlyMicrophoneManager } from '../../card-controller/microphone-manager.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { LiveController } from '../../components-lib/live/live-controller.js';
import { CardWideConfig, LiveConfig, Overrides } from '../../config/types.js';
import basicBlockStyle from '../../scss/basic-block.scss';
import { ExtendedHomeAssistant } from '../../types.js';
import { contentsChanged } from '../../utils/basic.js';
import './grid.js';

@customElement('frigate-card-live')
export class FrigateCardLive extends LitElement {
  @property({ attribute: false })
  public conditionsManagerEpoch?: ConditionsManagerEpoch;

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
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  @property({ attribute: false })
  public microphoneManager?: ReadonlyMicrophoneManager;

  @property({ attribute: false })
  public triggeredCameraIDs?: Set<string>;

  protected _controller = new LiveController(this);

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldUpdate(_changedProps: PropertyValues): boolean {
    return this._controller.shouldUpdate();
  }

  protected willUpdate(): void {
    this._controller.clearMessageReceived();
  }

  protected render(): TemplateResult | void {
    if (!this.hass || !this.nonOverriddenLiveConfig || !this.cameraManager) {
      return;
    }

    // Implementation notes:
    // - See use of liveConfig and not config below -- the underlying carousel
    //   will independently override the liveConfig to reflect the camera in the
    //   carousel (not necessarily the selected camera).
    // - Various events are captured to prevent them propagating upwards if the
    //   card is in the background.
    // - The entire returned template is keyed to allow for the whole template
    //   to be re-rendered in certain circumstances (specifically: if a message
    //   is received when the card is in the background).
    return html`${keyed(
      this._controller.getRenderEpoch(),
      html`
        <frigate-card-live-grid
          .hass=${this.hass}
          .viewManagerEpoch=${this.viewManagerEpoch}
          .nonOverriddenLiveConfig=${this.nonOverriddenLiveConfig}
          .overriddenLiveConfig=${this.overriddenLiveConfig}
          .inBackground=${this._controller.isInBackground()}
          .conditionsManagerEpoch=${this.conditionsManagerEpoch}
          .overrides=${this.overrides}
          .cardWideConfig=${this.cardWideConfig}
          .cameraManager=${this.cameraManager}
          .microphoneManager=${this.microphoneManager}
          .triggeredCameraIDs=${this.triggeredCameraIDs}
        >
        </frigate-card-live-grid>
      `,
    )}`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-live': FrigateCardLive;
  }
}
