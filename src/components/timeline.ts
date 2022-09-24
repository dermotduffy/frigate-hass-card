// TODO: When a media viewer is first loaded the selected child won't work (because the underlying carousel has not yet rendered)
// TODO: Make minitimeline configurable in the editor

import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import timelineStyle from '../scss/timeline.scss';
import { CameraConfig, ExtendedHomeAssistant, TimelineConfig } from '../types';
import { TimelineDataManager } from '../utils/timeline-data-manager';
import { View } from '../view';
import './surround.js';
import './timeline-core.js';

// This file is kept separate from timeline-core.ts to avoid a circular dependency:
//   FrigateCardTimeline ->
//   FrigateCardSurround ->
//   FrigateCardTimelineCore 

@customElement('frigate-card-timeline')
export class FrigateCardTimeline extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public cameras?: Map<string, CameraConfig>;

  @property({ attribute: false })
  public timelineConfig?: TimelineConfig;

  @property({ attribute: false })
  public timelineDataManager?: TimelineDataManager;

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.timelineConfig) {
      return html``;
    }

    return html` <frigate-card-surround
      .hass=${this.hass}
      .view=${this.view}
      .thumbnailConfig=${this.timelineConfig.controls.thumbnails}
      .cameras=${this.cameras}
      .fetch=${false}
    >
      <frigate-card-timeline-core
        .hass=${this.hass}
        .view=${this.view}
        .cameras=${this.cameras}
        .timelineConfig=${this.timelineConfig}
        .thumbnailDetails=${this.timelineConfig.controls.thumbnails.show_details}
        .thumbnailSize=${this.timelineConfig.controls.thumbnails.size}
        .timelineDataManager=${this.timelineDataManager}
      >
      </frigate-card-timeline-core>
    </frigate-card-surround>`;
  }

  /**
   * Return compiled CSS styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(timelineStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-timeline': FrigateCardTimeline;
  }
}
