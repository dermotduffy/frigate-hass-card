import add from 'date-fns/add';
import endOfHour from 'date-fns/endOfHour';
import fromUnixTime from 'date-fns/fromUnixTime';
import getUnixTime from 'date-fns/getUnixTime';
import startOfHour from 'date-fns/startOfHour';
import sub from 'date-fns/sub';
import { ViewContext } from 'view';
import { dispatchMessageEvent } from '../components/message';
import { localize } from '../localize/localize';
import { CameraConfig, ExtendedHomeAssistant, FrigateBrowseMediaSource } from '../types';
import { View } from '../view';
import { formatDateAndTime, prettifyTitle } from './basic';
import { getRecordingMediaContentID } from './frigate';
import {
  createChild,
  createEventParentForChildren,
  sortYoungestToOldest,
} from './ha/browse-media';
import {
  RecordingSegmentsItem,
  sortOldestToYoungest,
  DataManager,
} from './data-manager';
import { getAllDependentCameras, getTrueCameras } from './camera.js';

/**
 * Change the view to a recent recording.
 * @param element The element to dispatch the view change from.
 * @param hass The Home Assistant object.
 * @param dataManager The datamanager to use for data access.
 * @param cameras The camera configurations.
 * @param view The current view.
 * @param options A set of cameraIDs to fetch recordings for, and a targetView to dispatch to.
 */
export const changeViewToRecentRecordingForCameraAndDependents = async (
  element: HTMLElement,
  hass: ExtendedHomeAssistant,
  dataManager: DataManager,
  cameras: Map<string, CameraConfig>,
  view: View,
  options?: {
    targetView?: 'recording' | 'recordings';
  },
): Promise<void> => {
  const now = new Date();

  await changeViewToRecording(element, hass, dataManager, cameras, view, {
    ...options,

    // Fetch 1 days worth of recordings (including recordings that are for the current hour).
    cameraIDs: getAllDependentCameras(cameras, view.camera),
    start: sub(now, { days: 1 }),
    end: add(now, { hours: 1 }),
  });
};

/**
 * Change the view to a recording.
 * @param element The element to dispatch the view change from.
 * @param hass The Home Assistant object.
 * @param dataManager The datamanager to use for data access.
 * @param cameras The camera configurations.
 * @param view The current view.
 * @param options A specific window (start and end) to fetch recordings for, a
 * targetTime to seek to, a targetView to dispatch to and a set of cameraIDs to
 * restrict to.
 */
export const changeViewToRecording = async (
  element: HTMLElement,
  hass: ExtendedHomeAssistant,
  dataManager: DataManager,
  cameras: Map<string, CameraConfig>,
  view: View,
  options?: {
    cameraIDs?: Set<string>;
    targetView?: 'recording' | 'recordings';
    targetTime?: Date;
    start?: Date;
    end?: Date;
  },
): Promise<void> => {
  if (options && options.start && options.end) {
    await dataManager.fetchIfNecessary(element, hass, options.start, options.end);
  }

  const cameraIDs: Set<string> = options?.cameraIDs
    ? options.cameraIDs
    : new Set([view.camera]);
  const children = createRecordingChildren(dataManager, cameras, cameraIDs, {
    ...(options?.start && options?.end && { start: options.start, end: options.end }),
  });

  if (!children.length) {
    return dispatchMessageEvent(element, localize('common.no_recording'), 'info', {
      icon: 'mdi:album',
    });
  }

  const viewerContext = options?.targetTime
    ? generateMediaViewerContextForChildren(dataManager, children, options.targetTime)
    : {};
  const childIndex = options?.targetTime
    ? findChildIndex(children, options.targetTime, cameraIDs)
    : null;
  const child = childIndex !== null ? children[childIndex] ?? null : null;

  view
    ?.evolve({
      view: options?.targetView ? options.targetView : 'recording',
      target: createEventParentForChildren(localize('common.recordings'), children),
      childIndex: childIndex ?? 0,
      ...(child?.frigate?.cameraID && { camera: child.frigate?.cameraID }),
    })
    .mergeInContext(viewerContext)
    .dispatchChangeEvent(element);
};

/**
 * Create recording objects.
 * @param dataManager The datamanager to use for data access.
 * @param cameras The camera configurations.
 * @param cameraIDs The camera IDs to include recordings for.
 * @param options A specific window (start and end) to allow recordings for.
 * @returns
 */
