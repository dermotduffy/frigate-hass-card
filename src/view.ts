// TODO: Implement gallery.
// TODO: Improve data storage in data-manager to allow fetching by limit not time.
// TODO: Live should get most recent events regardless of when they were.
// TODO: Refactor thumbnailsControlSchema to all use the shortform for other thumbnail users beyond live.
// TODO: Should be able to set live media to 'all' and have it work.
// TODO: If I replace the indexdb backend with just a map / array, does it work? Might be better.
// TODO: limit param in recordings should do something
// TODO: Callers of all async methods of data-engine need to catch errors.
// TODO: Search for references to frigate.js and see where it's being called outside of the dataManager. Can I collapse some of those functions in?
// TODO: Are there elements of ViewMedia (e.g. getEventCount) that should be moved into subclasses (e.g. a recording subclass).
// TODO: ts-prune https://camchenry.com/blog/deleting-dead-code-in-typescript
// TODO: In MediaQueriesBase, do we need to generic? Just have T be a MediaQuery?
// TODO: Are areEventQueries and areRecordingQueries should be in a classifier to keep with the pattern used elsewhere.
// TODO: Callers to the creation of new views for events/recordings need to dispatch events themselves when none are found.
// TODO: Examine how much of utils/frigate.ts can be moved into the Frigate data engine.
// TODO: Add garbage collecting of segments not present in the recording summaries anymore.
// TODO: Do I need to dedup recordings? (i.e. multiple zones on same camera may need to be dedup'd somewhere before returning the view). The media getID() call may be useful for this.
// TODO: Verify that scrolling the timeline will seek forward in both Frigate recordings & events.
// TODO: In generateMediaViewerContext there is an assumption that recordings start/end on the hour, which is true for Frigate but that assumption should be in the engine.
// TODO: Do a fresh media query in the viewer on snapshot click, since the first query may (e.g.) only have requested events with snapshots (which would miss an event with just a clip).
// TODO: In the viewer @click handlers should I use this.selected instead of calling carouselScrollPrevious()
// TODO: Implement seeking when the timeline is dragged.
// TODO: Can _timelineClickHandler be an async method in timeline-core to improve cleanliness?
// TODO: Can _timelineRangeChangedHandler be an async method in timeline-core to improve cleanliness?
// TODO: What should the timeline do when an event is clicked on that is not in the queryResults (or if queryResults is empty)?
// TODO: Should the timeline data source clear events (as it currently does) when the query changes?

import isEqual from 'lodash-es/isEqual';
import clone from 'lodash-es/clone.js';
import cloneDeep from 'lodash-es/cloneDeep.js';
import { ViewContext } from 'view';
import {
  FrigateCardUserSpecifiedView,
  FrigateCardView,
  FRIGATE_CARD_VIEWS_USER_SPECIFIED,
  FRIGATE_CARD_VIEW_DEFAULT,
} from './types.js';
import { dispatchFrigateCardEvent } from './utils/basic.js';
import { EventQuery, MediaQuery, RecordingQuery } from './utils/data/data-types.js';
import { ViewMedia } from './view-media.js';

export interface ViewEvolveParameters {
  view?: FrigateCardView;
  camera?: string;
  query?: MediaQueries | null;
  queryResults?: MediaQueriesResults | null;
  context?: ViewContext | null;
}

export interface ViewParameters extends ViewEvolveParameters {
  view: FrigateCardView;
  camera: string;
}

export class MediaQueriesBase<T extends MediaQuery> {
  protected _queries: T[] | null = null;

  protected constructor(queries?: T[]) {
    if (queries) {
      this._queries = queries;
    }
  }

  public clone(): MediaQueriesBase<T> {
    return cloneDeep(this);
  }

  public isEqual(that: MediaQueries): boolean {
    return isEqual(this.getQueries(), that.getQueries());
  }

  public areEventQueries(): this is EventMediaQueries {
    return this instanceof EventMediaQueries;
  }

  public areRecordingQueries(): this is RecordingMediaQueries {
    return this instanceof RecordingMediaQueries;
  }

  public getQueries(): T[] | null {
    return this._queries;
  }

  public setQueries(queries: T[]): void {
    this._queries = queries;
  }

