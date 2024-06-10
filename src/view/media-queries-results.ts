import { isSuperset } from '../utils/basic.js';
import { ViewMedia } from './media.js';

type CameraResultSlices = Map<string, ResultSlice>;
type SelectApproach = 'first' | 'last';

interface ResultSliceOptions {
  results?: ViewMedia[];
  selectedIndex?: number | null;
  selectApproach?: SelectApproach;
}

class ResultSlice {
  protected _results: ViewMedia[];
  protected _selectedIndex: number | null;

  constructor(options?: ResultSliceOptions) {
    this._results = options?.results ?? [];
    this._selectedIndex = this._getInitialSelectedIndex(options);
  }

  protected _getInitialSelectedIndex(options?: ResultSliceOptions): number | null {
    if (options?.selectedIndex !== undefined && options?.selectedIndex !== null) {
      return options.selectedIndex;
    }
    if (options?.results && options.results.length) {
      if (!options?.selectApproach || options?.selectApproach === 'last') {
        return options.results.length - 1;
      } else {
        return 0;
      }
    }
    return null;
  }

  public clone(): ResultSlice {
    return new ResultSlice({
      results: this._results,
      selectedIndex: this._selectedIndex,
    });
  }

  public getResults(): ViewMedia[] {
    return this._results;
  }
  public getSelectedIndex(): number | null {
    return this._selectedIndex;
  }
  public getResultsCount(): number {
    return this.getResults().length;
  }
  public hasResults(): boolean {
    return this.getResultsCount() !== 0;
  }
  public getResult(index?: number): ViewMedia | null {
    return index === undefined ? null : this._results[index];
  }
  public getSelectedResult(): ViewMedia | null {
    const index = this.getSelectedIndex();
    return index !== null ? this.getResult(index) : null;
  }
  public hasSelectedResult(): boolean {
    return this.getSelectedResult() !== null;
  }
  public resetSelectedResult(): void {
    this._selectedIndex = null;
  }

  public selectIndex(index: number | null): void {
    if (index === null || (index >= 0 && index < this._results.length)) {
      this._selectedIndex = index;
    }
  }
  public selectResultIfFound(func: (media: ViewMedia) => boolean): void {
    for (const [index, result] of this._results.entries()) {
      if (func(result)) {
        this.selectIndex(index);
        break;
      }
    }
  }
  public selectBestResult(func: (media: ViewMedia[]) => number | null): void {
    const resultIndex = func(this._results);
    if (resultIndex !== null) {
      this.selectIndex(resultIndex);
    }
  }
}

interface ResultSliceSelectionCriteria {
  main?: boolean;
  cameraID?: string;
  allCameras?: boolean;
}

export class MediaQueriesResults {
  protected _resultsTimestamp: Date | null = null;
  protected _main: ResultSlice;
  protected _cameras: CameraResultSlices = new Map();

  constructor(options?: ResultSliceOptions) {
    this._resultsTimestamp = new Date();
    this._main = new ResultSlice(options);
    this._buildByCameraSlices(options?.selectApproach);
  }

  protected _buildByCameraSlices(selectApproach?: SelectApproach): void {
    const cameraMap: Map<string, ViewMedia[]> = new Map();
    for (const result of this._main.getResults()) {
      const cameraID = result.getCameraID();
      const media: ViewMedia[] = cameraMap.get(cameraID) ?? [];
      media.push(result);
      cameraMap.set(cameraID, media);
    }

    for (const [cameraID, media] of cameraMap.entries()) {
      this._cameras.set(
        cameraID,
        new ResultSlice({
          results: media,
          selectApproach: selectApproach,
        }),
      );
    }
  }

  public clone(): MediaQueriesResults {
    // Shallow clone -- will reuse the same results object (as there are no
    // methods that support modification of the results themselves, and since
    // changing the index on a consistent set of results is a very common
    // operation).
    const copy = new MediaQueriesResults();
    copy._resultsTimestamp = this._resultsTimestamp;
    copy._main = this._main.clone();

    for (const [cameraID, slice] of this._cameras.entries()) {
      copy._cameras.set(cameraID, slice.clone());
    }
    return copy;
  }

  public isSupersetOf(that: MediaQueriesResults): boolean {
    const thisMediaIDs = new Set(this._main.getResults()?.map((media) => media.getID()));
    const thatMediaIDs = new Set(that._main.getResults()?.map((media) => media.getID()));

    if (
      !thisMediaIDs.size ||
      !thatMediaIDs.size ||
      // If either media sets contain a null identifier (i.e. a media item with
      // no ID) we must assume this is not a subset as multiple media items may
      // reduce to the same null identifier above.
      thisMediaIDs.has(null) ||
      thatMediaIDs.has(null)
    ) {
      return false;
    }
    return isSuperset(thisMediaIDs, thatMediaIDs);
  }