const createRecordingChildren = (
  dataManager: DataManager,
  cameras: Map<string, CameraConfig>,
  cameraIDs: Set<string>,
  options?: {
    start?: Date;
    end?: Date;
  },
): FrigateBrowseMediaSource[] => {
  const children: FrigateBrowseMediaSource[] = [];

  for (const cameraID of getTrueCameras(cameras, cameraIDs)) {
    const config = cameras.get(cameraID) ?? null;
    const recordingSummary = dataManager.getRecordingSummaryForCamera(cameraID);
    if (!config?.frigate.camera_name || !recordingSummary) {
      continue;
    }

    for (const dayData of recordingSummary) {
      for (const hourData of dayData.hours) {
        const hour = add(dayData.day, { hours: hourData.hour });
        const startHour = startOfHour(hour);
        const endHour = endOfHour(hour);

        if (
          (!options?.start || startHour >= options.start) &&
          (!options?.end || endHour <= options.end)
        ) {
          children.push(
            createChild(
              `${prettifyTitle(config.frigate.camera_name)} ${formatDateAndTime(hour)}`,
              getRecordingMediaContentID({
                clientId: config.frigate.client_id,
                year: dayData.day.getFullYear(),
                month: dayData.day.getMonth() + 1,
                day: dayData.day.getDate(),
                hour: hourData.hour,
                cameraName: config.frigate.camera_name,
              }),
              {
                recording: {
                  camera: config.frigate.camera_name,
                  start_time: getUnixTime(startHour),
                  end_time: getUnixTime(endHour),
                  events: hourData.events,
                },
                cameraID: cameraID,
              },
            ),
          );
        }
      }
    }
  }
  // Sort the events by time (to align recordings for different cameras at the
  // same time).
  return children.sort(sortYoungestToOldest);
};

/**
 * Generate the media view context for a set of media children (used to set
 * seek times into each media item).
 * @param dataManager The datamanager to use for data access.
 * @param children The media children.
 * @param targetTime The target time.
 * @returns The ViewContext.
 */
export const generateMediaViewerContextForChildren = (
  dataManager: DataManager,
  children: FrigateBrowseMediaSource[],
  targetTime: Date,
): ViewContext => {
  const seek = new Map();
  const segmentsDataset = dataManager.recordingSegments;
  const hourStart = startOfHour(targetTime);

  children.forEach((child, index) => {
    const source = child.frigate?.recording ?? child.frigate?.event;
    if (source && source.end_time && child.frigate?.cameraID) {
      const start = source.start_time * 1000;
      const end = source.end_time * 1000;
      let seekSeconds: number | null = null;

      if (targetTime.getTime() >= start && targetTime.getTime() <= end) {
        const segments = segmentsDataset.get({
          filter: (segment) =>
            segment.cameraID === child.frigate?.cameraID &&
            segment.start >= start &&
            segment.end <= end,
          order: sortOldestToYoungest,
        });
        seekSeconds = getSeekTimeInSegments(
          // Recordings start from the top of the hour.
          child.frigate.recording ? hourStart : fromUnixTime(source.start_time),
          targetTime,
          segments,
        );
      }

      if (seekSeconds !== null) {
        seek.set(index, {
          seekSeconds: seekSeconds,
          seekTime: targetTime.getTime() / 1000,
        });
      }
    }
  });
  return seek.size > 0 ? { mediaViewer: { seek: seek } } : {};
};

/**
 * Find the relevant recording child given a date target.
 * @param children The FrigateBrowseMediaSource[] children. Must be sorted
 * most recent first.
 * @param targetTime The target time used to find the relevant child.
 * @param cameraIDs The camera IDs to search for.
 * @param refPoint Whether to find based on the start or end of the
 * event/recording. If not specified, the first match is returned rather than
 * the best match.
 * @returns The childindex or null if no matching child is found.
 */
export const findChildIndex = (
  children: FrigateBrowseMediaSource[],
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

  for (let i = 0; i < children.length; ++i) {
    const child = children[i];
    if (child.frigate?.cameraID && cameraIDs.has(child.frigate.cameraID)) {
      const source = child.frigate.event ?? child.frigate.recording;
      if (!source?.start_time || !source?.end_time) {
        continue;
      }
      const startTime = fromUnixTime(source.start_time);
      const endTime = fromUnixTime(source.end_time);

      if (startTime <= targetTime && endTime >= targetTime) {
        if (!refPoint) {
          return i;
        }
        const delta =
          refPoint === 'end'
            ? endTime.getTime() - targetTime.getTime()
            : targetTime.getTime() - startTime.getTime();
        if (!bestMatch || delta < bestMatch.delta) {
          bestMatch = { index: i, delta: delta };
        }
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
  segments: RecordingSegmentsItem[],
): number | null => {
  if (!segments.length) {
    return null;
  }
  let seekMilliseconds = 0;

  // Inspired by: https://github.com/blakeblackshear/frigate/blob/release-0.11.0/web/src/routes/Recording.jsx#L27
  for (const segment of segments) {
    if (segment.start > targetTime.getTime()) {
      break;
    }
    const start =
      segment.start < startTime.getTime() ? startTime.getTime() : segment.start;
    const end = segment.end > targetTime.getTime() ? targetTime.getTime() : segment.end;
    seekMilliseconds += end - start;
  }
  return seekMilliseconds / 1000;
};
