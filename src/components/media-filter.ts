import { sub } from 'date-fns';
import endOfDay from 'date-fns/endOfDay';
import endOfYesterday from 'date-fns/endOfYesterday';
import endOfToday from 'date-fns/esm/endOfToday';
import startOfToday from 'date-fns/esm/startOfToday';
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
import {
  MediaFilterCoreFavoriteSelection,
  MediaFilterCoreSelection,
  MediaFilterCoreWhen,
  MediaFilterCoreWhenSelection,
  ValueLabel,
} from './media-filter-core';
import './surround.js';
import './timeline-core.js';

@customElement('frigate-card-media-filter')
export class FrigateCardMediaFilter extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public cameras?: Map<string, CameraConfig>;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  protected _cameraOptions: ValueLabel<string>[] = [];

  protected _convertWhenToDateRange(
    value?: MediaFilterCoreWhenSelection,
  ): DateRange | null {
    if (!value) {
      return null;
    }
    if (value.selection === MediaFilterCoreWhen.Custom && value.custom) {
      return value.custom;
    }
    const now = new Date();
    switch (value.selection) {
      case MediaFilterCoreWhen.Today:
        return { start: startOfToday(), end: endOfToday() };
      case MediaFilterCoreWhen.Yesterday:
        return { start: startOfYesterday(), end: endOfYesterday() };
      case MediaFilterCoreWhen.PastWeek:
        return { start: sub(now, { days: 7 }), end: endOfDay(now) };
      case MediaFilterCoreWhen.PastMonth:
        return { start: sub(now, { months: 1 }), end: endOfDay(now) };
    }
    return null;
  }

  protected _convertFavoriteToBoolean(
    value?: MediaFilterCoreFavoriteSelection,
  ): boolean | null {
    if (!value || value === MediaFilterCoreFavoriteSelection.All) {
      return null;
    }
    return value === MediaFilterCoreFavoriteSelection.Favorite;
  }

  protected _mediaFilterHandler(ev: CustomEvent<MediaFilterCoreSelection>): void {
    const convertedTime = this._convertWhenToDateRange(ev.detail.when);
    const convertedFavorite = this._convertFavoriteToBoolean(ev.detail.favorite);
    const details = {
      ...ev.detail,
      ...(convertedTime && { when: convertedTime }),
      ...(convertedFavorite && { favorite: convertedFavorite }),
    };
    // TODO: remove.
    console.debug('Received media filter choices:', details);
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
