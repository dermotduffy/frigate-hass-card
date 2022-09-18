// TODO: When a media viewer is first loaded the selected child won't work (because the underlying carousel has not yet rendered)
// TODO: rename surround to surround basic and this file to surround?
// TODO: thumbnails in drawers don't work.
// TODO: delete segments if not in summary? is this actually necessary? could it create gaps in data? better off stopping access via summary?
// TODO: support filtering created dataviews by recordings or mediatype (so storage )
// TODO: dataview refresh instead of rewriteitem?
// TODO: Make minitimeline configurable in the editor

import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import timelineStyle from '../scss/timeline.scss';
import { CameraConfig, ExtendedHomeAssistant, TimelineConfig } from '../types';
import { TimelineDataManager } from '../utils/timeline-data-manager';
import { View } from '../view';
import './surround-thumbnails.js';
import './timeline-core.js';

// This file is kept separate from timeline-core.ts to avoid a circular dependency:
//   FrigateCardTimeline ->
//   FrigateCardSurroundThumbnails ->
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

    return html` <frigate-card-surround-thumbnails
      .hass=${this.hass}
      .view=${this.view}
      .thumbnailConfig=${this.timelineConfig.controls.thumbnails}
      .cameras=${this.cameras}
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
    </frigate-card-surround-thumbnails>`;
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
