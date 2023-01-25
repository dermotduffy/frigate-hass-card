import sub from 'date-fns/sub';
import endOfDay from 'date-fns/endOfDay';
import endOfYesterday from 'date-fns/endOfYesterday';
import endOfToday from 'date-fns/esm/endOfToday';
import startOfToday from 'date-fns/esm/startOfToday';
import startOfDay from 'date-fns/startOfDay';
import startOfYesterday from 'date-fns/startOfYesterday';
import {
  css,
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { CameraManager } from '../camera/manager';
import { DateRange } from '../camera/range';
import { CameraConfig, ExtendedHomeAssistant } from '../types';
import { getCameraTitle } from '../utils/camera';
import { View } from '../view/view';
import {
  MediaFilterCoreFavoriteSelection,
  MediaFilterCoreSelection,
  MediaFilterCoreWhen,
  MediaFilterCoreWhenSelection,
  ValueLabel,
} from './media-filter-core';
import './surround.js';
import './timeline-core.js';
import { EventQuery, QueryType } from '../camera/types';
import { EventMediaQueries } from '../view/media-queries';
import { createViewForEvents } from '../utils/media-to-view.js';

@customElement('frigate-card-media-filter')
export class FrigateCardMediaFilter extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public cameras?: Map<string, CameraConfig>;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public view?: View;

  @property({ attribute: false })
  public mediaLimit?: number;

  protected _cameraOptions: ValueLabel<string>[] = [];

  protected _convertWhenToDateRange(
    value?: MediaFilterCoreWhenSelection,
  ): DateRange | null {
    if (!value) {
      return null;
    }
    const now = new Date();
    switch (value.selection) {
      case MediaFilterCoreWhen.Today:
        return { start: startOfToday(), end: endOfToday() };
      case MediaFilterCoreWhen.Yesterday:
        return { start: startOfYesterday(), end: endOfYesterday() };
      case MediaFilterCoreWhen.PastWeek:
        return { start: startOfDay(sub(now, { days: 7 })), end: endOfDay(now) };
      case MediaFilterCoreWhen.PastMonth:
        return { start: startOfDay(sub(now, { months: 1 })), end: endOfDay(now) };
      case MediaFilterCoreWhen.Custom:
        if (value.custom) {
          return value.custom;
        }
    }
    return null;
  }

  protected _convertFavoriteToBoolean(
    value?: MediaFilterCoreFavoriteSelection,
  ): boolean | null {
    if (!value) {
      return null;
    }
    return value === MediaFilterCoreFavoriteSelection.Favorite;
  }

  protected async _mediaFilterHandler(
    ev: CustomEvent<MediaFilterCoreSelection>,
  ): Promise<void> {
    if (!this.cameras || !this.cameraManager || !this.hass || !this.view) {
      return;
    }
    const mediaFilter = ev.detail;
    const convertedTime = this._convertWhenToDateRange(mediaFilter.when);
    const convertedFavorite = this._convertFavoriteToBoolean(mediaFilter.favorite);

    const query: EventQuery = {
      type: QueryType.Event,
      cameraIDs: mediaFilter.cameraIDs ?? new Set(this.cameras.keys()),
      ...(mediaFilter.what && { what: mediaFilter.what }),
      ...(mediaFilter.where && { where: mediaFilter.where }),
      ...(convertedFavorite !== null && { favorite: convertedFavorite }),
      ...(convertedTime && { start: convertedTime.start, end: convertedTime.end }),
      ...(this.mediaLimit && { limit: this.mediaLimit }),
    };

    (
      await createViewForEvents(
        this,
        this.hass,
        this.cameraManager,
        this.cameras,
        this.view,
        {
          query: new EventMediaQueries([query]),
        },
      )
    )?.dispatchChangeEvent(this);
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('cameras') && this.cameras) {
      this._cameraOptions = Array.from(this.cameras.entries()).map(
        ([cameraID, cameraConfig]) => ({
          value: cameraID,
          label: getCameraTitle(this.hass, cameraConfig),
        }),
      );
    }
  }

  protected render(): TemplateResult | void {
    // TODO Replace with real custom when options
    // TODO Replace with real custom what options
    // TODO Replace with real custom where options
    const whereOptions = [{ value: 'steps', label: 'Front Steps' }];

    const whatOptions = [
      { value: 'car', label: 'Car' },
      { value: 'person', label: 'Person' },
    ];

    const whenOptions = [
      {
        value: {
          selection: MediaFilterCoreWhen.Custom,
          custom: { start: startOfToday(), end: endOfToday() },
        },
        label: 'December 2021',
      },
    ];

    return html` <frigate-card-media-filter-core
      .hass=${this.hass}
      .whenOptions=${whenOptions}
      .cameraOptions=${this._cameraOptions}
      .whatOptions=${whatOptions}
      .whereOptions=${whereOptions}
      @frigate-card:media-filter-core:change=${this._mediaFilterHandler.bind(this)}
    >
    </frigate-card-media-filter-core>`;
  }

  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
      }
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-media-filter': FrigateCardMediaFilter;
  }
}
