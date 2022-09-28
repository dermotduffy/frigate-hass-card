import {
  add,
  differenceInSeconds,
  endOfHour,
  fromUnixTime,
  getUnixTime,
  startOfHour,
  sub,
} from 'date-fns';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { isEqual, throttle } from 'lodash-es';
import { ViewContext } from 'view';
import { DataView, DataSet } from 'vis-data/esnext';
import {
  DataGroupCollectionType,
  IdType,
  Timeline,
  TimelineEventPropertiesResult,
  TimelineItem,
  TimelineOptions,
  TimelineOptionsCluster,
  TimelineWindow,
} from 'vis-timeline/esnext/umd/vis-timeline-graph2d.min.js';
import { CAMERA_BIRDSEYE } from '../const';
import { localize } from '../localize/localize';
import timelineCoreStyle from '../scss/timeline-core.scss';
import {
  CameraConfig,
  ExtendedHomeAssistant,
  FrigateBrowseMediaSource,
  frigateCardConfigDefaults,
  FrigateEvent,
  FrigateRecording,
  TimelineCoreConfig,
} from '../types';
import { stopEventFromActivatingCardWideActions } from '../utils/action';
import {
  contentsChanged,
  dispatchFrigateCardEvent,
  formatDateAndTime,
  isHoverableDevice,
  prettifyTitle,
} from '../utils/basic';
import { getAllDependentCameras, getCameraTitle } from '../utils/camera.js';
import {
  getEventMediaContentID,
  getEventThumbnailURL,
  getEventTitle,
  getRecordingMediaContentID,
} from '../utils/frigate';

import { createEventParentForChildren, createChild } from '../utils/ha/browse-media';
import {
  FrigateCardTimelineItem,
  RecordingSegmentsItem,
  sortSegmentsOldestToYoungest,
  sortTimelineItemsYoungestToOldest,
  TimelineDataManager,
} from '../utils/timeline-data-manager';
import { View } from '../view';
import { dispatchMessageEvent } from './message.js';
import './thumbnail.js';

interface FrigateCardGroupData {
  id: string;
  content: string;
}

interface TimelineRangeChange extends TimelineWindow {
  event: Event & { additionalEvent?: string };
  byUser: boolean;
}

interface TimelineViewContext {
  // Force a particular timeline window rather than taking the time from an
  // event / recording.
  window?: TimelineWindow;

  // Whether or not to set the timeline window.
  noSetWindow?: boolean;

  // Whether or not thumbnails were generated.
  generatedThumbnails?: boolean;
}

declare module 'view' {
  interface ViewContext {
    timeline?: TimelineViewContext;
  }
}

// An event used to fetch the HASS object. See "Special note" below.
class HASSRequestEvent extends Event {
  public hass?: ExtendedHomeAssistant;
}

const TIMELINE_TARGET_BAR_ID = 'target_bar';

/**
 * A simgple thumbnail wrapper class for use in the timeline where LIT data
 * bindings are not available.
 */
@customElement('frigate-card-timeline-thumbnail')
export class FrigateCardTimelineThumbnail extends LitElement {
  @property({ attribute: true })
  public thumbnail?: string;

  @property({ attribute: true, type: Boolean })
  public details = false;

  @property({ attribute: true })
  public event?: string;

  @property({ attribute: true })
  public label?: string;

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    // Don't display tooltips on touch devices, they just get in the way of
    // the drawer.
    if (!this.thumbnail || !this.event) {
      return html``;
    }

    /* Special note on what's going on here:
     *
     * This component does not have access to HASS, as there's no way to pass it
     * in via the string-based tooltip that timeline supports. Instead dispatch
     * an event to request HASS which the timeline adds to the event object
     * before execution continues.
     */
    const hassRequest = new HASSRequestEvent(`frigate-card:timeline:hass-request`, {
      composed: true,
      bubbles: true,
    });
    this.dispatchEvent(hassRequest);
    if (!hassRequest.hass) {
      return html``;
    }

    return html` <frigate-card-thumbnail
      .hass=${hassRequest.hass}
      .event=${JSON.parse(this.event)}
      .label=${this.label}
      .thumbnail=${this.thumbnail}
      ?details=${this.details}
    >
    </frigate-card-thumbnail>`;
  }
}

