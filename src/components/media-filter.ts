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
import { CameraManager } from '../camera-manager/manager';
import { DateRange } from '../camera-manager/range';
import { CameraConfig, ExtendedHomeAssistant } from '../types';
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
import { EventQuery, MediaMetadata, QueryType, RecordingQuery } from '../camera-manager/types';
import { EventMediaQueries, RecordingMediaQueries } from '../view/media-queries';
import { createViewForEvents, createViewForRecordings } from '../utils/media-to-view.js';
import { HomeAssistant } from 'custom-card-helpers';
import { errorToConsole, prettifyTitle } from '../utils/basic';
import format from 'date-fns/format';
import parse from 'date-fns/parse';
import endOfMonth from 'date-fns/endOfMonth';
import mediaFilterStyle from '../scss/media-filter.scss';
import { MediaQueriesClassifier } from '../view/media-queries-classifier';
import uniqWith from 'lodash-es/uniqWith';
import isEqual from 'lodash-es/isEqual';

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
    const cameraIDs = mediaFilter.cameraIDs ?? new Set(this.cameras.keys());

    // A note on views:
    // - In the below, if the user selects a camera to view media for, the main
    //   view camera is also set to that value (e.g. a user browsing the
    //   gallery, chooses a different camera in the media filter, then
    //   subsequently chooses the live button -- they would expect the live view
    //   for that filtered camera not the prior camera).
    // - Similarly, if the user chooses clips or snapshots, set the actual view
    //   to 'clips' or 'snapshots' in order to ensure the right icon is shown as
    //   selected in the menu.
    if (
      mediaFilter.mediaType === MediaFilterMediaType.Clips ||
      mediaFilter.mediaType === MediaFilterMediaType.Snapshots
    ) {
      const query: EventQuery = {
        type: QueryType.Event,
        cameraIDs: cameraIDs,
        ...(mediaFilter.what && { what: mediaFilter.what }),
        ...(mediaFilter.where && { where: mediaFilter.where }),
        ...(convertedFavorite !== null && { favorite: convertedFavorite }),
        ...(convertedTime && { start: convertedTime.start, end: convertedTime.end }),
        ...(this.mediaLimit && { limit: this.mediaLimit }),
        ...(mediaFilter.mediaType === MediaFilterMediaType.Clips && { hasClip: true }),
        ...(mediaFilter.mediaType === MediaFilterMediaType.Snapshots && {
          hasSnapshot: true,
        }),
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

            // See 'A note on views' above for these two arguments.
            ...(cameraIDs.size === 1 && { targetCameraID: [...cameraIDs][0] }),
            targetView:
              mediaFilter.mediaType === MediaFilterMediaType.Clips
                ? 'clips'
                : 'snapshots',
          },
        )
      )?.dispatchChangeEvent(this);
    } else if (mediaFilter.mediaType === MediaFilterMediaType.Recordings) {
      const query: RecordingQuery = {
        type: QueryType.Recording,
        cameraIDs: cameraIDs,
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

            // See 'A note on views' above for these two arguments.
            ...(cameraIDs.size === 1 && { targetCameraID: [...cameraIDs][0] }),
            targetView: 'recordings',
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
          label: this.hass
            ? this.cameraManager?.getCameraMetadata(this.hass, cameraConfig)?.title ?? ''
            : '',
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

  protected _getDefaultsFromView(): MediaFilterCoreSelection | undefined {
    if (!this.view) {
      return undefined;
    }

    let mediaType: MediaFilterMediaType | undefined;
    let cameraIDs: Set<string> | undefined;
    let what: Set<string> | undefined;
    let where: Set<string> | undefined;
    let favorite: boolean | undefined;

    if (MediaQueriesClassifier.areEventQueries(this.view.query)) {
      const queries = this.view.query.getQueries();
      if (!queries) {
        return;
      }

      const hasClips = uniqWith(
        queries.map((query) => query.hasClip),
        isEqual,
      );
      const hasSnapshots = uniqWith(
        queries.map((query) => query.hasSnapshot),
        isEqual,
      );
      if (hasClips.length === 1 && hasSnapshots.length === 1) {
        mediaType = !!hasClips[0]
          ? MediaFilterMediaType.Clips
          : !!hasSnapshots[0]
          ? MediaFilterMediaType.Snapshots
          : undefined;
      }

      const cameraIDSets = uniqWith(
        queries.map((query) => query.cameraIDs),
        isEqual,
      );
      if (cameraIDSets.length === 1) {
        cameraIDs = queries[0].cameraIDs;
      }
      const whatSets = uniqWith(
        queries.map((query) => query.what),
        isEqual,
      );
      if (whatSets.length === 1) {
        what = queries[0].what;
      }
      const whereSets = uniqWith(
        queries.map((query) => query.where),
        isEqual,
      );
      if (whereSets.length === 1) {
        where = queries[0].where;
      }
      const favoriteValues = uniqWith(
        queries.map((query) => query.favorite),
        isEqual,
      );
      if (favoriteValues.length === 1) {
        favorite = queries[0].favorite;
      }
    }

    return {
      ...(mediaType && { mediaType: mediaType }),
      ...(cameraIDs && { cameraIDs: cameraIDs }),
      ...(what && { what: what }),
      ...(where && { where: where }),
      ...(favorite !== undefined && {
        favorite: favorite
          ? MediaFilterCoreFavoriteSelection.Favorite
          : MediaFilterCoreFavoriteSelection.NotFavorite,
      }),
    };
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
    const defaults = this._getDefaultsFromView();

    return html` <frigate-card-media-filter-core
      .hass=${this.hass}
      .whenOptions=${this._mediaMetadataController?.whenOptions}
      .cameraOptions=${this._cameraOptions}
      .whatOptions=${this._mediaMetadataController?.whatOptions}
      .whereOptions=${this._mediaMetadataController?.whereOptions}
      .controls=${controls}
      .defaults=${defaults}
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
