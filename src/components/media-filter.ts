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
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { DateRange } from '../camera-manager/range';
import { localize } from '../localize/localize';
import mediaFilterStyle from '../scss/media-filter.scss';
import { executeMediaQueryForView } from '../utils/media-to-view.js';
import { errorToConsole, formatDate, prettifyTitle } from '../utils/basic';
import { ScopedRegistryHost } from '@lit-labs/scoped-registry-mixin';
import './select';
import { FrigateCardSelect, SelectOption, SelectValues } from './select';
import uniqWith from 'lodash-es/uniqWith';
import sub from 'date-fns/sub';
import endOfDay from 'date-fns/endOfDay';
import endOfYesterday from 'date-fns/endOfYesterday';
import endOfToday from 'date-fns/esm/endOfToday';
import startOfToday from 'date-fns/esm/startOfToday';
import startOfDay from 'date-fns/startOfDay';
import startOfYesterday from 'date-fns/startOfYesterday';
import parse from 'date-fns/parse';
import { MediaQueriesClassifier } from '../view/media-queries-classifier';
import { View } from '../view/view';
import { CameraManager } from '../camera-manager/manager';
import { HomeAssistant } from 'custom-card-helpers';
import { DataQuery, MediaMetadata, QueryType } from '../camera-manager/types';
import format from 'date-fns/format';
import endOfMonth from 'date-fns/endOfMonth';
import isEqual from 'lodash-es/isEqual';
import { EventMediaQueries, RecordingMediaQueries } from '../view/media-queries';
import './select.js';
import orderBy from 'lodash-es/orderBy';
import { CardWideConfig } from '../types';

interface MediaFilterCoreDefaults {
  cameraIDs?: string[];
  favorite?: MediaFilterCoreFavoriteSelection;
  mediaType?: MediaFilterMediaType;
  what?: string[];
  when?: string;
  where?: string[];
  tags?: string[];
}

export enum MediaFilterCoreFavoriteSelection {
  Favorite = 'favorite',
  NotFavorite = 'not-favorite',
}

export enum MediaFilterCoreWhen {
  Today = 'today',
  Yesterday = 'yesterday',
  PastWeek = 'past-week',
  PastMonth = 'past-month',
}

export enum MediaFilterMediaType {
  Clips = 'clips',
  Snapshots = 'snapshots',
  Recordings = 'recordings',
}

@customElement('frigate-card-media-filter')
class FrigateCardMediaFilter extends ScopedRegistryHost(LitElement) {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public view?: View;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  static elementDefinitions = {
    'frigate-card-select': FrigateCardSelect,
  };

  protected _mediaMetadataController?: MediaMetadataController;

  protected _mediaTypeOptions: SelectOption[];
  protected _cameraOptions?: SelectOption[];
  protected _whenOptions?: SelectOption[];
  protected _favoriteOptions: SelectOption[];

  protected _defaults: MediaFilterCoreDefaults | null = null;

  protected _refMediaType: Ref<FrigateCardSelect> = createRef();
  protected _refCamera: Ref<FrigateCardSelect> = createRef();
  protected _refWhen: Ref<FrigateCardSelect> = createRef();
  protected _refWhat: Ref<FrigateCardSelect> = createRef();
  protected _refWhere: Ref<FrigateCardSelect> = createRef();
  protected _refFavorite: Ref<FrigateCardSelect> = createRef();
  protected _refTags: Ref<FrigateCardSelect> = createRef();

  constructor() {
    super();
    this._favoriteOptions = [
      {
        value: MediaFilterCoreFavoriteSelection.Favorite,
        label: localize('media_filter.favorite'),
      },
      {
        value: MediaFilterCoreFavoriteSelection.NotFavorite,
        label: localize('media_filter.not_favorite'),
      },
    ];
    this._mediaTypeOptions = [
      {
        value: MediaFilterMediaType.Clips,
        label: localize('media_filter.media_types.clips'),
      },
      {
        value: MediaFilterMediaType.Snapshots,
        label: localize('media_filter.media_types.snapshots'),
      },
      {
        value: MediaFilterMediaType.Recordings,
        label: localize('media_filter.media_types.recordings'),
      },
    ];
  }

  protected _stringToDateRange(input: string): DateRange {
    const dates = input.split(',');
    return {
      start: parse(dates[0], 'yyyy-MM-dd', new Date()),
      end: parse(dates[1], 'yyyy-MM-dd', new Date()),
    };
  }

