import { HomeAssistant } from 'custom-card-helpers';
import {
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  fromUnixTime,
} from 'date-fns';
import { homeAssistantWSRequest } from '.';
import {
  dispatchErrorMessageEvent,
  dispatchFrigateCardErrorEvent,
  dispatchMessageEvent,
} from '../../components/message.js';
import { localize } from '../../localize/localize.js';
import {
  BrowseMediaQueryParameters,
  BrowseRecordingQueryParameters,
  CameraConfig,
  FrigateBrowseMediaSource,
  frigateBrowseMediaSourceSchema,
  FrigateCardError,
  FrigateEvent,
  FrigateRecording,
  MEDIA_CLASS_PLAYLIST,
  MEDIA_CLASS_VIDEO,
  MEDIA_TYPE_PLAYLIST,
  MEDIA_TYPE_VIDEO,
} from '../../types.js';
import { View } from '../../view.js';
import { getCameraTitle } from '../camera.js';

/**
 * Return the Frigate event_id given a FrigateBrowseMediaSource object.
 * @param media The event to get the id from.
 * @returns The `event_id` or `null` if not successfully parsed.
 */
export const getEventID = (media: FrigateBrowseMediaSource): string | null => {
  return media.frigate?.event?.id ?? null;
};

/**
 * Return the event start time given a FrigateBrowseMediaSource object.
 * @param browseMedia The media object to get the start time from.
 * @returns The start time in unix/epoch time, or null if it cannot be determined.
 */
export const getEventStartTime = (media: FrigateBrowseMediaSource): number | null => {
  return media.frigate?.event?.start_time ?? null;
};

/**
 * Determine if a FrigateBrowseMediaSource object is truly a media item (vs a folder).
 * @param media The media object.
 * @returns `true` if it's truly a media item, `false` otherwise.
 */
export const isTrueMedia = (media?: FrigateBrowseMediaSource): boolean => {
  return !!media && !media.can_expand;
};

/**
 * From a FrigateBrowseMediaSource item extract the first true media item from the
 * children (i.e. a clip/snapshot, not a folder).
 * @param media The media object with children.
 * @returns The first true media item found.
 */
export const getFirstTrueMediaChildIndex = (
  media: FrigateBrowseMediaSource | null,
): number | null => {
  if (!media || !media.children) {
    return null;
  }
  const index = media.children.findIndex((child) => isTrueMedia(child));
  return index >= 0 ? index : null;
};

/**
 * Browse Frigate media with a media content id. May throw.
 * @param hass The HomeAssistant object.
 * @param media_content_id The media content id to browse.
 * @returns A FrigateBrowseMediaSource object or null on malformed.
 */
export const browseMedia = async (
  hass: HomeAssistant,
  media_content_id: string,
): Promise<FrigateBrowseMediaSource> => {
  const request = {
    type: 'media_source/browse_media',
    media_content_id: media_content_id,
  };
  const root = await homeAssistantWSRequest<FrigateBrowseMediaSource>(hass, frigateBrowseMediaSourceSchema, request);
  const embedPromises: Promise<void>[] = [];
  const embedThumbnail = async (src: FrigateBrowseMediaSource) => {
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    src.thumbnail = await hass.fetchWithAuth(src.thumbnail!)
        .then(response => response.blob())
        .then(blob => URL.createObjectURL(blob));
  }
  const embedThumbnailandTraverse = async (parent: FrigateBrowseMediaSource) => {
    if (parent.thumbnail) {
      embedPromises.push(embedThumbnail(parent));
    }
    parent.children?.forEach(child => embedThumbnailandTraverse(child));
  }
  embedThumbnailandTraverse(root);
  await Promise.all(embedPromises);
  return root;
};

/**
 * Browse Frigate media with a media query. May throw.
 * @param hass The HomeAssistant object.
 * @param params The search parameters to use to search for media.
 * @returns A FrigateBrowseMediaSource object or null on malformed.
 */
