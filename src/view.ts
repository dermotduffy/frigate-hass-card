import type { BrowseMediaSource, FrigateCardView } from './types.js';

export interface ViewParameters {
  view?: FrigateCardView;
  target?: BrowseMediaSource;
  childIndex?: number;
  previous?: View;
}

export class View {
  view: FrigateCardView;
  target?: BrowseMediaSource;
  childIndex?: number;
  previous?: View;

  constructor(params?: ViewParameters) {
    this.view = params?.view || 'live';
    this.target = params?.target;
    this.childIndex = params?.childIndex;
    this.previous = params?.previous;
  }

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
    node.dispatchEvent(
      new CustomEvent<View>('frigate-card:change-view', {
        bubbles: true,
        composed: true,
        detail: this,
      }),
    );
  }
}
