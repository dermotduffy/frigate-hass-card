import { ViewContext } from 'view';
import { CardWideConfig, ClipsOrSnapshotsOrAll, FrigateCardView } from '../types';
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
import { MEDIA_CHUNK_SIZE_DEFAULT } from '../const';

type ResultSelectType = 'latest' | 'time' | 'none';

export const changeViewToRecentEventsForCameraAndDependents = async (
  element: HTMLElement,
  hass: HomeAssistant,
  cameraManager: CameraManager,
  cardWideConfig: CardWideConfig,
  view: View,
  options?: {
    mediaType?: ClipsOrSnapshotsOrAll;
    targetView?: FrigateCardView;
    select?: ResultSelectType;
  },
): Promise<void> => {
  const cameraIDs = getAllDependentCameras(cameraManager, view.camera);
  if (!cameraIDs) {
    return;
  }

  const queries = createQueriesForEventsView(cameraManager, cardWideConfig, cameraIDs, {
    mediaType: options?.mediaType,
  });
  if (!queries) {
    return;
  }

  (
    await executeMediaQueryForView(element, hass, cameraManager, view, queries, {
      targetView: options?.targetView,
      select: options?.select,
    })
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
  hass: HomeAssistant,
  cameraManager: CameraManager,
  cardWideConfig: CardWideConfig,
  view: View,
  options?: {
    targetView?: 'recording' | 'recordings';
    select?: ResultSelectType;
  },
): Promise<void> => {
  const cameraIDs = getAllDependentCameras(cameraManager, view.camera);
  if (!cameraIDs) {
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
    await executeMediaQueryForView(element, hass, cameraManager, view, queries, {
      targetView: options?.targetView,
      select: options?.select,
    })
  )?.dispatchChangeEvent(element);
};

export const createQueriesForRecordingsView = (
  cameraManager: CameraManager,
  cardWideConfig: CardWideConfig,
  cameraIDs: Set<string>,
  options?: {
    start?: Date;
    end?: Date;
  },
): RecordingMediaQueries | null => {
  const limit =
    cardWideConfig.performance?.features.media_chunk_size ?? MEDIA_CHUNK_SIZE_DEFAULT;
  const recordingQueries = cameraManager.generateDefaultRecordingQueries(cameraIDs, {
    limit: limit,
    ...(options?.start && { start: options.start }),
    ...(options?.end && { end: options.end }),
  });
  return recordingQueries ? new RecordingMediaQueries(recordingQueries) : null;
};

export const executeMediaQueryForView = async (
  element: HTMLElement,
  hass: HomeAssistant,
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

  const queryResults = new MediaQueriesResults(
    mediaArray,
    options?.select === 'latest' && mediaArray.length
      ? mediaArray.length - 1
      : undefined,
  );
  let viewerContext: ViewContext | undefined = {};

  if (options?.select === 'time' && options?.targetTime) {
    queryResults.selectBestResult((media) =>
      findBestMediaIndex(media, options.targetTime as Date),
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
 * Find the longest matching media object that contains a given targetTime.
 * Longest is chosen to give the most stability to the media viewer.
 * @param mediaArray The media.
 * @param targetTime The target time used to find the relevant child.
 * @returns The childindex or null if no matching child is found.
 */
export const findBestMediaIndex = (
  mediaArray: ViewMedia[],
  targetTime: Date
): number | null => {
  let bestMatch:
    | {
        index: number;
        duration: number;
      }
    | undefined;

  for (const [i, media] of mediaArray.entries()) {
    const start = media.getStartTime();
    const end = media.getUsableEndTime();

    if (media.includesTime(targetTime) && start && end) {
      const duration = end.getTime() - start.getTime();
      if (!bestMatch || duration > bestMatch.duration) {
        bestMatch = { index: i, duration: duration };
      }
    }
  }
  return bestMatch ? bestMatch.index : null;
};
