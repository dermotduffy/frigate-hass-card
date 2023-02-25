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

export const changeViewToRecentEventsForCameraAndDependents = async (
  element: HTMLElement,
  hass: HomeAssistant,
  cameraManager: CameraManager,
  cardWideConfig: CardWideConfig,
  view: View,
  options?: {
    mediaType?: ClipsOrSnapshotsOrAll;
    targetView?: FrigateCardView;
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

  if (options?.targetTime) {
    queryResults.selectBestResult((media) =>
      findClosestMediaIndex(media, options.targetTime as Date),
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
 * @param refPoint Whether to find based on the start or end of the
 * event/recording. If not specified, the first match is returned rather than
 * the best match.
 * @returns The childindex or null if no matching child is found.
 */
export const findClosestMediaIndex = (
  mediaArray: ViewMedia[],
  targetTime: Date,
  refPoint?: 'start' | 'end',
): number | null => {
  let bestMatch:
    | {
        index: number;
        delta: number;
      }
    | undefined;

  for (const [i, media] of mediaArray.entries()) {
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
