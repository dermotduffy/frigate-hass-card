import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { add, endOfDay, parse, startOfDay } from 'date-fns';
import { orderBy } from 'lodash-es';
import { CameraConfig } from '../../config/types';
import { allPromises, formatDate, isValidDate } from '../../utils/basic';
import { sortMediaByStartDate } from '../../utils/ha/browse-media/browse-media-manager';
import {
  BROWSE_MEDIA_CACHE_SECONDS,
  BrowseMedia,
  MEDIA_CLASS_VIDEO,
  RichBrowseMedia,
} from '../../utils/ha/browse-media/types';
import { ViewMedia } from '../../view/media';
import { BrowseMediaCameraManagerEngine } from '../browse-media/engine-browse-media';
import { BrowseMediaMetadata } from '../browse-media/types';
import { getViewMediaFromBrowseMediaArray } from '../browse-media/utils/browse-media-to-view-media';
import { isMediaWithinDates } from '../browse-media/utils/within-dates';
import { MemoryRequestCache } from '../cache';
import { Camera } from '../camera';
import { Capabilities } from '../capabilities';
import { CAMERA_MANAGER_ENGINE_EVENT_LIMIT_DEFAULT } from '../engine';
import { CameraManagerReadOnlyConfigStore } from '../store';
import {
  CameraEndpoint,
  CameraEndpoints,
  CameraEndpointsContext,
  CameraManagerCameraMetadata,
  Engine,
  EngineOptions,
  EventQuery,
  EventQueryResults,
  EventQueryResultsMap,
  MediaMetadataQuery,
  MediaMetadataQueryResults,
  MediaMetadataQueryResultsMap,
  QueryResults,
  QueryResultsType,
  QueryReturnType,
} from '../types';
import { getPTZCapabilitiesFromCameraConfig } from '../utils/ptz';
import reolinkLogo from './assets/reolink.svg';
import { ReolinkCamera } from './camera';
import { ReolinkEventQueryResults } from './types';

export class ReolinkQueryResultsClassifier {
  public static isReolinkEventQueryResults(
    results: QueryResults,
  ): results is ReolinkEventQueryResults {
    return results.engine === Engine.Reolink && results.type === QueryResultsType.Event;
  }
}

export class ReolinkCameraManagerEngine extends BrowseMediaCameraManagerEngine {
  protected _directoryCache = new MemoryRequestCache<string, BrowseMedia>();
  protected _fileCache = new MemoryRequestCache<string, BrowseMedia>();

  public getEngineType(): Engine {
    return Engine.Reolink;
  }

  protected _reolinkFileMetadataGenerator(
    cameraID: string,
    media: BrowseMedia,
    parent?: RichBrowseMedia<BrowseMediaMetadata>,
  ): BrowseMediaMetadata | null {
    /* istanbul ignore next: This situation cannot happen as the directory would
    be rejected by _reolinkDirectoryMetadataGenerator if there was no start date
    -- @preserve */
    if (!parent?._metadata?.startDate || media.media_class !== MEDIA_CLASS_VIDEO) {
      return null;
    }

    // Title of the form "21:47:03 0:00:44"
    const parts = media.title.split(/ +/);
    if (parts.length !== 2) {
      return null;
    }

    const startDate = parse(parts[0], 'HH:mm:ss', parent._metadata.startDate);
    if (!isValidDate(startDate)) {
      return null;
    }

    const durationMatch = parts[1].match(
      /(?<hours>\d+):(?<minutes>\d+):(?<seconds>\d+)/,
    );
    const duration = durationMatch?.groups
      ? {
          hours: Number(durationMatch.groups.hours),
          minutes: Number(durationMatch.groups.minutes),
          seconds: Number(durationMatch.groups.seconds),
        }
      : null;

    return {
      cameraID: cameraID,
      startDate: startDate,
      endDate: duration ? add(startDate, duration) : startDate,
    };
  }

  protected _reolinkDirectoryMetadataGenerator(
    cameraID: string,
    media: BrowseMedia,
  ): BrowseMediaMetadata | null {
    // Title of the form: "2024/9/29"
    const parsedDate = parse(media.title, 'yyyy/M/d', new Date());

    return isValidDate(parsedDate)
      ? {
          cameraID: cameraID,
          startDate: startOfDay(parsedDate),
          endDate: endOfDay(parsedDate),
        }
      : null;
  }

