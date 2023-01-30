import clone from 'lodash-es/clone.js';
import { ViewMedia } from './media.js';

export class MediaQueriesResults {
  protected _results: ViewMedia[] | null = null;
  protected _resultsTimestamp: Date | null = null;
  protected _selectedIndex: number | null = null;

  constructor(results?: ViewMedia[], selectedIndex?: number | null) {
    if (results) {
      this.setResults(results);
    }
    this.selectResult(selectedIndex ?? 0);
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

  public selectResult(index: number | null): MediaQueriesResults {
    if (
      index === null ||
      (this._results && index >= 0 && index < this._results.length)
    ) {
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
