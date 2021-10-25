import { HomeAssistant } from 'custom-card-helpers';
import { homeAssistantWSRequest } from './common.js';
import {
  BrowseMediaSource,
  ExtendedHomeAssistant,
  ResolvedMedia,
  resolvedMediaSchema,
} from './types.js';

export class ResolvedMediaCache {
  protected _cache: Record<string, ResolvedMedia>;

  constructor() {
    this._cache = {};
  }

  public has(id: string): boolean {
    return id in this._cache;
  }

  public get(id: string): ResolvedMedia | undefined {
    return this._cache[id];
  }

  public set(id: string, resolvedMedia: ResolvedMedia): void {
    this._cache[id] = resolvedMedia;
  }
}

export class ResolvedMediaUtil {
  static async resolveMedia(
    hass: HomeAssistant & ExtendedHomeAssistant,
    mediaSource?: BrowseMediaSource,
    cache?: ResolvedMediaCache,
  ): Promise<ResolvedMedia | null> {
    if (!mediaSource) {
      return null;
    }
    const cachedValue = cache ? cache.get(mediaSource.media_content_id) : undefined;
    if (cachedValue) {
      return cachedValue;
    }
    const request = {
      type: 'media_source/resolve_media',
      media_content_id: mediaSource.media_content_id,
    };
    const resolvedMedia = await homeAssistantWSRequest(
      hass,
      resolvedMediaSchema,
      request,
    );
    if (cache && resolvedMedia) {
      cache.set(mediaSource.media_content_id, resolvedMedia);
    }
    return resolvedMedia;
  }
}
