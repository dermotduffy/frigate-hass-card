import { HomeAssistant } from 'custom-card-helpers';
import QuickLRU from 'quick-lru';
import {
    FrigateBrowseMediaSource,
    ResolvedMedia,
    resolvedMediaSchema
} from '../types.js';
import { homeAssistantWSRequest } from './ha';

// It's important the cache size be at least as large as the largest likely
// media query or media items will from a given query will be evicted for other
// items in the same query (which would result in only partial results being
// returned to the user).
// Note: Each entry is about 400 bytes.
const RESOLVED_MEDIA_CACHE_SIZE = 1000;

export class ResolvedMediaCache {
  protected _cache: QuickLRU<string, ResolvedMedia>;

  constructor() {
    this._cache = new QuickLRU({ maxSize: RESOLVED_MEDIA_CACHE_SIZE });
  }

  public has(id: string): boolean {
    return this._cache.has(id);
  }

  public get(id: string): ResolvedMedia | undefined {
    return this._cache.get(id);
  }

  public set(id: string, resolvedMedia: ResolvedMedia): void {
    this._cache.set(id, resolvedMedia);
  }
}

export class ResolvedMediaUtil {
  static async resolveMedia(
    hass: HomeAssistant,
    mediaSource?: FrigateBrowseMediaSource,
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
