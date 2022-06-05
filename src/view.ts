import type { FrigateBrowseMediaSource, FrigateCardView } from './types.js';
import { dispatchFrigateCardEvent } from './utils/basic.js';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ViewContext {}

export interface ViewEvolveParameters {
  view?: FrigateCardView;
  camera?: string;
  target?: FrigateBrowseMediaSource | null;
  childIndex?: number | null;
  previous?: View | null;
  context?: ViewContext | null;
}

export interface ViewParameters extends ViewEvolveParameters {
  view: FrigateCardView;
  camera: string;
}

export class View {
  view: FrigateCardView;
  camera: string;
  target: FrigateBrowseMediaSource | null;
  childIndex: number | null;
  previous: View | null;
  context: ViewContext | null;

  constructor(params: ViewParameters) {
    this.view = params.view;
    this.camera = params.camera;
    this.target = params.target ?? null;
    this.childIndex = params.childIndex ?? null;
    this.previous = params.previous ?? null;
    this.context = params.context ?? null;
  }

  /**
   * Selects the best view for a non-Frigate camera.
   * @param view The wanted view.
   * @returns The closest view supported by the non-Frigate camera.
   */
  public static selectBestViewForNonFrigateCameras(view: FrigateCardView) {
    return ['timeline', 'image'].includes(view) ? view : 'live';
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
      previous: this.previous,
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

      // Special case: Set the previous to this of the evolved view (rather than
      // the previous of this).
      previous: params.previous !== undefined ? params.previous : this,
    });
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
    return this.view == 'clips' || this.view == 'snapshots';
  }

  /**
   * Determine if a view is of a piece of media (i.e. not the gallery).
   */
  public isMediaView(): boolean {
    return this.isViewerView() || this.is('live');
  }

  /**
   * Determine if a view is for the media viewer.
   */
  public isViewerView(): boolean {
    return ['clip', 'snapshot', 'media'].includes(this.view);
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
   * Get the media type for this view if available.
   * @returns Whether the media is `clips` or `snapshots` or unknown (`null`)
   */
  public getMediaType(): 'clips' | 'snapshots' | null {
    return this.isClipRelatedView()
      ? 'clips'
      : this.isSnapshotRelatedView()
      ? 'snapshots'
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
    dispatchFrigateCardEvent(target, 'change-view', this);
  }
}