@customElement('frigate-card-timeline-core')
export class FrigateCardTimelineCore extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public cameras?: Map<string, CameraConfig>;

  @property({ attribute: false, hasChanged: contentsChanged })
  public timelineConfig?: TimelineCoreConfig;

  @property({ attribute: true, type: Boolean })
  public thumbnailDetails? = false;

  @property({ attribute: false })
  public thumbnailSize?: number;

  // Whether or not this is a mini-timeline for a different view (e.g. media
  // viewer).
  @property({ attribute: true, type: Boolean, reflect: true })
  public mini = false;

  @property({ attribute: false })
  public timelineDataManager?: TimelineDataManager;

  @state()
  protected _locked = false;

  protected _targetBarVisible = false;
  protected _refTimeline: Ref<HTMLElement> = createRef();
  protected _timeline?: Timeline;
  protected _dataview?: DataView<FrigateCardTimelineItem>;

  // Need a way to separate when a user clicks (to pan the timeline) vs when a
  // user clicks (to choose a recording (non-event) to play).
  protected _pointerHeld:
    | (TimelineEventPropertiesResult & { window?: TimelineWindow })
    | null = null;
  protected _ignoreClick = false;

  protected readonly _isHoverableDevice = isHoverableDevice();

  // Range changes are volumonous: throttle the calls on seeking.
  protected _throttledSetViewDuringRangeChange = throttle(
    this._setViewDuringRangeChange.bind(this),
    1000 / 10,
  );

  /**
   * Get a tooltip for a given timeline event.
   * @param source The FrigateBrowseMediaSource in question.
   * @returns The tooltip as a string to render.
   */
  protected _getTooltip(item: TimelineItem): string {
    const event = (<FrigateCardTimelineItem>item).event;
    const clientId = item.group
      ? this.cameras?.get(String(item.group))?.frigate.client_id
      : null;
    if (!this._isHoverableDevice || !event || !clientId) {
      // Don't display tooltips on touch devices, they just get in the way of
      // the drawer.
      return '';
    }

    const eventAttr = `event='${JSON.stringify(event)}'`;
    const detailsAttr = this.thumbnailDetails ? 'details' : '';

    // Cannot use Lit data-bindings as visjs requires a string for tooltips.
    // Note that changes to attributes here must be mirrored in the xss
    // whitelist in `_getOptions()` .
    return `
      <frigate-card-timeline-thumbnail
        thumbnail="${getEventThumbnailURL(clientId, event)}"
        ${detailsAttr}
        ${eventAttr}
        label="${getEventTitle(event)}"
      >
      </frigate-card-timeline-thumbnail>`;
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (!this.hass || !this.view || !this.timelineConfig) {
      return;
    }
    return html`<div
      @frigate-card:timeline:hass-request=${(request: HASSRequestEvent) => {
        request.hass = this.hass;
      }}
      class="timeline"
      ${ref(this._refTimeline)}
    >
      <ha-icon
        class="lock"
        .icon=${`mdi:${this._locked ? 'lock' : 'lock-open-variant'}`}
        @click=${() => {
          this._locked = !this._locked;
        }}
        aria-label="${this._locked
          ? localize('timeline.unlock')
          : localize('timeline.lock')}"
        title="${this._locked ? localize('timeline.unlock') : localize('timeline.lock')}"
      >
      </ha-icon>
    </div>`;
  }

  /**
   * Get all the keys of the cameras in scope for this timeline.
   * @returns A set of camera ids (may be empty).
   */
  protected _getTimelineCameraIDs(): Set<string> {
    if (!this.mini || !this.cameras) {
      return this._getAllCameraIDs();
    }
    return getAllDependentCameras(this.cameras, this.view?.camera);
  }

  /**
   * Get all the keys of all cameras.
   * @returns A set of camera ids (may be empty).
   */
  protected _getAllCameraIDs(): Set<string> {
    return new Set(this.cameras?.keys());
  }

  /**
   * Create recording objects.
   * @param time The target time for the recordings.
   * @param cameraIDs The camera IDs to create recordings for.
   * @param onlyShowMatchingHour If `true` only shows the hour matching the target
   * for the provided cameras, otherwise shows all hours.
   * @returns
   */
  protected _createRecordingChildren(
    time: Date,
    cameraIDs: Set<string>,
    onlyShowMatchingHour: boolean,
  ): FrigateBrowseMediaSource[] {
    const children: FrigateBrowseMediaSource[] = [];

    for (const cameraID of cameraIDs) {
      const config = this.cameras?.get(cameraID);
      const recordingSummary =
        this.timelineDataManager?.getRecordingSummaryForCamera(cameraID);
      if (!config?.frigate.camera_name || !recordingSummary) {
        continue;
      }

      for (const dayData of recordingSummary) {
        for (const hourData of dayData.hours) {
          const hour = add(dayData.day, { hours: hourData.hour });
          const startHour = startOfHour(hour);
          const endHour = endOfHour(hour);
          const isMatchingHour = time >= startHour && time <= endHour;

          // If asked to only provide recordings for a given camera show all
          // hours, otherwise only show the matching hour from all cameras.
          if (!onlyShowMatchingHour || isMatchingHour) {
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
    return children;
  }

  /**
   * Change the view to a recording.
   * @param targetTime The time of the recording to show.
   * @param cameraID An optional camera to show a recording of, otherwise all
   * cameras are shown at the given time.
   */
  protected async _changeViewToRecording(
    targetTime: Date,
    cameraID?: string,
  ): Promise<void> {
    if (!this.hass || !this.timelineConfig || !this.cameras) {
      return;
    }

    const cameraIDs = cameraID ? new Set([cameraID]) : this._getAllCameraIDs();
    const children = this._createRecordingChildren(targetTime, cameraIDs, !cameraID);
    if (!children.length) {
      return;
    }
    const viewerContext = this._generateMediaViewerContextForChildren(
      children,
      targetTime,
    );
    const childIndex = this._findChildIndex(
      children,
      startOfHour(targetTime),
      cameraIDs,
    );
    const child = childIndex !== null ? children[childIndex] : null;

    if (childIndex !== null && child !== null) {
      this.view
        ?.evolve({
          view: 'recording',
          target: createEventParentForChildren(localize('common.recordings'), children),
          childIndex: childIndex,
          ...(child.frigate?.cameraID && { camera: child.frigate?.cameraID }),
        })
        .mergeInContext(viewerContext)
        .dispatchChangeEvent(this);
    }
  }

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
  protected _findChildIndex(
    children: FrigateBrowseMediaSource[],
    targetTime: Date,
    cameraIDs: Set<string>,
    refPoint?: 'start' | 'end',
  ): number | null {
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
  }

  /**
   * Called whenever the range is in the process of being changed.
   * @param properties
   */
  protected _timelineRangeChangeHandler(properties: TimelineRangeChange): void {
    if (this._pointerHeld) {
      this._ignoreClick = true;
    }

    if (
      this._timeline &&
      properties.byUser &&
      // Do not adjust select children or seek during zoom events.
      properties.event.type !== 'wheel' &&
      properties.event.additionalEvent !== 'pinchin' &&
      properties.event.additionalEvent !== 'pinchout'
    ) {

      const targetTime = this._pointerHeld?.window
        ? add(properties.start, {
            seconds:
              (this._pointerHeld.time.getTime() -
                this._pointerHeld.window.start.getTime()) /
              1000,
          })
        : properties.end;

      if (this._pointerHeld) {
        this._setTargetBarAppropriately(targetTime);
      }

      this._throttledSetViewDuringRangeChange(targetTime, properties);
    }
  }

  /**
   * Set the target bar at a given time.
   * @param targetTime
   */
  protected _setTargetBarAppropriately(targetTime: Date): void {
    if (!this._timeline) {
      return;
    }

    const targetBarOn =
      !this._locked ||
      (!this.view?.is('timeline') &&
        this._timeline.getSelection().some((id) => {
          const item = this._dataview?.get(id);
          return (
            item &&
            item.start &&
            item.end &&
            targetTime.getTime() >= item.start &&
            targetTime.getTime() <= item.end
          );
        }));

    if (targetBarOn) {
      if (!this._targetBarVisible) {
        this._timeline?.addCustomTime(targetTime, TIMELINE_TARGET_BAR_ID);
        this._targetBarVisible = true;
      } else {
        this._timeline?.setCustomTime(targetTime, TIMELINE_TARGET_BAR_ID);
      }
    } else {
      this._removeTargetBar();
    }
  }

  /**
   * Remove the target bar.
   */
  protected _removeTargetBar(): void {
    if (this._targetBarVisible) {
      this._timeline?.removeCustomTime(TIMELINE_TARGET_BAR_ID);
      this._targetBarVisible = false;
    }
  }

  /**
   * Set the view during a range change.
   * @param targetTime The target time.
   * @param properties The range change properties.
   * @returns
   */
  protected _setViewDuringRangeChange(
    targetTime: Date,
    properties: TimelineRangeChange,
  ): void {
    if (!this._timeline || !this.view || !this.view.target?.children?.length) {
      return;
    }

    const canSeek = !!this.view?.isViewerView();
    const context = canSeek
      ? this._generateMediaViewerContextForChildren(
          this.view.target.children,
          targetTime,
        )
      : null;

    const childIndex = this._locked
      ? null
      : this._findChildIndex(
          this.view.target.children,
          targetTime,
          this._getTimelineCameraIDs(),
          properties.event.additionalEvent === 'panright' ? 'end' : 'start',
        );

    if (canSeek || (childIndex !== null && childIndex !== this.view.childIndex)) {
      this.view
        .evolve({
          ...(childIndex !== null && {
            childIndex: childIndex,
          }),
        }) // Whether or not to set the timeline window.
        .mergeInContext({
          ...this._generateTimelineContext({ noSetWindow: true }),
          ...context,
        })
        .dispatchChangeEvent(this);
    }
  }

  /**
   * Generate the media view context for a set of media children (used to set
   * seek times into each media item).
   * @param children The media children.
   * @param targetTime The target time.
   * @returns The ViewContext.
   */
  protected _generateMediaViewerContextForChildren(
    children: FrigateBrowseMediaSource[],
    targetTime: Date,
  ): ViewContext {
    if (!this.timelineDataManager) {
      return {};
    }
    const seek = new Map();
    const segmentsDataset = this.timelineDataManager.recordingSegments;
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
            order: sortSegmentsOldestToYoungest,
          });
          seekSeconds = this._getSeekTimeInSegments(
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
  }

  /**
   * Get the number of seconds to seek into a video stream consisting of the
   * provided segments to reach the target time provided.
   * @param startTime The earliest allowable time to seek from.
   * @param targetTime Target time.
   * @param segments An array of segments dataset items. Must be sorted from oldest to youngest.
   * @returns
   */
  protected _getSeekTimeInSegments(
    startTime: Date,
    targetTime: Date,
    segments: RecordingSegmentsItem[],
  ): number | null {
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
      const end =
        segment.end > targetTime.getTime() ? targetTime.getTime() : segment.end;
      seekMilliseconds += end - start;
    }
    return seekMilliseconds / 1000;
  }

  /**
   * Called whenever the timeline is clicked.
   * @param properties The properties of the timeline click event.
   */
  protected _timelineClickHandler(properties: TimelineEventPropertiesResult): void {
    // Calls to stopEventFromActivatingCardWideActions() are included for
    // completeness. Timeline does not support card-wide events and they are
    // disabled in card.ts in `_getMergedActions`.
    if (properties.what === 'item' || this._ignoreClick) {
      stopEventFromActivatingCardWideActions(properties.event);
    }

    if (!this._ignoreClick && properties.what) {
      if (
        this.timelineConfig?.show_recordings &&
        ['background', 'group-label', 'axis'].includes(properties.what)
      ) {
        if (['background', 'group-label'].includes(properties.what)) {
          stopEventFromActivatingCardWideActions(properties.event);
          const window = this._timeline?.getWindow();
          if (window) {
            if (properties.group) {
              this._changeViewToRecording(
                properties.what === 'background' ? properties.time : window.end,
                String(properties.group));
            } else if (this.mini && this.view?.camera) {
              // In mini mode group may not be displayed / used, so just use the camera directly.
              this._changeViewToRecording(window.end, this.view.camera);
            }
          }
        } else {
          stopEventFromActivatingCardWideActions(properties.event);
          this._changeViewToRecording(properties.time);
        }
      } else if (
        properties.what === 'item' &&
        properties.item &&
        this.view &&
        this.view.target?.children
      ) {
        let childIndex: number | null = null;
        let target: FrigateBrowseMediaSource | null = null;
        let context: ViewContext = {};

        if (this.view.is('recording')) {
          const thumbnails = this._generateThumbnails(properties.item);

          if (thumbnails) {
            target = thumbnails.target;
            childIndex = thumbnails.childIndex;
            if (thumbnails.target?.children?.length) {
              context = this._generateMediaViewerContextForChildren(
                thumbnails.target.children,
                properties.time,
              );
            }
          }
        } else {
          childIndex = this.view.target.children.findIndex(
            (child) => child.frigate?.event?.id === properties.item,
          );
        }

        if (childIndex !== null && childIndex >= 0) {
          this.view
            ?.evolve({
              childIndex: childIndex,
              ...(target && { target: target }),
            })
            .mergeInContext(context)
            .dispatchChangeEvent(this);
          if (this.view.is('timeline')) {
            dispatchFrigateCardEvent(this, 'thumbnails:open');
          }
        } else if (this.view.is('timeline')) {
          dispatchFrigateCardEvent(this, 'thumbnails:close');
        }
      }
    }

    this._ignoreClick = false;
  }

  /**
   * Get a broader prefetch window from a start and end basis.
   * @param start The earlier date.
   * @param end The later date.
   * @returns An object with a `start` and `end` key to prefetch.
   */
  protected _getPrefetchWindow(start: Date, end: Date): [Date, Date] {
    const delta = differenceInSeconds(end, start);
    return [sub(start, { seconds: delta }), add(end, { seconds: delta })];
  }

  /**
   * Handle a range change in the timeline.
   * @param properties vis.js provided range information.
   */
  protected _timelineRangeChangedHandler(properties: {
    start: Date;
    end: Date;
    byUser: boolean;
    event: Event & { additionalEvent: string };
  }): void {
    if (!properties.byUser) {
      return;
    }
    this._removeTargetBar();

    if (this.hass && this.cameras && this._timeline && this.timelineConfig) {
      const [prefetchStart, prefetchEnd] = this._getPrefetchWindow(
        properties.start,
        properties.end,
      );
      this.timelineDataManager
        ?.fetchIfNecessary(this, this.hass, prefetchStart, prefetchEnd)
        .then(() => {
          // Don't show event thumbnails if the user is looking at recordings,
          // as the recording "hours" are the media, not the event
          // clips/snapshots.
          if (this._timeline && this.view && !this.view?.is('recording')) {
            const thumbnails = this._generateThumbnails();
            // Update the view to reflect the new thumbnails and the timeline
            // window in the context.
            this.view
              .evolve({
                target: thumbnails?.target ?? null,
                childIndex: thumbnails?.childIndex ?? null,
              })
              .mergeInContext(this._generateTimelineContext({ noSetWindow: true }))
              .dispatchChangeEvent(this);
          }
        });
    }
  }

  /**
   * Regenerate the thumbnails from the timeline events.
   * @param selectedItem An id to select from the thumbnails (currently selected
   * item is used if none is specified).
   * @returns An object with two keys, or null on error. The keys are `target`
   * containing all the thumbnails, and `childIndex` to refer to the currently
   * selected thumbnail.
   */
  protected _generateThumbnails(selectedItem?: IdType): {
    target: FrigateBrowseMediaSource;
    childIndex: number | null;
  } | null {
    if (!this._timeline) {
      return null;
    }

    const selected: IdType[] = selectedItem
      ? [selectedItem]
      : this._timeline.getSelection();
    let childIndex = -1;
    const children: FrigateBrowseMediaSource[] = [];
    this._dataview?.get({ 
      filter: (item) => item.type !== 'background',
      order: sortTimelineItemsYoungestToOldest }
    ).forEach((item) => {
      const cameraID = item.group ? String(item.group) : null;
      const cameraConfig = cameraID ? this.cameras?.get(cameraID) : null;
      const event = item.event;
      const media =
        event?.has_clip && this.timelineConfig?.media !== 'snapshots'
          ? 'clips'
          : event?.has_snapshot
          ? 'snapshots'
          : null;

      if (
        cameraID &&
        cameraConfig &&
        event &&
        media &&
        cameraConfig.frigate.camera_name
      ) {
        children.push(
          createChild(
            getEventTitle(event),
            getEventMediaContentID(
              cameraConfig.frigate.client_id,
              cameraConfig.frigate.camera_name,
              event.id,
              media,
            ),
            {
              thumbnail: getEventThumbnailURL(cameraConfig.frigate.client_id, event),
              event: event,
              cameraID: cameraID,
            },
          ),
        );
        if (selected.includes(event.id)) {
          childIndex = children.length - 1;
        }
      }
    });
    if (!children.length) {
      return null;
    }

    return {
      target: createEventParentForChildren('Timeline events', children),
      childIndex: childIndex < 0 ? null : childIndex,
    };
  }

  /**
   * Build the visjs dataset to render on the timeline.
   * @returns The dataset.
   */
  protected _getGroups(): DataGroupCollectionType {
    const groups: FrigateCardGroupData[] = [];

    this._getTimelineCameraIDs().forEach((cameraID) => {
      const cameraConfig = this.cameras?.get(cameraID);
      if (cameraConfig) {
        if (
          cameraConfig.frigate.camera_name &&
          cameraConfig.frigate.camera_name !== CAMERA_BIRDSEYE
        ) {
          groups.push({
            id: cameraID,
            content: getCameraTitle(this.hass, cameraConfig),
          });
        }
      }
    });
    return new DataSet(groups);
  }

  /**
   * Given an event get an appropriate start/end time window around the event.
   * @param event The FrigateEvent to consider.
   * @returns A tuple of start/end date.
   */
  protected _getStartEndFromEvent(event: FrigateEvent): [Date, Date] {
    const windowSeconds = this._getConfiguredWindowSeconds();
    if (event.end_time) {
      if (event.end_time - event.start_time > windowSeconds) {
        // If the event is larger than the configured window, only show the most
        // recent portion of the event that fits in the window.
        return [
          sub(fromUnixTime(event.end_time), { seconds: windowSeconds }),
          fromUnixTime(event.end_time),
        ];
      } else {
        // If the event is shorter than the configured window, center the event
        // in the window.
        const gap = windowSeconds - (event.end_time - event.start_time);
        return [
          sub(fromUnixTime(event.start_time), { seconds: gap / 2 }),
          add(fromUnixTime(event.end_time), { seconds: gap / 2 }),
        ];
      }
    }
    // If there's no end-time yet, place the start-time in the center of the
    // time window.
    return [
      sub(fromUnixTime(event.start_time), { seconds: windowSeconds / 2 }),
      add(fromUnixTime(event.start_time), { seconds: windowSeconds / 2 }),
    ];
  }

  /**
   * Given a recording get the start/end window.
   * @param recording The FrigateRecording to consider.
   * @returns A tuple of start/end date.
   */
  protected _getStartEndFromRecording(recording: FrigateRecording): [Date, Date] {
    return [fromUnixTime(recording.start_time), fromUnixTime(recording.end_time)];
  }

  /**
   * Get the configured window length in seconds.
   */
  protected _getConfiguredWindowSeconds(): number {
    return (
      this.timelineConfig?.window_seconds ??
      frigateCardConfigDefaults.timeline.window_seconds
    );
  }

  /**
   * Get desired timeline start/end time.
   * @returns A tuple of start/end date.
   */
  protected _getStartEnd(): [Date, Date] {
    const end = new Date();
    const start = sub(end, {
      seconds: this._getConfiguredWindowSeconds(),
    });
    return [start, end];
  }

  /**
   * Determine if the timeline should use clustering.
   * @returns `true` if the timeline should cluster, `false` otherwise.
   */
  protected _isClustering(): boolean {
    return (
      !!this.timelineConfig?.clustering_threshold &&
      this.timelineConfig.clustering_threshold > 0
    );
  }

  /**
   * Get timeline options.
   */
  protected _getOptions(): TimelineOptions | null {
    if (!this.timelineConfig) {
      return null;
    }

    const [start, end] = this._getStartEnd();

    // Configuration for the Timeline, see:
    // https://visjs.github.io/vis-timeline/docs/timeline/#Configuration_Options
    return {
      cluster: this._isClustering()
        ? {
            // It would be better to automatically calculate `maxItems` from the
            // rendered height of the timeline (or group within the timeline) so
            // as to not waste vertical space (e.g. after the user changes to
            // fullscreen mode). Unfortunately this is not easy to do, as we
            // don't know the height of the timeline until after it renders --
            // and if we adjust `maxItems` then we can get into an infinite
            // resize loop. Adjusting the `maxItems` of a timeline, after it's
            // created, also does not appear to work as expected.
            maxItems: this.timelineConfig.clustering_threshold,

            clusterCriteria: (first: TimelineItem, second: TimelineItem): boolean => {
              // Never include the target media in a cluster, and never group
              // different object types together (e.g. person and car).
              return (
                [first.type, second.type].every((type) => type !== 'background') &&
                first.type === second.type &&
                !!first.id &&
                first.id !== this.view?.media?.frigate?.event?.id &&
                !!second.id &&
                second.id != this.view?.media?.frigate?.event?.id &&
                (<FrigateCardTimelineItem>first).event?.label ===
                  (<FrigateCardTimelineItem>second).event?.label
              );
            },
          }
        : (false as TimelineOptionsCluster),
      minHeight: '100%',
      maxHeight: '100%',
      zoomMax: 1 * 24 * 60 * 60 * 1000,
      zoomMin: 1 * 1000,
      selectable: true,
      start: start,
      end: end,
      groupHeightMode: 'auto',
      tooltip: {
        followMouse: true,
        overflowMethod: 'cap',
        template: this._getTooltip.bind(this),
      },
      xss: {
        disabled: false,
        filterOptions: {
          whiteList: {
            'frigate-card-timeline-thumbnail': [
              'details',
              'thumbnail',
              'label',
              'event',
            ],
            div: ['title'],
            span: ['style'],
          },
        },
      },
    };
  }

  /**
   * Determine if the component should be updated.
   * @param _changedProps The changed properties.
   * @returns
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected shouldUpdate(_changedProps: PropertyValues): boolean {
    return !!this.hass && !!this.cameras && this.cameras.size > 0;
  }

  /**
   * Update the timeline from the view object.
   */
  protected async _updateTimelineFromView(): Promise<void> {
    if (
      !this.hass ||
      !this.cameras ||
      !this.view ||
      !this.timelineConfig ||
      !this._timeline
    ) {
      return;
    }

    const event = this.view?.media?.frigate?.event;
    const recording = this.view?.media?.frigate?.recording;

    const [windowStart, windowEnd] = event
      ? this._getStartEndFromEvent(event)
      : recording
      ? this._getStartEndFromRecording(recording)
      : this._getStartEnd();

    let fetched = false;
    if (!this._pointerHeld) {
      // Don't fetch any data or touch the timeline in any way if the user is
      // currently interacting with it. Without this the subsequent data fetches
      // (via fetchIfNecessary) may update the timeline contents which causes
      // the visjs timeline to stop dragging/panning operations which is very
      // disruptive to the user.
      const [prefetchStart, prefetchEnd] = this._getPrefetchWindow(
        windowStart,
        windowEnd,
      );
      fetched = !!(await this.timelineDataManager?.fetchIfNecessary(
        this,
        this.hass,
        prefetchStart,
        prefetchEnd,
      ));
    }

    this._timeline.setSelection(event ? [event.id] : [], {
      focus: false,
      animation: {
        animation: false,
        zoom: false,
      },
    });

    if (!this._pointerHeld && event && this._isClustering()) {
      // Hack: Clustering may not update unless the dataset changes, artifically
      // update the dataset to ensure the newly selected item cannot be included
      // in a cluster. Only do this when the pointer is not held to avoid
      // interrupting the user and to make the timeline smoother.
      this.timelineDataManager?.rewriteItem(event.id);
    }

    if (!this._pointerHeld && !this.view.context?.timeline?.noSetWindow) {
      // Regenerate the thumbnails after the selection, to allow the new selection
      // to be in the generated view.
      const context = this.view.context?.timeline;
      const timelineWindow = this._timeline.getWindow();

      // If there's a set context window, always move to it.
      if (context?.window && !isEqual(context.window, timelineWindow)) {
        this._timeline.setWindow(context.window.start, context.window.end);
      } else if (event || recording) {
        const source = event ?? (recording as FrigateEvent | FrigateRecording);
        const start = fromUnixTime(source.start_time);
        const end = source.end_time ? fromUnixTime(source.end_time) : 0;

        // If there's an event or recording outside the current window, move to it.
        if (
          start < timelineWindow.start ||
          start > timelineWindow.end ||
          (end && (end < timelineWindow.start || end > timelineWindow.end))
        ) {
          this._timeline.setWindow(windowStart, windowEnd);
        }
      }
    }

    // Only generate thumbnails if an actual fetch occurred, to avoid getting
    // stuck in a loop (the subsequent fetches will not actually fetch since the
    // data will have been cached).
    //
    // Timeline receives a new `view`
    //  -> Events fetched
    //    -> Thumbnails generated
    //      -> New view dispatched (to load thumbnails into outer carousel).
    //  -> New view received ... [loop]
    //
    // Also don't generate thumbnails in mini-timelines (they will already have
    // been generated), or if the media child is a recording.
    if (
      (fetched || !this.view.context?.timeline?.generatedThumbnails) &&
      !this.mini &&
      !recording
    ) {
      const thumbnails = this._generateThumbnails();
      this.view
        ?.evolve({
          target: thumbnails?.target ?? null,
          childIndex: thumbnails?.childIndex ?? null,
        })
        .mergeInContext(this._generateTimelineContext())
        .dispatchChangeEvent(this);
    }
  }

  /**
   * Generate the context for timeline views.
   * @param options Configure how the context is set.
   * @returns The TimelineViewContext object.
   */
  protected _generateTimelineContext(options?: {
    noSetWindow?: boolean;
    generatedThumbnails?: boolean;
  }): ViewContext {
    const newContext: TimelineViewContext = {
      generatedThumbnails: options?.generatedThumbnails ?? true,
    };

    if (options?.noSetWindow) {
      newContext.noSetWindow = options.noSetWindow;
    }
    return { timeline: newContext };
  }

  /**
   * Called when an update will occur.
   * @param changedProps The changed properties
   */
  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('thumbnailSize')) {
      if (this.thumbnailSize !== undefined) {
        this.style.setProperty(
          '--frigate-card-thumbnail-size',
          `${this.thumbnailSize}px`,
        );
      } else {
        this.style.removeProperty('--frigate-card-thumbnail-size');
      }
    }

    if (changedProps.has('timelineConfig')) {
      if (this.timelineConfig?.show_recordings) {
        this.setAttribute('recordings', '');
      } else {
        this.removeAttribute('recordings');
      }
    }
  }

  /**
   * Destroy/reset the timeline.
   */
  protected _destroy(): void {
    this._timeline?.destroy();
    this._timeline = undefined;
  }

  /**
   * Called when the component is updated.
   * @param changedProperties The changed properties if any.
   */
  protected updated(changedProperties: PropertyValues): void {
    super.updated(changedProperties);

    if (changedProperties.has('cameras')) {
      this._destroy();
    }

    const options = this._getOptions();

    if (
      this.timelineDataManager &&
      this._refTimeline.value &&
      options &&
      this.timelineConfig &&
      (changedProperties.has('timelineConfig') ||
        (this.mini &&
          changedProperties.has('view') &&
          this.view?.camera !== changedProperties.get('view').camera))
    ) {
      if (this._timeline) {
        this._destroy();
      }

      const groups = this._getGroups();
      if (!groups.length) {
        if (!this.mini) {
          // Don't show an empty timeline, show a message instead.
          dispatchMessageEvent(this, localize('error.timeline_no_cameras'), 'info', {
            icon: 'mdi:chart-gantt',
          });
        }
        return;
      }

      this._dataview = this.timelineDataManager.createDataView(
        this._getTimelineCameraIDs(),
        !!this.timelineConfig.show_recordings,
        this.timelineConfig.media,
      );

      if (this.mini && groups.length === 1) {
        // In a mini timeline, if there's only one group don't bother grouping
        // at all.
        this._timeline = new Timeline(
          this._refTimeline.value,
          this._dataview,
          options,
        ) as Timeline;
        this.removeAttribute('groups');
      } else {
        this._timeline = new Timeline(
          this._refTimeline.value,
          this._dataview,
          groups,
          options,
        ) as Timeline;
        this.setAttribute('groups', '');
      }

      this._timeline.on('rangechanged', this._timelineRangeChangedHandler.bind(this));
      this._timeline.on('click', this._timelineClickHandler.bind(this));
      this._timeline.on('rangechange', this._timelineRangeChangeHandler.bind(this));

      // This complexity exists to ensure we can tell between a click that
      // causes the timeline zoom/range to change, and a 'static' click on the
      // // timeline (which may need to trigger a card wide event).
      this._timeline.on('mouseDown', (ev: TimelineEventPropertiesResult) => {
        const window = this._timeline?.getWindow();
        this._pointerHeld = {
          ...ev,
          ...(window && { window: window }),
        };
        this._ignoreClick = false;
      });
      this._timeline.on('mouseUp', () => {
        this._pointerHeld = null;
        this._removeTargetBar();
      });
    }

    if (changedProperties.has('view')) {
      this._updateTimelineFromView();
    }
  }

  /**
   * Return compiled CSS styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(timelineCoreStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-timeline-thumbnail': FrigateCardTimelineThumbnail;
    'frigate-card-timeline-core': FrigateCardTimelineCore;
  }
}