  public setQueriesTime(start: Date, end: Date) {
    for (const query of this._queries ?? []) {
      query.start = start;
      query.end = end;
    }
  }
}

export class EventMediaQueries extends MediaQueriesBase<EventQuery> {
  constructor(queries?: EventQuery[]) {
    super(queries);
  }

  public convertToClipsQueries(): void {
    for (const query of this._queries ?? []) {
      delete query.hasSnapshot;
      query.hasClip = true;
    }
  }

  public clone(): EventMediaQueries {
    return cloneDeep(this);
  }
}

export class RecordingMediaQueries extends MediaQueriesBase<RecordingQuery> {
  constructor(queries?: RecordingQuery[]) {
    super(queries);
  }
}

export type MediaQueries = EventMediaQueries | RecordingMediaQueries;

export class MediaQueriesResults {
  protected _results: ViewMedia[] | null = null;
  protected _resultsTimestamp: Date | null = null;
  protected _selectedIndex: number | null = null;

  constructor(results?: ViewMedia[], selectedIndex?: number) {
    if (results) {
      this.setResults(results);
    }
    if (selectedIndex !== undefined) {
      this.selectResult(selectedIndex);
    }
  }

  public clone(): MediaQueriesResults {
    // Shallow clone -- will reuse the same _results object (as there are no
    // methods that support modification of the results themselves, and since
    // changing the selectedIndex on a consistent set of results is a common
    // operation).
    return clone(this);
  }

  public getResults(): ViewMedia[] | null {
    return this._results;
  }
  public getResultsCount(): number {
    return this._results?.length ?? 0;
  }
  public hasResults(): boolean {
    return !!this._results;
  }
  public setResults(results: ViewMedia[]) {
    this._results = results;
    this._resultsTimestamp = new Date();
  }
  public getResult(index?: number): ViewMedia | null {
    if (!this._results || index === undefined) {
      return null;
    }
    return this._results[index];
  }
  public getSelectedResult(): ViewMedia | null {
    return this._selectedIndex === null ? null : this.getResult(this._selectedIndex);
  }
  public getSelectedIndex(): number | null {
    return this._selectedIndex;
  }
  public hasSelectedResult(): boolean {
    return this.getSelectedResult() !== null;
  }
  public resetSelectedResult(): MediaQueriesResults {
    this._selectedIndex = null;
    return this;
  }
  public getResultsTimestamp(): Date | null {
    return this._resultsTimestamp;
  }

  public selectResult(index: number): MediaQueriesResults {
    if (this._results && index >= 0 && index < this._results.length) {
      this._selectedIndex = index;
    }
    return this;
  }
  public selectResultIfFound(func: (media: ViewMedia) => boolean): MediaQueriesResults {
    for (const [index, result] of this._results?.entries() ?? []) {
      if (func(result)) {
        this._selectedIndex = index;
        break;
      }
    }
    return this;
  }
  public selectBestResult(
    func: (media: ViewMedia[]) => number | null,
  ): MediaQueriesResults {
    if (this._results) {
      const resultIndex = func(this._results);
      if (resultIndex !== null) {
        this._selectedIndex = resultIndex;
      }
    }
    return this;
  }
}

export class View {
  public view: FrigateCardView;
  public camera: string;
  public query: MediaQueries | null;
  public queryResults: MediaQueriesResults | null;
  public context: ViewContext | null;

  constructor(params: ViewParameters) {
    this.view = params.view;
    this.camera = params.camera;
    this.query = params.query ?? null;
    this.queryResults = params.queryResults ?? null;
    this.context = params.context ?? null;
  }

  /**
   * Selects the best view for a non-Frigate camera.
   * @param view The wanted view.
   * @returns The closest view supported by the non-Frigate camera.
   */
  public static selectBestViewForNonFrigateCameras(view: FrigateCardView) {
    return ['timeline', 'image'].includes(view) ? view : FRIGATE_CARD_VIEW_DEFAULT;
  }

