import add from 'date-fns/add';
import sub from 'date-fns/sub';
import { ViewContext } from 'view';
import { CameraConfig, ClipsOrSnapshotsOrAll, FrigateCardView } from '../types';
import { View } from '../view/view';
import { EventMediaQueries, RecordingMediaQueries } from '../view/media-queries';
import { CameraManager } from '../camera/manager';
import { getAllDependentCameras } from './camera.js';
import { ViewMedia } from '../view/media';
import { HomeAssistant } from 'custom-card-helpers';
import { dispatchFrigateCardErrorEvent } from '../components/message';
import { MediaQueriesResults } from '../view/media-queries-results';
import { errorToConsole } from './basic';

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
    targetView?: FrigateCardView;
    limit?: number;
  },
): Promise<View | null> => {
  let query: EventMediaQueries;
  if (options?.query) {
    query = options.query;
  } else {
    const cameraIDs: Set<string> = options?.cameraIDs
      ? options.cameraIDs
      : new Set(getAllDependentCameras(cameras, view.camera));

    const queries = cameraManager.generateDefaultEventQueries(cameraIDs, {
      ...(options?.limit && { limit: options.limit }),
      ...(options?.mediaType === 'clips' && { hasClip: true }),
      ...(options?.mediaType === 'snapshots' && { hasSnapshot: true }),
    });
    query = new EventMediaQueries(queries);
  }

  let queryResults: MediaQueriesResults | null;
  try {
    queryResults = await cameraManager.executeMediaQueries(hass, query);
  } catch (e) {
    errorToConsole(e as Error);
    dispatchFrigateCardErrorEvent(element, e as Error);
    return null;
  }

  return view?.evolve({
    view: options?.targetView,
    query: query,
    queryResults: queryResults,
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
    cameraIDs?: Set<string>;
    targetView?: 'recording' | 'recordings';
    targetTime?: Date;
    start?: Date;
    end?: Date;
  },
): Promise<View | null> => {
  const cameraIDs: Set<string> = options?.cameraIDs
    ? options.cameraIDs
    : new Set(getAllDependentCameras(cameras, view.camera));

  const queries = cameraManager.generateDefaultRecordingQueries(cameraIDs, {
    ...(options?.start && { start: options.start }),
    ...(options?.end && { end: options.end }),
  });

  const query = new RecordingMediaQueries(queries);
  let queryResults: MediaQueriesResults | null;

  try {
    queryResults = await cameraManager.executeMediaQueries(hass, query);
  } catch (e) {
    errorToConsole(e as Error);
    dispatchFrigateCardErrorEvent(element, e as Error);
    return null;
  }

  let viewerContext: ViewContext | undefined = {};
  const mediaArray = queryResults?.getResults();
  if (queryResults && mediaArray && options?.targetTime) {
    queryResults.selectBestResult((media) =>
      findClosestMediaIndex(media, options.targetTime as Date, cameraIDs),
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
        view: options?.targetView ? options.targetView : 'recording',
        query: query,
        queryResults: queryResults,
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
  cameraIDs: Set<string>,
  refPoint?: 'start' | 'end',
): number | null => {
  let bestMatch:
    | {
        index: number;
        delta: number;
      }
    | undefined;

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
