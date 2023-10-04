import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CameraManager } from '../camera-manager/manager';
import { CardWideConfig, TimelineConfig } from '../config/types';
import basicBlockStyle from '../scss/basic-block.scss';
import { ExtendedHomeAssistant } from '../types';
import { View } from '../view/view';
import './surround.js';
import './timeline-core.js';

@customElement('frigate-card-timeline')
export class FrigateCardTimeline extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public timelineConfig?: TimelineConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected render(): TemplateResult | void {
    if (!this.timelineConfig) {
      return html``;
    }

    return html`
      <frigate-card-timeline-core
        .hass=${this.hass}
        .view=${this.view}
        .timelineConfig=${this.timelineConfig}
        .thumbnailConfig=${this.timelineConfig.controls.thumbnails}
        .cameraManager=${this.cameraManager}
        .cardWideConfig=${this.cardWideConfig}
        .itemClickAction=${this.timelineConfig.controls.thumbnails.mode === 'none'
          ? 'play'
          : 'select'}
      >
      </frigate-card-timeline-core>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-timeline': FrigateCardTimeline;
  }
}
