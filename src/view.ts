import type { FrigateBrowseMediaSource, FrigateCardView } from './types.js';
import { dispatchFrigateCardEvent } from './common.js';

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ViewContext {}

export interface ViewEvolveParameters {
  view?: FrigateCardView;
  camera?: string;
  target?: FrigateBrowseMediaSource;
  childIndex?: number;
  previous?: View;
  context?: ViewContext;
}

export interface ViewParameters extends ViewEvolveParameters {
  view: FrigateCardView;
  camera: string;
}

export class View {
  view: FrigateCardView;
  camera: string;
  target?: FrigateBrowseMediaSource;
  childIndex?: number;
  previous?: View;
  context?: ViewContext;

  constructor(params: ViewParameters) {
    this.view = params?.view;
    this.camera = params?.camera;
    this.target = params?.target;
    this.childIndex = params?.childIndex;
    this.previous = params?.previous;
    this.context = params?.context;
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
      view: params.view ?? this.view,
      camera: params.camera ?? this.camera,
      target: params.target ?? this.target,
      childIndex: params.childIndex ?? this.childIndex,
      previous: params.previous ?? this.previous,
      context: params.context ?? this.context,
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
    return ['clip', 'snapshot', 'event'].includes(this.view);
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
   *  Get the media item that should be played.
   **/
  get media(): FrigateBrowseMediaSource | undefined {
    if (this.target) {
      if (this.target.children && this.childIndex !== undefined) {
        return this.target.children[this.childIndex];
      }
      return this.target;
    }
    return undefined;
  }

  /**
   * Dispatch an event to request a view change.
   * @param node The element dispatching the event.
   */
  public dispatchChangeEvent(node: HTMLElement): void {
    dispatchFrigateCardEvent(node, 'change-view', this);
  }
}
