// Minor / later:
//  - TODO: ts-prune https://camchenry.com/blog/deleting-dead-code-in-typescript
//  - TODO: getRecordingTitle should use getCameraTitle but need hass.

// Hard:
//  - TODO: Implement dragging the timeline seeking forward in both Frigate recordings & events.
//  - TODO: Implement gallery.
//  - TODO: Remove FrigateBrowseMediaSource if not necessary (post-gallery).
//  - TODO: Remove browse-media.ts TODOs.
//  - TODO: What should the timeline do when an event is clicked on that is not in the queryResults (or if queryResults is empty)?
//  - TODO: Should the timeline data source clear events (as it currently does) when the query changes?

import { ViewContext } from 'view';
import {
  FrigateCardUserSpecifiedView,
  FrigateCardView,
  FRIGATE_CARD_VIEWS_USER_SPECIFIED,
  FRIGATE_CARD_VIEW_DEFAULT,
} from '../types.js';
import { dispatchFrigateCardEvent } from '../utils/basic.js';
import { MediaQueries } from './media-queries';
import { MediaQueriesResults } from './media-queries-results';

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
      // When in the live view, the queryResults contain the events that
      // happened in the past -- not reflective of the actual live media viewer
      // the user is seeing.
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