  public async createCamera(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
  ): Promise<Camera> {
    const camera = new ReolinkCamera(cameraConfig, this, {
      capabilities: new Capabilities(
        {
          'favorite-events': false,
          'favorite-recordings': false,
          clips: true,
          live: true,
          menu: true,
          recordings: false,
          seek: false,
          snapshots: false,
          substream: true,
          ptz: getPTZCapabilitiesFromCameraConfig(cameraConfig) ?? undefined,
        },
        {
          disable: cameraConfig.capabilities?.disable,
          disableExcept: cameraConfig.capabilities?.disable_except,
        },
      ),
      eventCallback: this._eventCallback,
    });
    return await camera.initialize({
      entityRegistryManager: this._entityRegistryManager,
      hass,
      stateWatcher: this._stateWatcher,
    });
  }

  protected async _getMatchingDirectories(
    hass: HomeAssistant,
    camera: ReolinkCamera,
    matchOptions?: {
      start?: Date;
      end?: Date;
    } | null,
    engineOptions?: EngineOptions,
  ): Promise<RichBrowseMedia<BrowseMediaMetadata>[] | null> {
    const cameraConfig = camera.getConfig();
    const entity = camera.getEntity();
    const configID = entity?.config_entry_id;

    if (camera.getChannel() === null || !configID) {
      return null;
    }

    return await this._browseMediaManager.walkBrowseMedias(
      hass,
      [
        {
          targets: [
            `media-source://reolink/RES|${configID}|${camera.getChannel()}|` +
              `${cameraConfig.reolink?.media_resolution === 'low' ? 'sub' : 'main'}`,
          ],
          concurrency: Infinity,
          metadataGenerator: (
            media: BrowseMedia,
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            _parent?: RichBrowseMedia<BrowseMediaMetadata>,
          ) => this._reolinkDirectoryMetadataGenerator(camera.getID(), media),
          matcher: (media: RichBrowseMedia<BrowseMediaMetadata>) =>
            media.can_expand &&
            isMediaWithinDates(media, matchOptions?.start, matchOptions?.end),
          sorter: (media: RichBrowseMedia<BrowseMediaMetadata>[]) =>
            sortMediaByStartDate(media),
        },
      ],
      {
        ...(engineOptions?.useCache !== false && { cache: this._directoryCache }),
      },
    );
  }

  public async getEvents(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    query: EventQuery,
    engineOptions?: EngineOptions,
  ): Promise<EventQueryResultsMap | null> {
    // Reolink does not support these query types and they will never match.
    if (
      query.favorite ||
      query.tags?.size ||
      query.what?.size ||
      query.where?.size ||
      query.hasSnapshot
    ) {
      return null;
    }

    const output: EventQueryResultsMap = new Map();
    const getEventsForCamera = async (cameraID: string): Promise<void> => {
      const perCameraQuery = { ...query, cameraIDs: new Set([cameraID]) };
      const cachedResult =
        engineOptions?.useCache ?? true ? this._requestCache.get(perCameraQuery) : null;
      if (cachedResult) {
        output.set(perCameraQuery, cachedResult as EventQueryResults);
        return;
      }

      const camera = store.getCamera(cameraID);
      const directories =
        camera && camera instanceof ReolinkCamera
          ? await this._getMatchingDirectories(
              hass,
              camera,
              perCameraQuery,
              engineOptions,
            )
          : null;
      const limit = perCameraQuery.limit ?? CAMERA_MANAGER_ENGINE_EVENT_LIMIT_DEFAULT;
      let media: RichBrowseMedia<BrowseMediaMetadata>[] = [];

      if (directories?.length) {
        media = await this._browseMediaManager.walkBrowseMedias(
          hass,
          [
            {
              targets: directories,
              concurrency: 1,
              metadataGenerator: (
                media: BrowseMedia,
                parent?: RichBrowseMedia<BrowseMediaMetadata>,
              ) => this._reolinkFileMetadataGenerator(cameraID, media, parent),
              earlyExit: (media) => media.length >= limit,
              matcher: (media: RichBrowseMedia<BrowseMediaMetadata>) =>
                !media.can_expand &&
                isMediaWithinDates(media, perCameraQuery.start, perCameraQuery.end),
              sorter: (media: RichBrowseMedia<BrowseMediaMetadata>[]) =>
                sortMediaByStartDate(media),
            },
          ],
          {
            ...(engineOptions?.useCache !== false && { cache: this._fileCache }),
          },
        );
      }

      // Sort by most recent then slice at the query limit.
      const sortedMedia = orderBy(
        media,
        (media: RichBrowseMedia<BrowseMediaMetadata>) => media._metadata?.startDate,
        'desc',
      ).slice(0, limit);

      const result: ReolinkEventQueryResults = {
        type: QueryResultsType.Event,
        engine: Engine.Reolink,
        browseMedia: sortedMedia,
      };

      if (engineOptions?.useCache ?? true) {
        this._requestCache.set(
          perCameraQuery,
          { ...result, cached: true },
          result.expiry,
        );
      }
      output.set(perCameraQuery, result);
    };

    await allPromises(query.cameraIDs, (cameraID) => getEventsForCamera(cameraID));
    return output;
  }