  public getCameraIDs(): Set<string> {
    return new Set(this._cameras.keys());
  }

  public getSlice(cameraID?: string): ResultSlice | null {
    return cameraID ? this._cameras.get(cameraID) ?? null : this._main;
  }

  public getResults(cameraID?: string): ViewMedia[] | null {
    return this.getSlice(cameraID)?.getResults() ?? null;
  }
  public getResultsCount(cameraID?: string): number {
    return this.getSlice(cameraID)?.getResultsCount() ?? 0;
  }
  public hasResults(cameraID?: string): boolean {
    return this.getSlice(cameraID)?.getResultsCount() !== 0;
  }
  public getResult(index?: number, cameraID?: string): ViewMedia | null {
    return this.getSlice(cameraID)?.getResult(index) ?? null;
  }
  public getSelectedIndex(cameraID?: string): number | null {
    return this.getSlice(cameraID)?.getSelectedIndex() ?? null;
  }
  public getSelectedResult(cameraID?: string): ViewMedia | null {
    return this.getSlice(cameraID)?.getSelectedResult() ?? null;
  }
  public getMultipleSelectedResults(
    criteria?: ResultSliceSelectionCriteria,
  ): ViewMedia[] {
    const results: ViewMedia[] = [];
    if (!criteria || criteria.main) {
      const mainResult = this.getSelectedResult();
      if (mainResult) {
        results.push(mainResult);
      }
    }
    const cameraIDs = this._getCameraIDsFromCriteria(criteria);
    for (const cameraID of cameraIDs ?? []) {
      const result = this.getSelectedResult(cameraID);
      if (result) {
        results.push(result);
      }
    }
    return results;
  }
  public hasSelectedResult(cameraID?: string): boolean {
    return this.getSlice(cameraID)?.hasSelectedResult() ?? false;
  }
  public resetSelectedResult(cameraID?: string): MediaQueriesResults {
    this.getSlice(cameraID)?.resetSelectedResult();
    return this;
  }
  public getResultsTimestamp(): Date | null {
    return this._resultsTimestamp;
  }

  public selectIndex(index: number, cameraID?: string): MediaQueriesResults {
    this.getSlice(cameraID)?.selectIndex(index);
    if (!cameraID) {
      // If the main selection is changed, it must also change the matching
      // camera selection.
      this.demoteMainSelectionToCameraSelection();
    }
    return this;
  }

  public demoteMainSelectionToCameraSelection(): MediaQueriesResults {
    const selected = this.getSelectedResult();
    if (selected) {
      const cameraID = selected.getCameraID();
      this.resetSelectedResult(cameraID);
      this.selectResultIfFound((media) => media === selected, { cameraID: cameraID });
    }
    return this;
  }

  public promoteCameraSelectionToMainSelection(cameraID: string): MediaQueriesResults {
    const selected = this.getSelectedResult(cameraID);
    this.resetSelectedResult();
    this.selectResultIfFound((media) => media === selected);
    return this;
  }

  protected _getCameraIDsFromCriteria(
    criteria?: ResultSliceSelectionCriteria,
  ): Set<string> | null {
    return criteria?.allCameras
      ? this.getCameraIDs()
      : criteria?.cameraID
        ? new Set([criteria.cameraID])
        : null;
  }

  public selectResultIfFound(
    func: (media: ViewMedia) => boolean,
    criteria?: ResultSliceSelectionCriteria,
  ): MediaQueriesResults {
    if (!criteria || criteria?.main) {
      this._main.selectResultIfFound(func);
      this.demoteMainSelectionToCameraSelection();
    }
    const cameraIDs = this._getCameraIDsFromCriteria(criteria);
    for (const cameraID of cameraIDs ?? []) {
      this.getSlice(cameraID)?.selectResultIfFound(func);
    }
    return this;
  }
  public selectBestResult(
    func: (media: ViewMedia[]) => number | null,
    criteria?: ResultSliceSelectionCriteria,
  ): MediaQueriesResults {
    if (!criteria || criteria.main) {
      this._main.selectBestResult(func);
      this.demoteMainSelectionToCameraSelection();
    }
    const cameraIDs = this._getCameraIDsFromCriteria(criteria);
    for (const cameraID of cameraIDs ?? []) {
      this.getSlice(cameraID)?.selectBestResult(func);
    }
    return this;
  }
}
