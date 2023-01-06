import add from 'date-fns/add';
import fromUnixTime from 'date-fns/fromUnixTime';
import startOfHour from 'date-fns/startOfHour';
import sub from 'date-fns/sub';
import { ViewContext } from 'view';
import {
  CameraConfig,
  ClipsOrSnapshotsOrAll,
  FrigateCardView,
  RecordingSegment,
} from '../types';
import { View } from '../view/view';
import { EventMediaQueries, RecordingMediaQueries } from '../view/media-queries';
import { CameraManager } from '../camera/manager';
import { getAllDependentCameras } from './camera.js';
import { ViewMedia } from '../view/media';
import { ViewMediaClassifier } from '../view/media-classifier';
import { HomeAssistant } from 'custom-card-helpers';

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
    await createViewForEvents(hass, cameraManager, cameras, view, {
      ...options,
      limit: 50, // Capture the 50 most recent events.
    })
  ).dispatchChangeEvent(element);
};

export const createViewForEvents = async (
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
): Promise<View> => {
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
  const queryResults = await cameraManager.executeMediaQuery(hass, query);

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
    await createViewForRecordings(hass, cameraManager, cameras, view, {
      ...options,
      // Fetch 7 days worth of recordings (including recordings that are for the
      // current hour).
      start: sub(now, { days: 7 }),
      end: add(now, { hours: 1 }),
    })
  ).dispatchChangeEvent(element);
};

/**
 * Create a view for recordings.
 * @param hass The Home Assistant object.
 * @param cameraManager The datamanager to use for data access.
 * @param cameras The camera configurations.
 * @param view The current view.
 * @param options A specific window (start and end) to fetch recordings for, a
 * targetTime to seek to, a targetView to dispatch to and a set of cameraIDs to
 * restrict to.
 */
export const createViewForRecordings = async (
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
): Promise<View> => {
  const cameraIDs: Set<string> = options?.cameraIDs
    ? options.cameraIDs
    : new Set(getAllDependentCameras(cameras, view.camera));

  const queries = cameraManager.generateDefaultRecordingQueries(cameraIDs, {
    ...(options?.start && { start: options.start }),
    ...(options?.end && { end: options.end }),
  });

  const query = new RecordingMediaQueries(queries);
  const queryResults = await cameraManager.executeMediaQuery(hass, query);

  let viewerContext: ViewContext | undefined = {};
  const mediaArray = queryResults?.getResults();
  if (queryResults && mediaArray && options?.targetTime) {
    queryResults.selectBestResult((media) =>
      findClosestMediaIndex(media, options.targetTime as Date, cameraIDs),
    );
    viewerContext = await generateMediaViewerContext(
      hass,
      cameraManager,
      mediaArray,
      options.targetTime,
    );
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
 * Generate the media view context for a set of media children (used to set
 * seek times into each media item).
 * @param hass The Home Assistant object.
 * @param cameraManager The datamanager to use for data access.
 * @param media The media.
 * @param targetTime The target time.
 * @returns The ViewContext.
 */
export const generateMediaViewerContext = async (
  hass: HomeAssistant,
  cameraManager: CameraManager,
  media: ViewMedia[],
  targetTime: Date,
): Promise<ViewContext> => {
  const seek = new Map();
  const hourStart = startOfHour(targetTime);

  for (const [index, child] of media.entries()) {
    const start = child.getStartTime();
    const end = child.getEndTime();
    if (!start || !end) {
      continue;
    }

    let seekSeconds: number | null = null;

    if (targetTime >= start && targetTime <= end) {
      const query = cameraManager.generateDefaultRecordingSegmentsQueries(
        child.getCameraID(),
        {
          start: start,
          end: end,
        },
      )[0];
      const segments = (await cameraManager.getRecordingSegments(hass, query)).get(
        query,
      );

      if (segments) {
        seekSeconds = getSeekTimeInSegments(
          // Recordings start from the top of the hour.
          ViewMediaClassifier.isRecording(child) ? hourStart : start,
          targetTime,
          segments.segments,
        );
      }
    }

    if (seekSeconds !== null) {
      seek.set(index, {
        seekSeconds: seekSeconds,
        seekTime: targetTime.getTime() / 1000,
      });
    }
  }
  return seek.size > 0 ? { mediaViewer: { seek: seek } } : {};
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

  for (let i = 0; i < mediaArray.length; ++i) {
    const media = mediaArray[i];
    const start = media.getStartTime();
    const end = media.getEndTime();
    if (!cameraIDs.has(media.getCameraID()) || !start || !end) {
      continue;
    }

    if (start <= targetTime && end >= targetTime) {
      if (!refPoint) {
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

/**
 * Get the number of seconds to seek into a video stream consisting of the
 * provided segments to reach the target time provided.
 * @param startTime The earliest allowable time to seek from.
 * @param targetTime Target time.
 * @param segments An array of segments dataset items. Must be sorted from oldest to youngest.
 * @returns
 */
const getSeekTimeInSegments = (
  startTime: Date,
  targetTime: Date,
  segments: RecordingSegment[],
): number | null => {
  if (!segments.length) {
    return null;
  }
  let seekMilliseconds = 0;

  // Inspired by: https://github.com/blakeblackshear/frigate/blob/release-0.11.0/web/src/routes/Recording.jsx#L27
  for (const segment of segments) {
    const segmentStart = fromUnixTime(segment.start_time);
    if (segmentStart > targetTime) {
      break;
    }
    const segmentEnd = fromUnixTime(segment.end_time);
    const start = segmentStart < startTime ? startTime : segmentStart;
    const end = segmentEnd > targetTime ? targetTime : segmentEnd;
    seekMilliseconds += end.getTime() - start.getTime();
  }
  return seekMilliseconds / 1000;
};
