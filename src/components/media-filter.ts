import sub from 'date-fns/sub';
import endOfDay from 'date-fns/endOfDay';
import endOfYesterday from 'date-fns/endOfYesterday';
import endOfToday from 'date-fns/esm/endOfToday';
import startOfToday from 'date-fns/esm/startOfToday';
import startOfDay from 'date-fns/startOfDay';
import startOfYesterday from 'date-fns/startOfYesterday';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  ReactiveController,
  ReactiveControllerHost,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import {
  CameraManager,
} from '../camera/manager';
import { DateRange } from '../camera/range';
import { CameraConfig, ExtendedHomeAssistant } from '../types';
import { getCameraTitle } from '../utils/camera';
import { View } from '../view/view';
import {
  MediaFilterControls,
  MediaFilterCoreFavoriteSelection,
  MediaFilterCoreSelection,
  MediaFilterCoreWhen,
  MediaFilterCoreWhenSelection,
  MediaFilterMediaType,
  ValueLabel,
} from './media-filter-core';
import './surround.js';
import './timeline-core.js';
import { EventQuery, MediaMetadata, QueryType, RecordingQuery } from '../camera/types';
import { EventMediaQueries, RecordingMediaQueries } from '../view/media-queries';
import { createViewForEvents, createViewForRecordings } from '../utils/media-to-view.js';
import { HomeAssistant } from 'custom-card-helpers';
import { errorToConsole, prettifyTitle } from '../utils/basic';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import endOfMonth from 'date-fns/endOfMonth';
import mediaFilterStyle from '../scss/media-filter.scss';
import { MediaQueriesClassifier } from '../view/media-queries-classifier';

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
  protected _mediaMetadataController?: MediaMetadataController;

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
    const mediaFilter = ev.detail;
    if (
      !this.cameras ||
      !this.cameraManager ||
      !this.hass ||
      !this.view ||
      !mediaFilter.mediaType
    ) {
      return;
    }

    const convertedTime = this._convertWhenToDateRange(mediaFilter.when);
    const convertedFavorite = this._convertFavoriteToBoolean(mediaFilter.favorite);

    if (
      mediaFilter.mediaType === MediaFilterMediaType.Clips ||
      mediaFilter.mediaType === MediaFilterMediaType.Snapshots
    ) {
      const query: EventQuery = {
        type: QueryType.Event,
        cameraIDs: mediaFilter.cameraIDs ?? new Set(this.cameras.keys()),
        ...(mediaFilter.what && { what: mediaFilter.what }),
        ...(mediaFilter.where && { where: mediaFilter.where }),
        ...(convertedFavorite !== null && { favorite: convertedFavorite }),
        ...(convertedTime && { start: convertedTime.start, end: convertedTime.end }),
        ...(this.mediaLimit && { limit: this.mediaLimit }),
        ...(mediaFilter.mediaType === MediaFilterMediaType.Clips && { hasClip: true }),
        ...(mediaFilter.mediaType === MediaFilterMediaType.Snapshots && { hasSnapshot: true })
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
    } else if (mediaFilter.mediaType === MediaFilterMediaType.Recordings) {
      const query: RecordingQuery = {
        type: QueryType.Recording,
        cameraIDs: mediaFilter.cameraIDs ?? new Set(this.cameras.keys()),
        ...(convertedTime && { start: convertedTime.start, end: convertedTime.end }),
      };

      (
        await createViewForRecordings(
          this,
          this.hass,
          this.cameraManager,
          this.cameras,
          this.view,
          {
            query: new RecordingMediaQueries([query]),
          },
        )
      )?.dispatchChangeEvent(this);
    }
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

    if (changedProps.has('cameraManager') && this.hass && this.cameraManager) {
      this._mediaMetadataController = new MediaMetadataController(
        this,
        this.hass,
        this.cameraManager,
      );
    }
  }

  protected render(): TemplateResult | void {
    const areEvents = !!(
      this.view?.query && MediaQueriesClassifier.areEventQueries(this.view.query)
    );
    const areRecordings = !!(
      this.view?.query && MediaQueriesClassifier.areRecordingQueries(this.view.query)
    );
    const managerCapabilities = this.cameraManager?.getCapabilities();

    // Which media controls are shown depends on the view.
    const controls: MediaFilterControls = {
      what: areEvents,
      where: areEvents,
      favorite: areEvents
        ? !!managerCapabilities?.canFavoriteEvents
        : areRecordings
        ? !!managerCapabilities?.canFavoriteRecordings
        : false,
    };

    return html` <frigate-card-media-filter-core
      .hass=${this.hass}
      .whenOptions=${this._mediaMetadataController?.whenOptions}
      .cameraOptions=${this._cameraOptions}
      .whatOptions=${this._mediaMetadataController?.whatOptions}
      .whereOptions=${this._mediaMetadataController?.whereOptions}
      .controls=${controls}
      @frigate-card:media-filter-core:change=${this._mediaFilterHandler.bind(this)}
    >
    </frigate-card-media-filter-core>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(mediaFilterStyle);
  }
}

export class MediaMetadataController implements ReactiveController {
  protected _host: ReactiveControllerHost;
  protected _hass: HomeAssistant;
  protected _cameraManager: CameraManager;

  public whenOptions: ValueLabel<MediaFilterCoreWhenSelection>[] = [];
  public whatOptions: ValueLabel<string>[] = [];
  public whereOptions: ValueLabel<string>[] = [];

  constructor(
    host: ReactiveControllerHost,
    hass: HomeAssistant,
    cameraManager: CameraManager,
  ) {
    this._host = host;
    this._hass = hass;
    this._cameraManager = cameraManager;
    host.addController(this);
  }

  async hostConnected() {
    let metadata: MediaMetadata | null;
    try {
      metadata = await this._cameraManager.getMediaMetadata(this._hass);
    } catch (e) {
      errorToConsole(e as Error);
      return;
    }
  
    if (!metadata) {
      return;
    }

    if (metadata.what) {
      this.whatOptions = [...metadata.what]
        .sort()
        .map((what) => ({ value: what, label: prettifyTitle(what) }));
    }
    if (metadata.where) {
      this.whereOptions = [...metadata.where]
        .sort()
        .map((where) => ({ value: where, label: prettifyTitle(where) }));
    }
    if (metadata.days) {
      const yearMonths: Set<string> = new Set();
      [...metadata.days].forEach((day) => {
        // An efficient conversion: "2023-01-26" -> "2023-01"
        yearMonths.add(day.substring(0, 7));
      });
      const monthStarts: Date[] = [];
      yearMonths.forEach((yearMonth) => {
        monthStarts.push(parse(yearMonth, 'yyyy-MM', new Date()));
      });
      this.whenOptions = monthStarts
        .sort()
        .reverse()
        .map((monthStart) => ({
          label: format(monthStart, 'MMMM yyyy'),
          value: {
            selection: MediaFilterCoreWhen.Custom,
            custom: { start: monthStart, end: endOfMonth(monthStart) },
          },
        }));
    }
    this._host.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-media-filter': FrigateCardMediaFilter;
  }
}
