import {
  CSSResultGroup,
  LitElement,
  TemplateResult,
  html,
  unsafeCSS,
  PropertyValues,
} from 'lit';
import { DataSet } from 'vis-data/esnext';
import { HomeAssistant } from 'custom-card-helpers';
import { Timeline } from 'vis-timeline/esnext';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref';

import { BrowseMediaUtil } from '../browse-media-util';
import { CameraConfig, ExtendedHomeAssistant } from '../types';
import { View } from '../view';
import { renderProgressIndicator } from './message';

import timelineStyle from '../scss/timeline.scss';

interface FrigateCardTimelineData {
  id: string;
  content: string;
  start: number;
}

@customElement('frigate-card-timeline')
export class FrigateCardTimeline extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: Readonly<View>;

  @property({ attribute: false })
  protected cameraConfig?: CameraConfig;

  protected _timelineRef: Ref<HTMLElement> = createRef();
  protected _timeline?: Timeline;

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.view || !this.cameraConfig) {
      return;
    }

    if (!this.view.target) {
      const browseMediaQueryParameters =
        BrowseMediaUtil.getBrowseMediaQueryParametersOrDispatchError(
          this,
          this.view,
          this.cameraConfig,
        );
      if (!browseMediaQueryParameters) {
        return;
      }

      BrowseMediaUtil.fetchLatestMediaAndDispatchViewChange(
        this,
        this.hass,
        this.view,
        browseMediaQueryParameters,
      );
      return renderProgressIndicator();
    }
    return html` <div id="timeline" ${ref(this._timelineRef)}></div>`;
  }

  protected _buildDataset(): DataSet<FrigateCardTimelineData> {
    const items: FrigateCardTimelineData[] = [];

    this.view?.target?.children?.forEach((child) => {
      if (child.frigate) {
        const item = {
          id: child.media_content_id,
          content: child.frigate.event.id,
          start: child.frigate.event.start_time * 1000,
        };
        if (child.frigate.event.end_time) {
          //item['end'] = child.frigate.event.end_time * 1000;
        }
        items.push(item);
      }
    });
    return new DataSet(items);
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected updated(_changedProperties: PropertyValues): void {
    // Configuration for the Timeline
    const options = {
      minHeight: '300px',
    };

    // Create a Timeline
    if (this._timelineRef.value && !this._timeline) {
      this._timeline = new Timeline(
        this._timelineRef.value,
        this._buildDataset(),
        options,
      );
    }
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(timelineStyle);
  }
}
