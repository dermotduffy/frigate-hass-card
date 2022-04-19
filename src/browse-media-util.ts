import { HomeAssistant } from 'custom-card-helpers';

import type {
  BrowseMediaQueryParametersBase,
  BrowseMediaQueryParameters,
  FrigateBrowseMediaSource,
  CameraConfig,
} from './types.js';
import { View } from './view.js';
import { frigateBrowseMediaSourceSchema } from './types.js';
import {
  dispatchErrorMessageEvent,
  dispatchMessageEvent,
  homeAssistantWSRequest,
} from './common.js';
import { localize } from './localize/localize.js';

export class BrowseMediaUtil {
  /**
   * Return the Frigate event_id given a FrigateBrowseMediaSource object.
   * @param media The event to get the id from.
   * @returns The `event_id` or `null` if not successfully parsed.
   */
  static getEventID(media: FrigateBrowseMediaSource): string | null {
    return media.frigate?.event.id ?? null;
  }

  /**
   * Return the event start time given a FrigateBrowseMediaSource object.
   * @param browseMedia The media object to get the start time from.
   * @returns The start time in unix/epoch time, or null if it cannot be determined.
   */
  static getEventStartTime(media: FrigateBrowseMediaSource): number | null {
    return media.frigate?.event.start_time ?? null;
  }

  /**
   * Determine if a FrigateBrowseMediaSource object is truly a media item (vs a folder).
   * @param media The media object.
   * @returns `true` if it's truly a media item, `false` otherwise.
   */
  static isTrueMedia(media?: FrigateBrowseMediaSource): boolean {
    return !!media && !media.can_expand;
  }

  /**
   * From a FrigateBrowseMediaSource item extract the first true media item from the
   * children (i.e. a clip/snapshot, not a folder).
   * @param media The media object with children.
   * @returns The first true media item found.
   */
  static getFirstTrueMediaChildIndex(
    media: FrigateBrowseMediaSource | null,
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
   * @returns A FrigateBrowseMediaSource object or null on malformed.
   */
  static async browseMedia(
    hass: HomeAssistant,
    media_content_id: string,
  ): Promise<FrigateBrowseMediaSource> {
    const request = {
      type: 'media_source/browse_media',
      media_content_id: media_content_id,
    };
    return homeAssistantWSRequest(hass, frigateBrowseMediaSourceSchema, request);
  }

  // Browse Frigate media with query parameters.

  /**
   * Browse Frigate media with a media query. May throw.
   * @param hass The HomeAssistant object.
   * @param params The search parameters to use to search for media.
   * @returns A FrigateBrowseMediaSource object or null on malformed.
   */
  static async browseMediaQuery(
    hass: HomeAssistant,
    params: BrowseMediaQueryParameters,
  ): Promise<FrigateBrowseMediaSource> {
    return this.browseMedia(
      hass,
      // Defined in:
      // https://github.com/blakeblackshear/frigate-hass-integration/blob/master/custom_components/frigate/media_source.py
      [
        'media-source://frigate',
        params.clientId,
        'event-search',
        params.mediaType,

        // If the name field ends in '.all' the integration will return up to 10K events.
        params.unlimited ? '.all' : '',
        params.after ? String(Math.floor(params.after)) : '',
        params.before ? String(Math.ceil(params.before)) : '',
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
  static getBrowseMediaQueryParametersBase(
    cameraConfig?: CameraConfig,
  ): BrowseMediaQueryParametersBase | null {
    if (!cameraConfig || !cameraConfig.camera_name) {
      return null;
    }
    return {
      clientId: cameraConfig.client_id,
      cameraName: cameraConfig.camera_name,
      label: cameraConfig.label,
      zone: cameraConfig.zone,
    };
  }

  /**
   * Set the mediaType parameter from the current view.
   * @param browseMediaQueryParametersBase The base media query parameters object.
   * @param view The current view.
   * @returns A fully populated BrowseMediaQueryParameters or null.
   */
  static setMediaTypeFromView(
    browseMediaQueryParametersBase: BrowseMediaQueryParametersBase | null,
    view: View,
  ): BrowseMediaQueryParameters | null {
    if (
      !browseMediaQueryParametersBase ||
      !(view.isClipRelatedView() || view.isSnapshotRelatedView())
    ) {
      return null;
    }
    return {
      ...browseMediaQueryParametersBase,
      mediaType: view.isClipRelatedView() ? 'clips' : 'snapshots',
    };
  }

  /**
   * Get the parameters to search for media related to the current view.
   * @returns A BrowseMediaQueryParameters object.
   */
  static getBrowseMediaQueryParametersBaseOrDispatchError(
    node: HTMLElement,
    cameraConfig: CameraConfig,
  ): BrowseMediaQueryParametersBase | null {
    // Verify there is a camera name, otherwise getBrowseMediaQueryParametersBase()
    // will return undefined.
    if (!cameraConfig.camera_name) {
      dispatchErrorMessageEvent(
        node,
        localize('error.no_camera_name') + `: ${JSON.stringify(cameraConfig)}`,
      );
      return null;
    }

    return BrowseMediaUtil.getBrowseMediaQueryParametersBase(cameraConfig);
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
    hass: HomeAssistant,
    view: Readonly<View>,
    browseMediaQueryParameters: BrowseMediaQueryParameters,
  ): Promise<void> {
    let parent: FrigateBrowseMediaSource | null;
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
   * Fetch the media of a child FrigateBrowseMediaSource object and dispatch a change
   * view event to reflect the results.
   * @param node The HTMLElement to dispatch events from.
   * @param hass The Home Assistant object.
   * @param view The current view to evolve.
   * @param child The FrigateBrowseMediaSource child to query for.
   * @returns
   */
  static async fetchChildMediaAndDispatchViewChange(
    node: HTMLElement,
    hass: HomeAssistant,
    view: Readonly<View>,
    child: Readonly<FrigateBrowseMediaSource>,
  ): Promise<void> {
    let parent: FrigateBrowseMediaSource;
    try {
      parent = await BrowseMediaUtil.browseMedia(hass, child.media_content_id);
    } catch (e) {
      return dispatchErrorMessageEvent(node, (e as Error).message);
    }

    view
      .evolve({
        target: parent,
      })
      .dispatchChangeEvent(node);
  }
}
