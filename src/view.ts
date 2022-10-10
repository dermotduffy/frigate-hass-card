import { ViewContext } from 'view';
import {
  FrigateBrowseMediaSource,
  FrigateCardUserSpecifiedView,
  FrigateCardView,
  FRIGATE_CARD_VIEWS_USER_SPECIFIED,
  FRIGATE_CARD_VIEW_DEFAULT,
} from './types.js';
import { dispatchFrigateCardEvent } from './utils/basic.js';

export interface ViewEvolveParameters {
  view?: FrigateCardView;
  camera?: string;
  target?: FrigateBrowseMediaSource | null;
  childIndex?: number | null;
  context?: ViewContext | null;
}

export interface ViewParameters extends ViewEvolveParameters {
  view: FrigateCardView;
  camera: string;
}

export class View {
  public view: FrigateCardView;
  public camera: string;
  public target: FrigateBrowseMediaSource | null;
  public childIndex: number | null;
  public context: ViewContext | null;

  constructor(params: ViewParameters) {
    this.view = params.view;
    this.camera = params.camera;
    this.target = params.target ?? null;
    this.childIndex = params.childIndex ?? null;
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
      // When in the live view, the target/childIndex are the events that
      // happened in the past -- not reflective of the actual live media viewer.
      (curr.view !== 'live' &&
        (prev.target !== curr.target || prev.childIndex !== curr.childIndex))
    );
  }

  /**
   * Clone a view.
   */
  public clone(): View {
    return new View({
      view: this.view,
      camera: this.camera,
      target: this.target,
      childIndex: this.childIndex,
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
      target: params.target !== undefined ? params.target : this.target,
      childIndex: params.childIndex !== undefined ? params.childIndex : this.childIndex,
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
      delete(this.context[key]);
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
   * Get the viewer view given a gallery view.
   */
  public getViewerViewForGalleryView(): 'clip' | 'snapshot' | 'recording' | null {
    if (this.is('clips')) {
      return 'clip';
    } else if (this.is('snapshots')) {
      return 'snapshot';
    } else if (this.is('recordings')) {
      return 'recording';
    }
    return null;
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
   * Determine if a view is related to a clip or clips.
   */
  public isClipRelatedView(): boolean {
    return ['clip', 'clips'].includes(this.view);
  }

  /**
   * Determine if a view is related to a snapshot or snapshots.
   */
  public isSnapshotRelatedView(): boolean {
    return ['snapshot', 'snapshots'].includes(this.view);
  }

  /**
   * Determine if a view is related to a recording or recordings.
   */
   public isRecordingRelatedView(): boolean {
    return ['recording', 'recordings'].includes(this.view);
  }

  /**
   * Get the media type for this view if available.
   * @returns Whether the media is `clips`, `snapshots`, `recordings` or unknown
   * (`null`).
   */
  public getMediaType(): 'clips' | 'snapshots' | 'recordings' | null {
    return this.isClipRelatedView()
      ? 'clips'
      : this.isSnapshotRelatedView()
      ? 'snapshots'
      : this.isRecordingRelatedView()
      ? 'recordings'
      : null;
  }

  /**
   *  Get the media item that should be played.
   **/
  get media(): FrigateBrowseMediaSource | null {
    if (this.target) {
      if (this.target.children && this.childIndex !== null) {
        return this.target.children[this.childIndex] ?? null;
      }
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
