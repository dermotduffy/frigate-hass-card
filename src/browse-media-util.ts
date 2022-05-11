import { HomeAssistant } from 'custom-card-helpers';

import {
  BrowseMediaQueryParameters,
  FrigateBrowseMediaSource,
  CameraConfig,
  MEDIA_CLASS_PLAYLIST,
  MEDIA_TYPE_PLAYLIST,
} from './types.js';
import { View } from './view.js';
import { frigateBrowseMediaSourceSchema } from './types.js';
import {
  dispatchErrorMessageEvent,
  dispatchMessageEvent,
  getCameraTitle,
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
    return await homeAssistantWSRequest(hass, frigateBrowseMediaSourceSchema, request);
  }

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
   * Browse multiple Frigate media queries. May throw.
   * @param hass The HomeAssistant object.
   * @param params An array of search parameters to use to search for media.
   * @returns A map of FrigateBrowseMediaSource object or null on malformed.
   */
  static async multipleBrowseMediaQuery(
    hass: HomeAssistant,
    params: BrowseMediaQueryParameters | BrowseMediaQueryParameters[],
  ): Promise<Map<BrowseMediaQueryParameters, FrigateBrowseMediaSource>> {
    params = Array.isArray(params) ? params : [params];
    const output: Map<BrowseMediaQueryParameters, FrigateBrowseMediaSource> = new Map();
    await Promise.all(
      params.map(async (param: BrowseMediaQueryParameters): Promise<void> => {
        output.set(param, await this.browseMediaQuery(hass, param));
      }),
    );
    return output;
  }

  /**
   * Browse multiple Frigate media queries, then merged them. May throw.
   * @param hass The HomeAssistant object.
   * @param params An array of search parameters to use to search for media.
   * @returns A single FrigateBrowseMediaSource object or null on malformed.
   */
  static async multipleBrowseMediaQueryMerged(
    hass: HomeAssistant,
    params: BrowseMediaQueryParameters | BrowseMediaQueryParameters[],
  ): Promise<FrigateBrowseMediaSource> {
    return this.mergeFrigateBrowseMediaSources(
      await this.multipleBrowseMediaQuery(hass, params),
    );
  }

  /**
   * Merge multiple FrigateBrowseMediaSource into a single. Note that this may
   * use information from the query to differentiate results that may otherwise
   * be identical.
   * @param input A map of query -> result.
   * @returns A single FrigateBrowseMediaSource object.
   */
  static mergeFrigateBrowseMediaSources(
    input: Map<BrowseMediaQueryParameters, FrigateBrowseMediaSource>,
  ): FrigateBrowseMediaSource {
    const children: FrigateBrowseMediaSource[] = [];

    for (const [query, result] of input.entries()) {
      for (const child of result.children || []) {
        if (this.isTrueMedia(child)) {
          children.push(child);
        } else {
          // If there are multiple inputs, separate the folder names with the
          // query title (if available).
          if (query.title && input.size > 1) {
            children.push({ ...child, title: `[${query.title}] ${child.title}` });
          } else {
            children.push(child);
          }
        }
      }
    }

    const eventSort = (
      a: FrigateBrowseMediaSource,
      b: FrigateBrowseMediaSource,
    ): number => {
      if (
        !a.frigate?.event ||
        (b.frigate?.event && b.frigate.event.start_time > a.frigate.event.start_time)
      ) {
        return 1;
      }

      if (
        !b.frigate?.event ||
        (a.frigate?.event && b.frigate.event.start_time < a.frigate.event.start_time)
      ) {
        return -1;
      }
      return 0;
    };

    return this.createEventParentForChildren('Merged events', children.sort(eventSort));
  }

  /**
   * Get the parameters to search for media.
   * @returns A BrowseMediaQueryParameters object.
   */
  static getBrowseMediaQueryParameters(
    hass: HomeAssistant,
    cameraID: string,
    cameraConfig?: CameraConfig,
    overrides?: Partial<BrowseMediaQueryParameters>,
  ): BrowseMediaQueryParameters | null {
    if (!cameraConfig || !cameraConfig.camera_name) {
      return null;
    }
    return {
      clientId: cameraConfig.client_id,
      cameraName: cameraConfig.camera_name,
      label: cameraConfig.label,
      zone: cameraConfig.zone,
      title: getCameraTitle(hass, cameraConfig),
      cameraID: cameraID,
      ...overrides,
    };
  }

  /**
   * Apply overrides to multiple query parameters.
   * @param parameters An array of query parameters.
   * @param overrides The overrides to apply.
   * @returns The override query parameters.
   */
  static overrideMultiBrowseMediaQueryParameters(
    parameters: BrowseMediaQueryParameters[],
    overrides: Partial<BrowseMediaQueryParameters>,
  ): BrowseMediaQueryParameters[] {
    const output: BrowseMediaQueryParameters[] = [];
    parameters.forEach((param) => {
      output.push({ ...param, ...overrides });
    });
    return output;
  }

  /**
   * Get BrowseMediaQueryParameters for a camera (including its dependencies).
   * @param hass Home Assistant object.
   * @param cameras Cameras map.
   * @param camera Name of the current camera.
   * @param mediaType Optional media type to include in the parameters.
   * @returns An array of query parameters.
   */
  static getFullDependentBrowseMediaQueryParameters(
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    camera: string,
    mediaType?: 'clips' | 'snapshots',
  ): BrowseMediaQueryParameters[] | null {
    const cameraIDs: Set<string> = new Set();
    const getDependentCameras = (camera: string): void => {
      const cameraConfig = cameras.get(camera);
      if (cameraConfig) {
        cameraIDs.add(camera);
        for (const eventCameraID of cameraConfig.dependent_cameras || []) {
          if (!cameraIDs.has(eventCameraID)) {
            getDependentCameras(eventCameraID);
          }
        }
      }
    };
    getDependentCameras(camera);

    const params: BrowseMediaQueryParameters[] = [];
    for (const cameraID of cameraIDs) {
      const param = BrowseMediaUtil.getBrowseMediaQueryParameters(
        hass,
        cameraID,
        cameras.get(cameraID),
        mediaType ? { mediaType: mediaType } : {},
      );
      // Fail on a single bad camera, as it's almost certainly a user error that
      // should be fixed rather than hidden.
      if (!param) {
        return null;
      }
      params.push(param);
    }
    return params.length ? params : null;
  }

  /**
   * Get BrowseMediaQueryParameters for a camera (including its dependencies) or dispatch an error.
   * @param element The element from which to dispatch the error.
   * @param hass Home Assistant object.
   * @param cameras Cameras map.
   * @param camera Name of the current camera.
   * @param mediaType Optional media type to include in the parameters.
   * @returns An array of query parameters.
   */
  static getFullDependentBrowseMediaQueryParametersOrDispatchError(
    element: HTMLElement,
    hass: HomeAssistant,
    cameras: Map<string, CameraConfig>,
    camera: string,
    mediaType?: 'clips' | 'snapshots',
  ): BrowseMediaQueryParameters[] | null {
    const params = this.getFullDependentBrowseMediaQueryParameters(
      hass,
      cameras,
      camera,
      mediaType,
    );
    if (!params) {
      dispatchErrorMessageEvent(
        element,
        localize('error.no_camera_name'),
        cameras.get(camera),
      );
      return null;
    }
    return params;
  }

  /**
   * Fetch the latest media and dispatch a change view event to reflect the
   * results. If no media is found a suitable message event will be triggered
   * instead.
   * @param element The HTMLElement to dispatch events from.
   * @param hass The Home Assistant object.
   * @param view The current view to evolve.
   * @param browseMediaQueryParameters The media parameters to query with.
   * @returns
   */
  static async fetchLatestMediaAndDispatchViewChange(
    element: HTMLElement,
    hass: HomeAssistant,
    view: Readonly<View>,
    browseMediaQueryParameters:
      | BrowseMediaQueryParameters
      | BrowseMediaQueryParameters[],
  ): Promise<void> {
    let parent: FrigateBrowseMediaSource | null;
    try {
      parent = await BrowseMediaUtil.multipleBrowseMediaQueryMerged(
        hass,
        browseMediaQueryParameters,
      );
    } catch (e) {
      return dispatchErrorMessageEvent(element, (e as Error).message);
    }
    const childIndex = BrowseMediaUtil.getFirstTrueMediaChildIndex(parent);
    if (!parent || !parent.children || childIndex == null) {
      return dispatchMessageEvent(
        element,
        view.isClipRelatedView()
          ? localize('common.no_clip')
          : localize('common.no_snapshot'),
        view.isClipRelatedView() ? 'mdi:filmstrip-off' : 'mdi:camera-off',
      );
    }

    view
      .evolve({
        target: parent,
        childIndex: childIndex,
      })
      .dispatchChangeEvent(element);
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
    element: HTMLElement,
    hass: HomeAssistant,
    view: Readonly<View>,
    child: Readonly<FrigateBrowseMediaSource>,
  ): Promise<void> {
    let parent: FrigateBrowseMediaSource;
    try {
      parent = await BrowseMediaUtil.browseMedia(hass, child.media_content_id);
    } catch (e) {
      return dispatchErrorMessageEvent(element, (e as Error).message);
    }

    view
      .evolve({
        target: parent,
      })
      .dispatchChangeEvent(element);
  }

  /**
   * Given an array of media children, create a parent for them.
   * @param title The title to use for the parent.
   * @param children The children media items.
   * @returns A single parent containing the children.
   */
  static createEventParentForChildren(
    title: string,
    children: FrigateBrowseMediaSource[],
  ): FrigateBrowseMediaSource {
    return {
      title: title,
      media_class: MEDIA_CLASS_PLAYLIST,
      media_content_type: MEDIA_TYPE_PLAYLIST,
      media_content_id: '',
      can_play: false,
      can_expand: true,
      children_media_class: MEDIA_CLASS_PLAYLIST,
      thumbnail: null,
      children: children,
    };
  }
}
