import type { BrowseMediaQueryParameters, BrowseMediaSource, ExtendedHomeAssistant } from './types.js';
import { HomeAssistant } from 'custom-card-helpers';
import { homeAssistantWSRequest } from './common.js';
import { browseMediaSourceSchema } from './types.js';

import dayjs from 'dayjs';
import dayjs_custom_parse_format from 'dayjs/plugin/customParseFormat.js';
  
dayjs.extend(dayjs_custom_parse_format);

export class BrowseMediaUtil {
  /**
   * Return the Frigate event_id given a BrowseMediaSource object.
   * @param media The event to extract the id from.
   * @returns The `event_id` or `null` if not successfully parsed.
   */
  static extractEventID(media: BrowseMediaSource): string | null {
    const result = media.media_content_id.match(
      /^media-source:\/\/frigate\/.*\/(?<id>[.0-9]+-[a-zA-Z0-9]+)$/);
    return result && result.groups ? result.groups['id'] : null;
  }

  /**
   * Return the event start time given a BrowseMediaSource object.
   * @param browseMedia The media object to extract the start time from.
   * @returns The start time in unix/epoch time, or null if it cannot be determined.
   */
   static extractEventStartTime(
    browseMedia: BrowseMediaSource,
  ): number | null {
    // Example: 2021-08-27 20:57:22 [10s, Person 76%]
    const result = browseMedia.title.match(/^(?<iso_datetime>.+) \[/);
    if (result && result.groups) {
      const iso_datetime_str = result.groups['iso_datetime'];
      if (iso_datetime_str) {
        const iso_datetime = dayjs(iso_datetime_str, 'YYYY-MM-DD HH:mm:ss', true);
        if (iso_datetime.isValid()) {
          return iso_datetime.unix();
        }
      }
    }
    return null;
  }

  /**
   * Determine if a BrowseMediaSource object is truly a media item (vs a folder).
   * @param media The media object.
   * @returns `true` if it's truly a media item, `false` otherwise.
   */
  static isTrueMedia(media: BrowseMediaSource): boolean {
    return !media.can_expand;
  }

  /**
   * From a BrowseMediaSource item extract the first true media item from the
   * children (i.e. a clip/snapshot, not a folder).
   * @param media The media object with children.
   * @returns The first true media item found.
   */
  static getFirstTrueMediaChildIndex(
    media: BrowseMediaSource | null,
  ): number | null {
    if (!media || !media.children) {
      return null;
    }
    const index = media.children.findIndex((child) => this.isTrueMedia(child));
    return index >= 0 ? index : null;
  }
  
  /**
   * Browse Frigate media with a media content id. May throw.
   * @param hass The HomeAssistant object.
   * @param media_content_id The media content id to browse.
   * @returns A BrowseMediaSource object or null on malformed.
   */
  static async browseMedia(
    hass: (HomeAssistant & ExtendedHomeAssistant) | null,
    media_content_id: string,
  ): Promise<BrowseMediaSource | null> {
    if (!hass) {
      return null;
    }
    const request = {
      type: 'media_source/browse_media',
      media_content_id: media_content_id,
    };
    return homeAssistantWSRequest(hass, browseMediaSourceSchema, request);
  }
  
  // Browse Frigate media with query parameters.

  /**
   * Browse Frigate media with a media query. May throw.
   * @param hass The HomeAssistant object.
   * @param params The search parameters to use to search for media.
   * @returns A BrowseMediaSource object or null on malformed.
   */
  static async browseMediaQuery(
    hass: HomeAssistant & ExtendedHomeAssistant,
    params: BrowseMediaQueryParameters,
  ): Promise<BrowseMediaSource | null> {
    return this.browseMedia(
      hass,
      // Defined in:
      // https://github.com/blakeblackshear/frigate-hass-integration/blob/master/custom_components/frigate/media_source.py
      [
        'media-source://frigate',
        params.clientId,
        'event-search',
        params.mediaType,
        '', // Name/Title to render (not necessary here)
        params.after ? String(params.after) : '',
        params.before ? String(params.before) : '',
        params.cameraName,
        params.label,
        params.zone,
      ].join('/'),
    );
  }
}
