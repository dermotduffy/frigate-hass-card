import { ViewContext } from 'view';
import { ClipsOrSnapshots, FrigateCardView } from '../types.js';
import { dispatchFrigateCardEvent } from '../utils/basic.js';
import { MediaQueries } from './media-queries';
import { MediaQueriesClassifier } from './media-queries-classifier.js';
import { MediaQueriesResults } from './media-queries-results';

interface ViewEvolveParameters {
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
   * Detect if a view change represents a major "media change" for the given
   * view.
   * @param prev The previous view.
   * @param curr The current view.
   * @returns True if the view change is a real media change.
   */
  public static isMajorMediaChange(prev?: View, curr?: View): boolean {
    return (
      !prev ||
      !curr ||
      prev.view !== curr.view ||
      prev.camera !== curr.camera ||
      // When in live mode, take overrides (substreams) into account in deciding
      // if this is a major media change.
      (curr.view === 'live' &&
        prev.context?.live?.overrides?.get(prev.camera) !==
          curr.context?.live?.overrides?.get(curr.camera)) ||
      // When in the live view, the queryResults contain the events that
      // happened in the past -- not reflective of the actual live media viewer
      // the user is seeing.
      (curr.view !== 'live' && prev.queryResults !== curr.queryResults)
    );
  }

  public static adoptFromViewIfAppropriate(next: View, curr?: View): void {
    if (!curr) {
      return;
    }

    // In certain cases it may make sense to adopt parameters from a prior view.
    //
    // * Case #1: If the user is currently using the viewer, and then switches
    //   to the gallery we make an attempt to keep the query/queryResults the
    //   same so the gallery can be used to click back and forth to the viewer,
    //   and the selected media can be centered in the gallery. See the matching
    //   code in `updated()` in `gallery.ts`. We specifically must ensure that
    //   the new target media of the gallery (e.g. clips, snapshots or
    //   recordings) is equal to the queries that are currently used in the
    //   viewer. See:
    //   https://github.com/dermotduffy/frigate-hass-card/issues/885
    //
    // * Case #2: If the user is looking at media in the `media` view and then
    //   changes camera to the *current* camera (via the menu) it will cause a
    //   new view to issue without a query and just the 'media' view, which
    //   means the viewer cannot know what kind of media to fetch.
    //
    // * Case #3: Staying within the live view in order to preserve substreams
    //   turned on. See:
    //   https://github.com/dermotduffy/frigate-hass-card/issues/1122
    //

    let currentQueriesView: ClipsOrSnapshots | 'recordings' | null = null;
    if (MediaQueriesClassifier.areEventQueries(curr.query)) {
      const queries = curr.query.getQueries();
      if (queries?.every((query) => query.hasClip)) {
        currentQueriesView = 'clips';
      } else if (queries?.every((query) => query.hasSnapshot)) {
        currentQueriesView = 'snapshots';
      }
    } else if (MediaQueriesClassifier.areRecordingQueries(curr.query)) {
      currentQueriesView = 'recordings';
    }

    const hasNoQueryOrResults = !next.query || !next.queryResults;
    const switchingToGalleryFromViewer =
      curr.isViewerView() && next.isGalleryView() && next.view === currentQueriesView;
    const switchingToMediaFromMedia = curr?.is('media') && next.is('media');

    if (hasNoQueryOrResults) {
      if (switchingToGalleryFromViewer) {
        if (curr.query) {
          next.query = curr.query;
        }
        if (curr.queryResults) {
          next.queryResults = curr.queryResults;
        }
      } else if (switchingToMediaFromMedia && currentQueriesView) {
        next.view =
          currentQueriesView === 'clips'
            ? 'clip'
            : currentQueriesView === 'snapshots'
            ? 'snapshot'
            : 'recording';
      }
    }

    if (
      curr.is('live') &&
      next.is('live') &&
      curr.context?.live?.overrides &&
      !next.context?.live?.overrides
    ) {
      const nextLiveContext = next.context?.live ?? {};
      nextLiveContext.overrides = curr.context.live.overrides;
      next.mergeInContext({ live: nextLiveContext });
    }
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
  public is(view: FrigateCardView): boolean {
    return this.view == view;
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