  public generateMediaFromEvents(
    _hass: HomeAssistant,
    _store: CameraManagerReadOnlyConfigStore,
    _query: EventQuery,
    results: QueryReturnType<EventQuery>,
  ): ViewMedia[] | null {
    if (!ReolinkQueryResultsClassifier.isReolinkEventQueryResults(results)) {
      return null;
    }
    return getViewMediaFromBrowseMediaArray(results.browseMedia);
  }

  public async getMediaMetadata(
    hass: HomeAssistant,
    store: CameraManagerReadOnlyConfigStore,
    query: MediaMetadataQuery,
    engineOptions?: EngineOptions,
  ): Promise<MediaMetadataQueryResultsMap | null> {
    const output: MediaMetadataQueryResultsMap = new Map();
    const cachedResult =
      engineOptions?.useCache ?? true ? this._requestCache.get(query) : null;

    if (cachedResult) {
      output.set(query, cachedResult as MediaMetadataQueryResults);
      return output;
    }

    const days: Set<string> = new Set();
    const getDaysForCamera = async (cameraID: string): Promise<void> => {
      const camera = store.getCamera(cameraID);
      if (!camera || !(camera instanceof ReolinkCamera)) {
        return;
      }
      const directories = await this._getMatchingDirectories(
        hass,
        camera,
        null,
        engineOptions,
      );
      for (const dayDirectory of directories ?? []) {
        /* istanbul ignore next: This situation cannot happen as the directory
        will not match without metadata -- @preserve */
        if (dayDirectory._metadata) {
          days.add(formatDate(dayDirectory._metadata?.startDate));
        }
      }
    };

    await allPromises(query.cameraIDs, (cameraID) => getDaysForCamera(cameraID));

    const result: MediaMetadataQueryResults = {
      type: QueryResultsType.MediaMetadata,
      engine: Engine.Reolink,
      metadata: {
        ...(days.size && { days: days }),
      },
      expiry: add(new Date(), { seconds: BROWSE_MEDIA_CACHE_SECONDS }),
      cached: false,
    };

    if (engineOptions?.useCache ?? true) {
      this._requestCache.set(query, { ...result, cached: true }, result.expiry);
    }
    output.set(query, result);
    return output;
  }

  public getCameraMetadata(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
  ): CameraManagerCameraMetadata {
    const metadata = super.getCameraMetadata(hass, cameraConfig);
    return {
      ...metadata,
      engineLogo: reolinkLogo,
    };
  }

  public getCameraEndpoints(
    cameraConfig: CameraConfig,
    context?: CameraEndpointsContext,
  ): CameraEndpoints | null {
    const getUIEndpoint = (): CameraEndpoint | null => {
      return cameraConfig.reolink?.url
        ? {
            endpoint: cameraConfig.reolink.url,
          }
        : null;
    };
    const ui = getUIEndpoint();
    return {
      ...super.getCameraEndpoints(cameraConfig, context),
      ...(ui && { ui: ui }),
    };
  }
}
