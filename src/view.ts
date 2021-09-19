import type { BrowseMediaSource, FrigateCardView } from './types';

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

  get media(): BrowseMediaSource | undefined {
    if (this.target) {
      if (this.target.children && this.childIndex !== undefined) {
        return this.target.children[this.childIndex];
      }
      return this.target;
    }
    return undefined;
  }

  public generateChangeEvent(node: HTMLElement): void {
    node.dispatchEvent(
      new CustomEvent<View>('frigate-card:change-view', {
        bubbles: true,
        composed: true,
        detail: this,
      }),
    );
  }
}
