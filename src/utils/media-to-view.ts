import add from 'date-fns/add';
import sub from 'date-fns/sub';
import { ViewContext } from 'view';
import { CameraConfig, ClipsOrSnapshotsOrAll, FrigateCardView } from '../types';
import { View } from '../view/view';
import {
  EventMediaQueries,
  MediaQueries,
  RecordingMediaQueries,
} from '../view/media-queries';
import { CameraManager } from '../camera-manager/manager';
import { getAllDependentCameras } from './camera.js';
import { ViewMedia } from '../view/media';
import { HomeAssistant } from 'custom-card-helpers';
import { dispatchFrigateCardErrorEvent } from '../components/message';
import { MediaQueriesResults } from '../view/media-queries-results';
import { errorToConsole } from './basic';
import { MediaQuery } from '../camera-manager/types';

export const changeViewToRecentEventsForCameraAndDependents = async (
  element: HTMLElement,
  hass: HomeAssistant,
  cameraManager: CameraManager,
  cameras: Map<string, CameraConfig>,
  view: View,
  options?: {
    mediaType?: ClipsOrSnapshotsOrAll;
    targetView?: FrigateCardView;
  },
): Promise<void> => {
  (
    await createViewForEvents(element, hass, cameraManager, cameras, view, {
      ...options,
      limit: 50, // Capture the 50 most recent events.
    })
  )?.dispatchChangeEvent(element);
};

export const createViewForEvents = async (
  element: HTMLElement,
  hass: HomeAssistant,
  cameraManager: CameraManager,
  cameras: Map<string, CameraConfig>,
  view: View,
  options?: {
    query?: EventMediaQueries;
    cameraIDs?: Set<string>;
    mediaType?: ClipsOrSnapshotsOrAll;
    targetCameraID?: string;
    targetView?: FrigateCardView;
    limit?: number;
  },
): Promise<View | null> => {
  let query: EventMediaQueries;
  const cameraIDs: Set<string> = options?.cameraIDs
    ? options.cameraIDs
    : new Set(getAllDependentCameras(cameras, view.camera));

  if (options?.query) {
    query = options.query;
  } else {
    const eventQueries = cameraManager.generateDefaultEventQueries(cameraIDs, {
      ...(options?.limit && { limit: options.limit }),
      ...(options?.mediaType === 'clips' && { hasClip: true }),
      ...(options?.mediaType === 'snapshots' && { hasSnapshot: true }),
    });
    if (!eventQueries) {
      return null;
    }
    query = new EventMediaQueries(eventQueries);
  }

  if (!query) {
    return null;
  }

  return executeMediaQueryForView(element, hass, cameraManager, view, query, {
    cameraIDs: cameraIDs,
    targetView: options?.targetView,
    targetCameraID: options?.targetCameraID,
  });
};

/**
 * Change the view to a recent recording.
 * @param element The element to dispatch the view change from.
 * @param hass The Home Assistant object.
 * @param cameraManager The datamanager to use for data access.
 * @param cameras The camera configurations.
 * @param view The current view.
 * @param options A set of cameraIDs to fetch recordings for, and a targetView to dispatch to.
 */
export const changeViewToRecentRecordingForCameraAndDependents = async (
  element: HTMLElement,
  hass: HomeAssistant,
  cameraManager: CameraManager,
  cameras: Map<string, CameraConfig>,
  view: View,
  options?: {
    targetView?: 'recording' | 'recordings';
  },
): Promise<void> => {
  const now = new Date();
  (
    await createViewForRecordings(element, hass, cameraManager, cameras, view, {
      ...options,
      // Fetch 7 days worth of recordings (including recordings that are for the
      // current hour).
      start: sub(now, { days: 7 }),
      end: add(now, { hours: 1 }),
    })
  )?.dispatchChangeEvent(element);
};

/**
 * Create a view for recordings.
 * @param element The element to dispatch the view change from.
 * @param hass The Home Assistant object.
 * @param cameraManager The datamanager to use for data access.
 * @param cameras The camera configurations.
 * @param view The current view.
 * @param options A specific window (start and end) to fetch recordings for, a
 * targetTime to seek to, a targetView to dispatch to and a set of cameraIDs to
 * restrict to.
 */
