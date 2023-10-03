import { ViewContext } from 'view';
import { CameraManager } from '../camera-manager/manager';
import { MediaQuery } from '../camera-manager/types';
import { dispatchFrigateCardErrorEvent } from '../components/message';
import { MEDIA_CHUNK_SIZE_DEFAULT } from '../const';
import { CardWideConfig, ClipsOrSnapshotsOrAll, FrigateCardView } from '../types';
import { ViewMedia } from '../view/media';
import {
  EventMediaQueries,
  MediaQueries,
  RecordingMediaQueries,
} from '../view/media-queries';
import { MediaQueriesResults } from '../view/media-queries-results';
import { View } from '../view/view';
import { errorToConsole } from './basic';
import { getAllDependentCameras } from './camera.js';

type ResultSelectType = 'latest' | 'time' | 'none';

export const changeViewToRecentEventsForCameraAndDependents = async (
  element: HTMLElement,
  cameraManager: CameraManager,
  cardWideConfig: CardWideConfig,
  view: View,
  options?: {
    allCameras?: boolean;
    mediaType?: ClipsOrSnapshotsOrAll;
    targetView?: FrigateCardView;
    select?: ResultSelectType;
  },
): Promise<void> => {
  const cameraIDs = options?.allCameras
    ? cameraManager.getStore().getVisibleCameraIDs()
    : getAllDependentCameras(cameraManager, view.camera);
  if (!cameraIDs.size) {
    return;
  }

  const queries = createQueriesForEventsView(cameraManager, cardWideConfig, cameraIDs, {
    mediaType: options?.mediaType,
  });
  if (!queries) {
    return;
  }

  (
    await executeMediaQueryForViewWithErrorDispatching(
      element,
      cameraManager,
      view,
      queries,
      {
        targetView: options?.targetView,
        select: options?.select,
      },
    )
  )?.dispatchChangeEvent(element);
};

const createQueriesForEventsView = (
  cameraManager: CameraManager,
  cardWideConfig: CardWideConfig,
  cameraIDs: Set<string>,
  options?: {
    mediaType?: ClipsOrSnapshotsOrAll;
  },
): EventMediaQueries | null => {
  const limit =
    cardWideConfig.performance?.features.media_chunk_size ?? MEDIA_CHUNK_SIZE_DEFAULT;
  const eventQueries = cameraManager.generateDefaultEventQueries(cameraIDs, {
    limit: limit,
    ...(options?.mediaType === 'clips' && { hasClip: true }),
    ...(options?.mediaType === 'snapshots' && { hasSnapshot: true }),
  });
  return eventQueries ? new EventMediaQueries(eventQueries) : null;
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
  cameraManager: CameraManager,
  cardWideConfig: CardWideConfig,
  view: View,
  options?: {
    allCameras?: boolean;
    targetView?: 'recording' | 'recordings';
    select?: ResultSelectType;
  },
): Promise<void> => {
  const cameraIDs = options?.allCameras
    ? cameraManager.getStore().getVisibleCameraIDs()
    : getAllDependentCameras(cameraManager, view.camera);
  if (!cameraIDs.size) {
    return;
  }

  const queries = createQueriesForRecordingsView(
    cameraManager,
    cardWideConfig,
    cameraIDs,
  );
  if (!queries) {
    return;
  }

  (
    await executeMediaQueryForViewWithErrorDispatching(
      element,
      cameraManager,
      view,
      queries,
      {
        targetView: options?.targetView,
        select: options?.select,
      },
    )
  )?.dispatchChangeEvent(element);
};

const createQueriesForRecordingsView = (
  cameraManager: CameraManager,
  cardWideConfig: CardWideConfig,
  cameraIDs: Set<string>,
): RecordingMediaQueries | null => {
  const limit =
    cardWideConfig.performance?.features.media_chunk_size ?? MEDIA_CHUNK_SIZE_DEFAULT;
  const recordingQueries = cameraManager.generateDefaultRecordingQueries(cameraIDs, {
    limit: limit,
  });
  return recordingQueries ? new RecordingMediaQueries(recordingQueries) : null;
};

export const executeMediaQueryForView = async (
  cameraManager: CameraManager,
  view: View,
  query: MediaQueries,
  options?: {
    targetCameraID?: string;
    targetView?: FrigateCardView;
    targetTime?: Date;
    select?: ResultSelectType;
  },
): Promise<View | null> => {
  const queries = query.getQueries();
  if (!queries) {
    return null;
  }

  const mediaArray = await cameraManager.executeMediaQueries<MediaQuery>(queries);
  if (!mediaArray) {
    return null;
  }

  const queryResults = new MediaQueriesResults({ results: mediaArray });
  let viewerContext: ViewContext | undefined = {};
  const cameraID = options?.targetCameraID ?? view.camera;

  if (options?.select === 'time' && options?.targetTime) {
    queryResults.selectBestResult((media) =>
      findBestMediaIndex(media, options.targetTime as Date, cameraID),
    );
    viewerContext = {
      mediaViewer: {
        seek: options.targetTime,
      },
    };
  }

  return view
    .evolve({
      query: query,
      queryResults: queryResults,
      view: options?.targetView,
      camera: cameraID,
    })
    .mergeInContext(viewerContext);
};

export const executeMediaQueryForViewWithErrorDispatching = async (
  element: HTMLElement,
  cameraManager: CameraManager,
  view: View,
  query: MediaQueries,
  options?: {
    targetCameraID?: string;
    targetView?: FrigateCardView;
    targetTime?: Date;
    select?: ResultSelectType;
  },
): Promise<View | null> => {
  try {
    return await executeMediaQueryForView(cameraManager, view, query, {
      targetCameraID: options?.targetCameraID,
      targetView: options?.targetView,
      targetTime: options?.targetTime,
      select: options?.select,
    });
  } catch (e: unknown) {
    errorToConsole(e as Error);
    dispatchFrigateCardErrorEvent(element, e as Error);
  }
  return null;
};

/**
 * Find the longest matching media object that contains a given targetTime.
 * Longest is chosen to give the most stability to the media viewer.
 * @param mediaArray The media.
 * @param targetTime The target time used to find the relevant child.
 * @returns The childindex or null if no matching child is found.
 */
export const findBestMediaIndex = (
  mediaArray: ViewMedia[],
  targetTime: Date,
  favorCameraID?: string,
): number | null => {
  let bestMatch:
    | {
        index: number;
        duration: number;
        cameraID: string;
      }
    | undefined;

  for (const [i, media] of mediaArray.entries()) {
    const start = media.getStartTime();
    const end = media.getUsableEndTime();

    if (media.includesTime(targetTime) && start && end) {
      const duration = end.getTime() - start.getTime();

      if (
        // No best match so far ...
        !bestMatch ||
        // ... or there is a best-match, but it's from a non-favored camera (unlike this one) ...
        (favorCameraID &&
          bestMatch.cameraID !== favorCameraID &&
          media.getCameraID() === favorCameraID) ||
        // ... or this match is longer and either there's no favored camera or this is it.
        (duration > bestMatch.duration &&
          (!favorCameraID ||
            bestMatch.cameraID !== favorCameraID ||
            media.getCameraID() === favorCameraID))
      ) {
        bestMatch = { index: i, duration: duration, cameraID: media.getCameraID() };
      }
    }
  }
  return bestMatch ? bestMatch.index : null;
};
