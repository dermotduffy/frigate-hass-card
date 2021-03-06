import { HomeAssistant } from 'custom-card-helpers';
import dayjs from 'dayjs';
import dayjs_custom_parse_format from 'dayjs/plugin/customParseFormat.js';

import type {
  BrowseMediaQueryParameters,
  BrowseMediaSource,
  CameraConfig,
  ExtendedHomeAssistant,
} from './types.js';
import { View } from './view.js';
import { browseMediaSourceSchema } from './types.js';
import {
  dispatchErrorMessageEvent,
  dispatchMessageEvent,
  homeAssistantWSRequest,
} from './common.js';
import { localize } from './localize/localize.js';

dayjs.extend(dayjs_custom_parse_format);

export class BrowseMediaUtil {
  /**
   * Return the Frigate event_id given a BrowseMediaSource object.
   * @param media The event to extract the id from.
   * @returns The `event_id` or `null` if not successfully parsed.
   */
  static extractEventID(media: BrowseMediaSource): string | null {
    const result = media.media_content_id.match(
      /^media-source:\/\/frigate\/.*\/(?<id>[.0-9]+-[a-zA-Z0-9]+)$/,
    );
    return result && result.groups ? result.groups['id'] : null;
  }

  /**
   * Return the event start time given a BrowseMediaSource object.
   * @param browseMedia The media object to extract the start time from.
   * @returns The start time in unix/epoch time, or null if it cannot be determined.
   */
  static extractEventStartTime(browseMedia: BrowseMediaSource): number | null {
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
  static getFirstTrueMediaChildIndex(media: BrowseMediaSource | null): number | null {
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
    hass: HomeAssistant & ExtendedHomeAssistant,
    media_content_id: string,
  ): Promise<BrowseMediaSource> {
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
  ): Promise<BrowseMediaSource> {
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

  /**
   * Get the parameters to search for media.
   * @returns A BrowseMediaQueryParameters object.
   */
  static getBrowseMediaQueryParameters(
    mediaType: 'clips' | 'snapshots',
    cameraConfig?: CameraConfig,
  ): BrowseMediaQueryParameters | undefined {
    if (!cameraConfig || !cameraConfig.camera_name) {
      return undefined;
    }
    return {
      mediaType: mediaType,
      clientId: cameraConfig.client_id,
      cameraName: cameraConfig.camera_name,
      label: cameraConfig.label,
      zone: cameraConfig.zone,
    };
  }

  /**
   * Get the parameters to search for media related to the current view.
   * @returns A BrowseMediaQueryParameters object.
   */
  static getBrowseMediaQueryParametersOrDispatchError(
    node: HTMLElement,
    view: View,
    cameraConfig: CameraConfig,
  ): BrowseMediaQueryParameters | undefined {
    if (!view.isClipRelatedView() && !view.isSnapshotRelatedView()) {
      return undefined;
    }

    // Verify there is a camera name, otherwise getBrowseMediaQueryParameters()
    // will return undefined.
    if (!cameraConfig.camera_name) {
      dispatchErrorMessageEvent(
        node,
        localize('error.no_camera_name') + `: ${JSON.stringify(cameraConfig)}`,
      );
      return undefined;
    }

    return BrowseMediaUtil.getBrowseMediaQueryParameters(
      view.isClipRelatedView() ? 'clips' : 'snapshots',
      cameraConfig,
    );
  }

  /**
   * Fetch the latest media and dispatch a change view event to reflect the
   * results. If no media is found a suitable message event will be triggered
   * instead.
   * @param node The HTMLElement to dispatch events from.
   * @param hass The Home Assistant object.
   * @param view The current view to evolve.
   * @param browseMediaQueryParameters The media parameters to query with.
   * @returns 
   */
  static async fetchLatestMediaAndDispatchViewChange(
    node: HTMLElement,
    hass: HomeAssistant & ExtendedHomeAssistant,
    view: Readonly<View>,
    browseMediaQueryParameters: BrowseMediaQueryParameters,
  ): Promise<void> {
    let parent: BrowseMediaSource | null;
    try {
      parent = await BrowseMediaUtil.browseMediaQuery(hass, browseMediaQueryParameters);
    } catch (e) {
      return dispatchErrorMessageEvent(node, (e as Error).message);
    }
    const childIndex = BrowseMediaUtil.getFirstTrueMediaChildIndex(parent);
    if (!parent || !parent.children || childIndex == null) {
      return dispatchMessageEvent(
        node,
        browseMediaQueryParameters.mediaType == 'clips'
          ? localize('common.no_clip')
          : localize('common.no_snapshot'),
        browseMediaQueryParameters.mediaType == 'clips'
          ? 'mdi:filmstrip-off'
          : 'mdi:camera-off',
      );
    }

    view
      .evolve({
        target: parent,
        childIndex: childIndex,
      })
      .dispatchChangeEvent(node);
  }

  /**
   * Fetch the media of a child BrowseMediaSource object and dispatch a change
   * view event to reflect the results. 
   * @param node The HTMLElement to dispatch events from.
   * @param hass The Home Assistant object.
   * @param view The current view to evolve.
   * @param child The BrowseMediaSource child to query for.
   * @returns 
   */
  static async fetchChildMediaAndDispatchViewChange(
    node: HTMLElement,
    hass: HomeAssistant & ExtendedHomeAssistant,
    view: Readonly<View>,
    child: Readonly<BrowseMediaSource>,
  ): Promise<void> {
    let parent: BrowseMediaSource;
    try {
      parent = await BrowseMediaUtil.browseMedia(hass, child.media_content_id);
    } catch (e) {
      return dispatchErrorMessageEvent(node, (e as Error).message);
    }

    view
      .evolve({
        target: parent,
        previous: view,
      })
      .dispatchChangeEvent(node);
  }
}