  /**
   * Selects the best view for a user specified view.
   * @param view The wanted view.
   * @returns The closest view supported that is user changeable.
   */
  public static selectBestViewForUserSpecified(view: FrigateCardView) {
    return FRIGATE_CARD_VIEWS_USER_SPECIFIED.includes(
      view as FrigateCardUserSpecifiedView,
    )
      ? view
      : FRIGATE_CARD_VIEW_DEFAULT;
  }

  /**
   * Detect if a view change represents a major "media change" for the given
   * view.
   * @param prev The previous view.
   * @param curr The current view.
   * @returns True if the view change is a real media change.
   */
  public static isMediaChange(prev?: View, curr?: View): boolean {
    return (
      !prev ||
      !curr ||
      prev.view !== curr.view ||
      prev.camera !== curr.camera ||
      // When in the live view, the target contains the events that happened in
      // the past -- not reflective of the actual live media viewer.
      (curr.view !== 'live' &&
        (prev.queryResults !== curr.queryResults ||
          prev.queryResults?.getSelectedResult() !==
            curr.queryResults?.getSelectedResult()))
    );
  }

  /**
   * Clone a view.
   */
  public clone(): View {
    return new View({
      view: this.view,
      camera: this.camera,
      query: this.query?.clone() ?? null,
      queryResults: this.queryResults?.clone() ?? null,
      // target: this.target,
      // targetIndex: this.targetIndex,
      // targetFingerprint: this.targetFingerprint,
      context: this.context,
    });
  }

  /**
   * Evolve this view by changing parameters and returning a new view.
   * @param params Parameters to change.
   * @returns A new evolved view.
   */
  public evolve(params: ViewEvolveParameters): View {
    return new View({
      view: params.view !== undefined ? params.view : this.view,
      camera: params.camera !== undefined ? params.camera : this.camera,
      query: params.query !== undefined ? params.query : this.query?.clone() ?? null,
      queryResults:
        params.queryResults !== undefined
          ? params.queryResults
          : this.queryResults?.clone() ?? null,
      context: params.context !== undefined ? params.context : this.context,
    });
  }

  /**
   * Merge view contexts.
   * @param context The context to merge in.
   * @returns This view.
   */
  public mergeInContext(context?: ViewContext): View {
    this.context = { ...this.context, ...context };
    return this;
  }

  /**
   * Remove a context key.
   * @param key The key to remove.
   * @returns This view.
   */
  public removeContext(key: keyof ViewContext): View {
    if (this.context) {
      delete this.context[key];
    }
    return this;
  }

  /**
   * Determine if current view matches a named view.
   */
  public is(name: string): boolean {
    return this.view == name;
  }

  /**
   * Determine if a view is a gallery.
   */
  public isGalleryView(): boolean {
    return ['clips', 'snapshots', 'recordings'].includes(this.view);
  }

  /**
   * Determine if a view is of a piece of media (including the media viewer,
   * live view, image view -- anything that can create a MediaLoadedInfo event).
   */
  public isAnyMediaView(): boolean {
    return this.isViewerView() || this.is('live') || this.is('image');
  }

  /**
   * Determine if a view is for the media viewer.
   */
  public isViewerView(): boolean {
    return ['clip', 'snapshot', 'media', 'recording'].includes(this.view);
  }

  /**
   * Get the default media type for this view if available.
   * @returns Whether the default media is `clips`, `snapshots`, `recordings` or unknown
   * (`null`).
   */
  public getDefaultMediaType(): 'clips' | 'snapshots' | 'recordings' | null {
    if (['clip', 'clips'].includes(this.view)) {
      return 'clips';
    }
    if (['snapshot', 'snapshots'].includes(this.view)) {
      return 'snapshots';
    }
    if (['recording', 'recordings'].includes(this.view)) {
      return 'recordings';
    }
    return null;
  }

  /**
   * Dispatch an event to request a view change.
   * @param target The target dispatching the event.
   */
  public dispatchChangeEvent(target: EventTarget): void {
    dispatchFrigateCardEvent(target, 'view:change', this);
  }
}

/**
 * Dispatch an event to change the view context.
 * @param target The EventTarget to send the event from.
 * @param context The context to change.
 */
export const dispatchViewContextChangeEvent = (
  target: EventTarget,
  context: ViewContext,
): void => {
  dispatchFrigateCardEvent(target, 'view:change-context', context);
};
