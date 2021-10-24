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

  public isGalleryView(): boolean {
    return this.view == 'clips' || this.view == 'snapshots';
  }

  public isMediaView(): boolean {
    return !this.isGalleryView();
  }

  get media(): BrowseMediaSource | undefined {
    if (this.target) {
      if (this.target.children && this.childIndex !== undefined) {
        return this.target.children[this.childIndex];
      }
      return this.target;
    }
    return undefined;
  }

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
