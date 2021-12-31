import type { BrowseMediaSource, FrigateCardView } from './types.js';
import { dispatchFrigateCardEvent } from './common.js';

export interface ViewEvolveParameters {
  view?: FrigateCardView;
  camera?: string;
  target?: BrowseMediaSource;
  childIndex?: number;
  previous?: View;
}

export interface ViewParameters extends ViewEvolveParameters {
  view: FrigateCardView;
  camera: string;
}

export class View {
  view: FrigateCardView;
  camera: string;
  target?: BrowseMediaSource;
  childIndex?: number;
  previous?: View;

  constructor(params: ViewParameters) {
    this.view = params?.view;
    this.camera = params?.camera;
    this.target = params?.target;
    this.childIndex = params?.childIndex;
    this.previous = params?.previous;
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
      previous: this.previous
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
    })
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
    return !this.isGalleryView();
  }

  /**
   * Determine if a view is for the media viewer.
   */
  public isViewerView(): boolean {
    return ['clip', 'clip-specific', 'snapshot', 'snapshot-specific'].includes(
      this.view,
    );
  }

  /**
   * Determine if a view is related to a clip or clips.
   */
  public isClipRelatedView(): boolean {
    return ['clip', 'clips', 'clip-specific'].includes(this.view);
  }

  /**
   * Determine if a view is related to a snapshot or snapshots.
   */
  public isSnapshotRelatedView(): boolean {
    return ['snapshot', 'snapshots', 'snapshot-specific'].includes(this.view);
  }

  /**
   *  Get the media item that should be played.
   **/
  get media(): BrowseMediaSource | undefined {
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
