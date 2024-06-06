import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { CameraConfig } from '../../config/types';
import { ExtendedHomeAssistant } from '../../types';
import { canonicalizeHAURL } from '../../utils/ha';
import { BrowseMediaManager } from '../../utils/ha/browse-media/browse-media-manager';
import {
  BROWSE_MEDIA_CACHE_SECONDS,
  MEDIA_CLASS_IMAGE,
  MEDIA_CLASS_VIDEO,
  RichBrowseMedia,
} from '../../utils/ha/browse-media/types';
import { EntityRegistryManager } from '../../utils/ha/entity-registry';
import { ResolvedMediaCache, resolveMedia } from '../../utils/ha/resolved-media';
import { ViewMedia } from '../../view/media';
import { RequestCache } from '../cache';
import { Camera } from '../camera';
import { Capabilities } from '../capabilities';
import { CameraManagerEngine } from '../engine';
import { GenericCameraManagerEngine } from '../generic/engine-generic';
import { rangesOverlap } from '../range';
import { CameraManagerReadOnlyConfigStore } from '../store';
import {
  CameraEndpoint,
  CameraEventCallback,
  CameraManagerMediaCapabilities,
  DataQuery,
  EventQuery,
  PartialEventQuery,
  QueryType,
} from '../types';
import { BrowseMediaCamera } from './camera';
import { BrowseMediaViewMediaFactory } from './media';
import { BrowseMediaMetadata } from './types';
import { getPTZCapabilitiesFromCameraConfig } from '../utils/ptz';

/**
 * A utility method to determine if a browse media object matches against a
 * start and end date.
 * @param media The browse media object (with rich metadata).
 * @param start The optional start date.
 * @param end The optional end date.
 * @returns `true` if the media falls within the provided dates.
 */
export const isMediaWithinDates = (
  media: RichBrowseMedia<BrowseMediaMetadata>,
  start?: Date,
  end?: Date,
): boolean => {
  // If no date is specified at all, everything matches.
  const dateReference = start ?? end;
  if (!dateReference) {
    return true;
  }

  // If there's no metadata, nothing matches.
  if (!media._metadata) {
    return false;
  }

  // Determine if:
  // - The media starts within the query timeframe.
  // - The media ends within the query timeframe.
  // - The media entirely encompasses the query timeframe.
  return rangesOverlap(
    {
      start: media._metadata.startDate,
      end: media._metadata.endDate,
    },
    {
      start: start ?? dateReference,
      end: end ?? dateReference,
    },
  );
};

export const getViewMediaFromBrowseMediaArray = (
  browseMedia: RichBrowseMedia<BrowseMediaMetadata>[],
): ViewMedia[] | null => {
  const lookup: Map<string, ViewMedia> = new Map();
  for (const browseMediaItem of browseMedia) {
    const cameraID = browseMediaItem._metadata?.cameraID;
    if (!cameraID) {
      continue;
    }

    const mediaType =
      browseMediaItem.media_class === MEDIA_CLASS_VIDEO
        ? 'clip'
        : browseMediaItem.media_class === MEDIA_CLASS_IMAGE
        ? 'snapshot'
        : null;

    if (!mediaType) {
      continue;
    }
    const media = BrowseMediaViewMediaFactory.createEventViewMedia(
      mediaType,
      browseMediaItem,
      cameraID,
    );

    if (media) {
      const id = media.getID();
      const existing = lookup.get(id);
      // De-duplicate events with precisely the same ID (same
      // hour/minute/second) choosing clip > snapshot.
      if (
        !existing ||
        (existing.getMediaType() === 'snapshot' && media.getMediaType() === 'clip')
      ) {
        lookup.set(id, media);
      }
    }
  }
  return [...lookup.values()];
};

/**
 * A base class for cameras that read events from HA BrowseMedia interface.
 */
export class BrowseMediaCameraManagerEngine
  extends GenericCameraManagerEngine
  implements CameraManagerEngine
{
  protected _browseMediaManager: BrowseMediaManager<BrowseMediaMetadata>;
  protected _resolvedMediaCache: ResolvedMediaCache;
  protected _requestCache: RequestCache;

  public constructor(
    browseMediaManager: BrowseMediaManager<BrowseMediaMetadata>,
    resolvedMediaCache: ResolvedMediaCache,
    requestCache: RequestCache,
    eventCallback?: CameraEventCallback,
  ) {
    super(eventCallback);
    this._browseMediaManager = browseMediaManager;
    this._resolvedMediaCache = resolvedMediaCache;
    this._requestCache = requestCache;
  }

  public async createCamera(
    hass: HomeAssistant,
    entityRegistryManager: EntityRegistryManager,
    cameraConfig: CameraConfig,
  ): Promise<Camera> {
    const camera = new BrowseMediaCamera(cameraConfig, this, {
      capabilities: new Capabilities(
        {
          'favorite-events': false,
          'favorite-recordings': false,
          clips: true,
          live: true,
          menu: true,
          recordings: false,
          seek: false,
          snapshots: true,
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
    return await camera.initialize(hass, entityRegistryManager);
  }

  public generateDefaultEventQuery(
    _store: CameraManagerReadOnlyConfigStore,
    cameraIDs: Set<string>,
    query: PartialEventQuery,
  ): EventQuery[] | null {
    return [
      {
        type: QueryType.Event,
        cameraIDs: cameraIDs,
        ...query,
      },
    ];
  }

  public async getMediaDownloadPath(
    hass: ExtendedHomeAssistant,
    _cameraConfig: CameraConfig,
    media: ViewMedia,
  ): Promise<CameraEndpoint | null> {
    const contentID = media.getContentID();
    if (!contentID) {
      return null;
    }
    const resolvedMedia = await resolveMedia(hass, contentID, this._resolvedMediaCache);
    return resolvedMedia
      ? { endpoint: canonicalizeHAURL(hass, resolvedMedia.url) }
      : null;
  }

  public getQueryResultMaxAge(query: DataQuery): number | null {
    if (query.type === QueryType.Event) {
      return BROWSE_MEDIA_CACHE_SECONDS;
    }
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public getMediaCapabilities(_media: ViewMedia): CameraManagerMediaCapabilities {
    return {
      canFavorite: false,
      canDownload: true,
    };
  }
}