export const createViewForRecordings = async (
  element: HTMLElement,
  hass: HomeAssistant,
  cameraManager: CameraManager,
  cameras: Map<string, CameraConfig>,
  view: View,
  options?: {
    query?: RecordingMediaQueries;
    cameraIDs?: Set<string>;
    targetCameraID?: string;
    targetView?: 'recording' | 'recordings';
    targetTime?: Date;
    start?: Date;
    end?: Date;
  },
): Promise<View | null> => {
  const cameraIDs: Set<string> = options?.cameraIDs
    ? options.cameraIDs
    : new Set(getAllDependentCameras(cameras, view.camera));

  let query: RecordingMediaQueries;
  if (options?.query) {
    query = options.query;
  } else {
    const recordingQueries = cameraManager.generateDefaultRecordingQueries(cameraIDs, {
      ...(options?.start && { start: options.start }),
      ...(options?.end && { end: options.end }),
    });

    if (!recordingQueries) {
      return null;
    }

    query = new RecordingMediaQueries(recordingQueries);
  }

  return executeMediaQueryForView(element, hass, cameraManager, view, query, {
    cameraIDs: cameraIDs,
    targetView: options?.targetView,
    targetCameraID: options?.targetCameraID,
    targetTime: options?.targetTime,
  });
};

const executeMediaQueryForView = async (
  element: HTMLElement,
  hass: HomeAssistant,
  cameraManager: CameraManager,
  view: View,
  query: MediaQueries,
  options?: {
    cameraIDs?: Set<string>;
    targetCameraID?: string;
    targetView?: FrigateCardView;
    targetTime?: Date;
  },
): Promise<View | null> => {
  let mediaArray: ViewMedia[] | null;

  const queries = query.getQueries();
  if (!queries) {
    return null;
  }

  try {
    mediaArray = await cameraManager.executeMediaQueries<MediaQuery>(hass, queries);
  } catch (e) {
    errorToConsole(e as Error);
    dispatchFrigateCardErrorEvent(element, e as Error);
    return null;
  }

  if (!mediaArray) {
    return null;
  }
  // Select the last item by default (which is the most recent).
  const selectedIndex = mediaArray.length ? mediaArray.length - 1 : undefined;
  const queryResults = new MediaQueriesResults(mediaArray, selectedIndex);
  let viewerContext: ViewContext | undefined = {};

  if (options?.targetTime && options.cameraIDs) {
    queryResults.selectBestResult((media) =>
      findClosestMediaIndex(media, options.targetTime as Date, options.cameraIDs),
    );
    viewerContext = {
      mediaViewer: {
        seek: options.targetTime,
      },
    };
  }

  return (
    view
      ?.evolve({
        query: query,
        queryResults: queryResults,
        view: options?.targetView,
        camera: options?.targetCameraID,
      })
      .mergeInContext(viewerContext) ?? null
  );
};

/**
 * Find the closest matching media object.
 * @param mediaArray The media. Must be sorted most recent first.
 * @param targetTime The target time used to find the relevant child.
 * @param cameraIDs The camera IDs to search for.
 * @param refPoint Whether to find based on the start or end of the
 * event/recording. If not specified, the first match is returned rather than
 * the best match.
 * @returns The childindex or null if no matching child is found.
 */
export const findClosestMediaIndex = (
  mediaArray: ViewMedia[],
  targetTime: Date,
  cameraIDs?: Set<string>,
  refPoint?: 'start' | 'end',
): number | null => {
  let bestMatch:
    | {
        index: number;
        delta: number;
      }
    | undefined;

  if (!cameraIDs) {
    return null;
  }

  for (const [i, media] of mediaArray.entries()) {
    if (!cameraIDs.has(media.getCameraID())) {
      continue;
    }

    if (media.includesTime(targetTime)) {
      const start = media.getStartTime();
      const end = media.getEndTime();
      if (!refPoint || !start || !end) {
        return i;
      }
      const delta =
        refPoint === 'end'
          ? end.getTime() - targetTime.getTime()
          : targetTime.getTime() - start.getTime();
      if (!bestMatch || delta < bestMatch.delta) {
        bestMatch = { index: i, delta: delta };
      }
    }
  }
  return bestMatch ? bestMatch.index : null;
};