export const browseMediaQuery = async (
  hass: HomeAssistant,
  params: BrowseMediaQueryParameters,
): Promise<FrigateBrowseMediaSource> => {
  return browseMedia(
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
};

/**
 * Browse multiple Frigate media queries. May throw.
 * @param hass The HomeAssistant object.
 * @param params An array of search parameters to use to search for media.
 * @returns A map of FrigateBrowseMediaSource object or null on malformed.
 */
export const multipleBrowseMediaQuery = async (
  hass: HomeAssistant,
  params: BrowseMediaQueryParameters | BrowseMediaQueryParameters[],
): Promise<Map<BrowseMediaQueryParameters, FrigateBrowseMediaSource>> => {
  params = Array.isArray(params) ? params : [params];
  const output: Map<BrowseMediaQueryParameters, FrigateBrowseMediaSource> = new Map();
  await Promise.all(
    params.map(async (param: BrowseMediaQueryParameters): Promise<void> => {
      output.set(param, await browseMediaQuery(hass, param));
    }),
  );
  return output;
};

/**
 * Browse multiple Frigate media queries, then merged them. May throw.
 * @param hass The HomeAssistant object.
 * @param params An array of search parameters to use to search for media.
 * @returns A single FrigateBrowseMediaSource object or null on malformed.
 */
export const multipleBrowseMediaQueryMerged = async (
  hass: HomeAssistant,
  params: BrowseMediaQueryParameters | BrowseMediaQueryParameters[],
): Promise<FrigateBrowseMediaSource> => {
  return mergeFrigateBrowseMediaSources(await multipleBrowseMediaQuery(hass, params));
};

/**
 * Merge multiple FrigateBrowseMediaSource into a single. Note that this may
 * use information from the query to differentiate results that may otherwise
 * be identical.
 * @param input A map of query -> result.
 * @returns A single FrigateBrowseMediaSource object.
 */
export const mergeFrigateBrowseMediaSources = async (
  input: Map<BrowseMediaQueryParameters, FrigateBrowseMediaSource>,
): Promise<FrigateBrowseMediaSource> => {
  const children: FrigateBrowseMediaSource[] = [];

  for (const [query, result] of input.entries()) {
    for (const child of result.children || []) {
      if (isTrueMedia(child)) {
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

  return createEventParentForChildren('Merged events', children.sort(eventSort));
};

/**
 * Get the parameters to search for media.
 * @returns A BrowseMediaQueryParameters object.
 */
export const getBrowseMediaQueryParameters = (
  hass: HomeAssistant,
  cameraID: string,
  cameraConfig?: CameraConfig,
  overrides?: Partial<BrowseMediaQueryParameters>,
): BrowseMediaQueryParameters | null => {
  if (!cameraConfig || !cameraConfig.frigate.camera_name) {
    return null;
  }
  return {
    clientId: cameraConfig.frigate.client_id,
    cameraName: cameraConfig.frigate.camera_name,
    label: cameraConfig.frigate.label,
    zone: cameraConfig.frigate.zone,
    title: getCameraTitle(hass, cameraConfig),
    cameraID: cameraID,
    ...overrides,
  };
};

/**
 * Apply overrides to multiple query parameters.
 * @param parameters An array of query parameters.
 * @param overrides The overrides to apply.
 * @returns The override query parameters.
 */
export const overrideMultiBrowseMediaQueryParameters = (
  parameters: BrowseMediaQueryParameters[],
  overrides: Partial<BrowseMediaQueryParameters>,
): BrowseMediaQueryParameters[] => {
  const output: BrowseMediaQueryParameters[] = [];
  parameters.forEach((param) => {
    output.push({ ...param, ...overrides });
  });
  return output;
};

/**
 * Get BrowseMediaQueryParameters for a camera (including its dependencies).
 * @param hass Home Assistant object.
 * @param cameras Cameras map.
 * @param camera Name of the current camera.
 * @param mediaType Optional media type to include in the parameters.
 * @returns An array of query parameters.
 */
export const getFullDependentBrowseMediaQueryParameters = (
  hass: HomeAssistant,
  cameras: Map<string, CameraConfig>,
  camera: string,
  mediaType?: 'clips' | 'snapshots',
): BrowseMediaQueryParameters[] | null => {
  const cameraIDs: Set<string> = new Set();
  const getDependentCameras = (camera: string): void => {
    const cameraConfig = cameras.get(camera);
    if (cameraConfig) {
      cameraIDs.add(camera);
      const dependentCameras: Set<string> = new Set();
      (cameraConfig.dependencies.cameras || []).forEach((item) =>
        dependentCameras.add(item),
      );
      if (cameraConfig.dependencies.all_cameras) {
        cameras.forEach((_, key) => dependentCameras.add(key));
      }
      for (const eventCameraID of dependentCameras) {
        if (!cameraIDs.has(eventCameraID)) {
          getDependentCameras(eventCameraID);
        }
      }
    }
  };
  getDependentCameras(camera);

  const params: BrowseMediaQueryParameters[] = [];
  for (const cameraID of cameraIDs) {
    const param = getBrowseMediaQueryParameters(
      hass,
      cameraID,
      cameras.get(cameraID),
      mediaType ? { mediaType: mediaType } : {},
    );
    if (param) {
      params.push(param);
    }
  }
  return params.length ? params : null;
};

/**
 * Get BrowseMediaQueryParameters for a camera (including its dependencies) or dispatch an error.
 * @param element The element from which to dispatch the error.
 * @param hass Home Assistant object.
 * @param cameras Cameras map.
 * @param camera Name of the current camera.
 * @param mediaType Optional media type to include in the parameters.
 * @returns An array of query parameters.
 */
export const getFullDependentBrowseMediaQueryParametersOrDispatchError = (
  element: HTMLElement,
  hass: HomeAssistant,
  cameras: Map<string, CameraConfig>,
  camera: string,
  mediaType?: 'clips' | 'snapshots',
): BrowseMediaQueryParameters[] | null => {
  const params = getFullDependentBrowseMediaQueryParameters(
    hass,
    cameras,
    camera,
    mediaType,
  );
  if (!params) {
    dispatchErrorMessageEvent(element, localize('error.no_camera_name'), {
      context: cameras.get(camera),
    });
    return null;
  }
  return params;
};

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
export const fetchLatestMediaAndDispatchViewChange = async (
  element: HTMLElement,
  hass: HomeAssistant,
  view: Readonly<View>,
  browseMediaQueryParameters: BrowseMediaQueryParameters | BrowseMediaQueryParameters[],
): Promise<void> => {
  let parent: FrigateBrowseMediaSource | null;
  try {
    parent = await multipleBrowseMediaQueryMerged(hass, browseMediaQueryParameters);
  } catch (e) {
    return dispatchFrigateCardErrorEvent(element, e as FrigateCardError);
  }
  const childIndex = getFirstTrueMediaChildIndex(parent);
  if (!parent || !parent.children || childIndex == null) {
    return dispatchMessageEvent(
      element,
      view.isClipRelatedView()
        ? localize('common.no_clip')
        : localize('common.no_snapshot'),
      'info',
      {
        icon: view.isClipRelatedView() ? 'mdi:filmstrip-off' : 'mdi:camera-off',
      },
    );
  }

  view
    .evolve({
      target: parent,
      childIndex: childIndex,
    })
    .dispatchChangeEvent(element);
};

/**
 * Fetch the media of a child FrigateBrowseMediaSource object and dispatch a change
 * view event to reflect the results.
 * @param node The HTMLElement to dispatch events from.
 * @param hass The Home Assistant object.
 * @param view The current view to evolve.
 * @param child The FrigateBrowseMediaSource child to query for.
 * @returns
 */
export const fetchChildMediaAndDispatchViewChange = async (
  element: HTMLElement,
  hass: HomeAssistant,
  view: Readonly<View>,
  child: Readonly<FrigateBrowseMediaSource>,
): Promise<void> => {
  let parent: FrigateBrowseMediaSource;
  try {
    parent = await browseMedia(hass, child.media_content_id);
  } catch (e) {
    return dispatchFrigateCardErrorEvent(element, e as FrigateCardError);
  }

  view
    .evolve({
      target: parent,
    })
    .dispatchChangeEvent(element);
};

/**
 * Given an array of media children, create a parent for them.
 * @param title The title to use for the parent.
 * @param children The children media items.
 * @returns A single parent containing the children.
 */
export const createEventParentForChildren = (
  title: string,
  children: FrigateBrowseMediaSource[],
): FrigateBrowseMediaSource => {
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
};

/**
 * Given a media video child with a given media_content_id.
 * @param title The title to use for the child.
 * @param media_con
 * @param children The children media items.
 * @returns A single parent containing the children.
 */
export const createVideoChild = (
  title: string,
  mediaContentID: string,
  options?: {
    thumbnail?: string;
    recording?: FrigateRecording;
  },
): FrigateBrowseMediaSource => {
  return {
    title: title,
    media_class: MEDIA_CLASS_VIDEO,
    media_content_type: MEDIA_TYPE_VIDEO,
    media_content_id: mediaContentID,
    can_play: true,
    can_expand: false,
    thumbnail: options?.thumbnail ?? null,
    children: null,
    ...(options?.recording && {
      frigate: {
        recording: options.recording,
      },
    }),
  };
};

/**
 * Convenience function to convert a timestamp to hours, minutes and seconds
 * string. Heavily inspired by, and returning the same format as, the Frigate
 * UI: https://github.com/blakeblackshear/frigate/blob/master/web/src/components/RecordingPlaylist.jsx#L97
 * @param event The Frigate event.
 * @returns A duration string.
 */
export function getEventDurationString(event: FrigateEvent): string {
  if (!event.end_time) {
    return localize('event.in_progress');
  }
  const start = fromUnixTime(event.start_time);
  const end = fromUnixTime(event.end_time);
  const hours = differenceInHours(end, start);
  const minutes = differenceInMinutes(end, start) - hours * 60;
  const seconds = differenceInSeconds(end, start) - hours * 60 * 60 - minutes * 60;
  let duration = '';

  if (hours) {
    duration += `${hours}h `;
  }
  if (minutes) {
    duration += `${minutes}m `;
  }
  duration += `${seconds}s`;
  return duration;
}

/**
 * Generate a recording identifier.
 * @param hass The HomeAssistant object.
 * @param params The recording parameters to use in the identifer.
 * @returns A recording identifier.
 */
export const generateRecordingIdentifier = (
  params: BrowseRecordingQueryParameters,
): string => {
  return [
    'media-source://frigate',
    params.clientId,
    'recordings',
    `${params.year}-${String(params.month).padStart(2, '0')}`,
    String(params.day).padStart(2, '0'),
    String(params.hour).padStart(2, '0'),
    params.cameraName,
  ].join('/');
};