  protected _dateRangeToString(when: DateRange): string {
    return `${formatDate(when.start)},${formatDate(when.end)}`;
  }

  protected _getWhen(): DateRange | null {
    const value = this._refWhen.value?.value;
    if (!value || Array.isArray(value)) {
      return null;
    }
    const now = new Date();
    switch (value) {
      case MediaFilterCoreWhen.Today:
        return { start: startOfToday(), end: endOfToday() };
      case MediaFilterCoreWhen.Yesterday:
        return { start: startOfYesterday(), end: endOfYesterday() };
      case MediaFilterCoreWhen.PastWeek:
        return { start: startOfDay(sub(now, { days: 7 })), end: endOfDay(now) };
      case MediaFilterCoreWhen.PastMonth:
        return { start: startOfDay(sub(now, { months: 1 })), end: endOfDay(now) };
      default:
        return this._stringToDateRange(value);
    }
  }

  protected async _valueChangedHandler(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _ev: CustomEvent<{ value: unknown }>,
  ): Promise<void> {
    const cameras = this.cameraManager?.getStore().getVisibleCameras();
    if (!this.hass || !cameras || !this.cameraManager || !this.view) {
      return;
    }

    const getArrayValueAsSet = (val?: SelectValues): Set<string> | null => {
      // The reported value may be '' if the field is clearable (i.e. the user
      // can click 'x').
      if (val && Array.isArray(val) && val.length && !val.includes('')) {
        return new Set([...val]);
      }
      return null;
    };

    const cameraIDs =
      getArrayValueAsSet(this._refCamera.value?.value) ?? new Set(cameras.keys());
    const mediaType = this._refMediaType.value?.value as
      | MediaFilterMediaType
      | undefined;
    const when = this._getWhen();
    const favorite = this._refFavorite.value?.value
      ? this._refFavorite.value.value === MediaFilterCoreFavoriteSelection.Favorite
      : null;

    // A note on views:
    // - In the below, if the user selects a camera to view media for, the main
    //   view camera is also set to that value (e.g. a user browsing the
    //   gallery, chooses a different camera in the media filter, then
    //   subsequently chooses the live button -- they would expect the live view
    //   for that filtered camera not the prior camera).
    // - Similarly, if the user chooses clips or snapshots, set the actual view
    //   to 'clips' or 'snapshots' in order to ensure the right icon is shown as
    //   selected in the menu.
    const limit = this.cardWideConfig?.performance?.features.media_chunk_size;

    if (
      mediaType === MediaFilterMediaType.Clips ||
      mediaType === MediaFilterMediaType.Snapshots
    ) {
      const where = getArrayValueAsSet(this._refWhere.value?.value);
      const what = getArrayValueAsSet(this._refWhat.value?.value);
      const tags = getArrayValueAsSet(this._refTags.value?.value);

      const queries = new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: cameraIDs,
          ...(tags && { tags: tags }),
          ...(what && { what: what }),
          ...(where && { where: where }),
          ...(favorite !== null && { favorite: favorite }),
          ...(when && { start: when.start, end: when.end }),
          ...(limit && { limit: limit }),
          ...(mediaType === MediaFilterMediaType.Clips && { hasClip: true }),
          ...(mediaType === MediaFilterMediaType.Snapshots && {
            hasSnapshot: true,
          }),
        },
      ]);

      (
        await executeMediaQueryForView(
          this,
          this.hass,
          this.cameraManager,
          this.view,
          queries,
          {
            // See 'A note on views' above for these two arguments.
            ...(cameraIDs.size === 1 && { targetCameraID: [...cameraIDs][0] }),
            targetView: mediaType === MediaFilterMediaType.Clips ? 'clips' : 'snapshots',
          },
        )
      )?.dispatchChangeEvent(this);
    } else if (mediaType === MediaFilterMediaType.Recordings) {
      const queries = new RecordingMediaQueries([
        {
          type: QueryType.Recording,
          cameraIDs: cameraIDs,
          ...(limit && { limit: limit }),
          ...(when && { start: when.start, end: when.end }),
        },
      ]);

      (
        await executeMediaQueryForView(
          this,
          this.hass,
          this.cameraManager,
          this.view,
          queries,
          {
            // See 'A note on views' above for these two arguments.
            ...(cameraIDs.size === 1 && { targetCameraID: [...cameraIDs][0] }),
            targetView: 'recordings',
          },
        )
      )?.dispatchChangeEvent(this);
    }
  }

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('cameraManager')) {
      const cameras = this.cameraManager?.getStore().getVisibleCameras();
      if (cameras) {
        this._cameraOptions = Array.from(cameras.keys()).map((cameraID) => ({
          value: cameraID,
          label: this.hass
            ? this.cameraManager?.getCameraMetadata(this.hass, cameraID)?.title ?? ''
            : '',
        }));
      }
    }

    if (changedProps.has('cameraManager') && this.hass && this.cameraManager) {
      this._mediaMetadataController = new MediaMetadataController(
        this,
        this.hass,
        this.cameraManager,
      );
    }

    // Relative time based options are not pre-computed here to ensure relative
    // dates (e.g. 'today') are always calculated when activated not when
    // rendered.
    this._whenOptions = [
      {
        value: MediaFilterCoreWhen.Today,
        label: localize('media_filter.whens.today'),
      },
      {
        value: MediaFilterCoreWhen.Yesterday,
        label: localize('media_filter.whens.yesterday'),
      },
      {
        value: MediaFilterCoreWhen.PastWeek,
        label: localize('media_filter.whens.past_week'),
      },
      {
        value: MediaFilterCoreWhen.PastMonth,
        label: localize('media_filter.whens.past_month'),
      },
      ...(this._mediaMetadataController?.whenOptions ?? []),
    ];

    if (changedProps.has('view')) {
      const newDefaults = this._getDefaultsFromView();
      if (!isEqual(newDefaults, this._defaults)) {
        this._defaults = newDefaults;
      }
    }
  }

  protected _getDefaultsFromView(): MediaFilterCoreDefaults | null {
    const queries = this.view?.query?.getQueries();
    const cameras = this.cameraManager?.getStore().getVisibleCameras();
    if (!this.view || !queries || !cameras) {
      return null;
    }

    let mediaType: MediaFilterMediaType | undefined;
    let cameraIDs: string[] | undefined;
    let what: string[] | undefined;
    let where: string[] | undefined;
    let favorite: MediaFilterCoreFavoriteSelection | undefined;
    let tags: string[] | undefined;

    const cameraIDSets = uniqWith(
      queries.map((query: DataQuery) => query.cameraIDs),
      isEqual,
    );
    // Special note: If all visible cameras are selected, this is the same as no
    // selector at all.
    if (cameraIDSets.length === 1 && !isEqual(queries[0].cameraIDs, cameras)) {
      cameraIDs = [...queries[0].cameraIDs];
    }

    const favoriteValues = uniqWith(
      queries.map((query) => query.favorite),
      isEqual,
    );
    if (favoriteValues.length === 1 && queries[0].favorite !== undefined) {
      favorite = queries[0].favorite
        ? MediaFilterCoreFavoriteSelection.Favorite
        : MediaFilterCoreFavoriteSelection.NotFavorite;
    }

    if (MediaQueriesClassifier.areEventQueries(this.view.query)) {
      const queries = this.view.query.getQueries();
      if (!queries) {
        return null;
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

      const whatSets = uniqWith(
        queries.map((query) => query.what),
        isEqual,
      );
      if (whatSets.length === 1 && queries[0].what?.size) {
        what = [...queries[0].what];
      }
      const whereSets = uniqWith(
        queries.map((query) => query.where),
        isEqual,
      );
      if (whereSets.length === 1 && queries[0].where?.size) {
        where = [...queries[0].where];
      }
      const tagsSets = uniqWith(
        queries.map((query) => query.tags),
        isEqual,
      );
      if (tagsSets.length === 1 && queries[0].tags?.size) {
        tags = [...queries[0].tags];
      }
    } else if (MediaQueriesClassifier.areRecordingQueries(this.view.query)) {
      mediaType = MediaFilterMediaType.Recordings;
    }

    return {
      ...(mediaType && { mediaType: mediaType }),
      ...(cameraIDs && { cameraIDs: cameraIDs }),
      ...(what && { what: what }),
      ...(where && { where: where }),
      ...(favorite !== undefined && { favorite: favorite }),
      ...(tags && { tags: tags })
    };
  }

  protected render(): TemplateResult | void {
    if (!this._mediaMetadataController) {
      return;
    }

    const areEvents = !!(
      this.view?.query && MediaQueriesClassifier.areEventQueries(this.view.query)
    );
    const areRecordings = !!(
      this.view?.query && MediaQueriesClassifier.areRecordingQueries(this.view.query)
    );
    const managerCapabilities = this.cameraManager?.getAggregateCameraCapabilities();

    // Which media controls are shown depends on the view.
    const showFavoriteControl = areEvents
      ? !!managerCapabilities?.canFavoriteEvents
      : areRecordings
      ? !!managerCapabilities?.canFavoriteRecordings
      : false;

    return html` <frigate-card-select
        ${ref(this._refMediaType)}
        label=${localize('media_filter.media_type')}
        placeholder=${localize('media_filter.select_media_type')}
        .options=${this._mediaTypeOptions}
        .value=${this._defaults?.mediaType}
        @frigate-card:select:change=${this._valueChangedHandler.bind(this)}
      >
      </frigate-card-select>
      <frigate-card-select
        ${ref(this._refWhen)}
        .label=${localize('media_filter.when')}
        placeholder=${localize('media_filter.select_when')}
        .options=${this._whenOptions}
        .value=${this._defaults?.when}
        clearable
        @frigate-card:select:change=${this._valueChangedHandler.bind(this)}
      >
      </frigate-card-select>
      <frigate-card-select
        ${ref(this._refCamera)}
        .label=${localize('media_filter.camera')}
        placeholder=${localize('media_filter.select_camera')}
        .options=${this._cameraOptions}
        .value=${this._defaults?.cameraIDs}
        clearable
        multiple
        @frigate-card:select:change=${this._valueChangedHandler.bind(this)}
      >
      </frigate-card-select>
      ${areEvents && this._mediaMetadataController.whatOptions.length
        ? html` <frigate-card-select
            ${ref(this._refWhat)}
            label=${localize('media_filter.what')}
            placeholder=${localize('media_filter.select_what')}
            clearable
            multiple
            .options=${this._mediaMetadataController.whatOptions}
            .value=${this._defaults?.what}
            @frigate-card:select:change=${this._valueChangedHandler.bind(this)}
          >
          </frigate-card-select>`
        : ''}
      ${areEvents && this._mediaMetadataController.tagsOptions.length
          ? html` <frigate-card-select
              ${ref(this._refTags)}
              label=${localize('media_filter.tag')}
              placeholder=${localize('media_filter.select_tag')}
              clearable
              multiple
              .options=${this._mediaMetadataController.tagsOptions}
              .value=${this._defaults?.tags}
              @frigate-card:select:change=${this._valueChangedHandler.bind(this)}
            >
            </frigate-card-select>`
          : ''}
      ${areEvents && this._mediaMetadataController.whereOptions.length
        ? html` <frigate-card-select
            ${ref(this._refWhere)}
            label=${localize('media_filter.where')}
            placeholder=${localize('media_filter.select_where')}
            clearable
            multiple
            .options=${this._mediaMetadataController.whereOptions}
            .value=${this._defaults?.where}
            @frigate-card:select:change=${this._valueChangedHandler.bind(this)}
          >
          </frigate-card-select>`
        : ''}
      ${showFavoriteControl
        ? html`
            <frigate-card-select
              ${ref(this._refFavorite)}
              label=${localize('media_filter.favorite')}
              placeholder=${localize('media_filter.select_favorite')}
              .options=${this._favoriteOptions}
              .value=${this._defaults?.favorite}
              clearable
              @frigate-card:select:change=${this._valueChangedHandler.bind(this)}
            >
            </frigate-card-select>
          `
        : ''}`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(mediaFilterStyle);
  }
}

export class MediaMetadataController implements ReactiveController {
  protected _host: ReactiveControllerHost;
  protected _hass: HomeAssistant;
  protected _cameraManager: CameraManager;

  public tagsOptions: SelectOption[] = [];
  public whenOptions: SelectOption[] = [];
  public whatOptions: SelectOption[] = [];
  public whereOptions: SelectOption[] = [];

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

  protected _dateRangeToString(when: DateRange): string {
    return `${formatDate(when.start)},${formatDate(when.end)}`;
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
    if (metadata.tags) {
      this.tagsOptions = [...metadata.tags]
        .sort()
        .map((tag) => ({ value: tag, label: prettifyTitle(tag) }));
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
      this.whenOptions = orderBy(monthStarts, (date) => date.getTime(), 'desc').map(
        (monthStart) => ({
          label: format(monthStart, 'MMMM yyyy'),
          value: this._dateRangeToString({
            start: monthStart,
            end: endOfMonth(monthStart),
          }),
        }),
      );
    }
    this._host.requestUpdate();
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-media-filter': FrigateCardMediaFilter;
  }
}
