import cloneDeep from 'lodash-es/cloneDeep.js';
import { EventQuery, MediaQuery, RecordingQuery } from '../camera-manager/types.js';

export type MediaQueries = EventMediaQueries | RecordingMediaQueries;

class MediaQueriesBase<T extends MediaQuery> {
  protected _queries: T[] | null = null;

  public constructor(queries?: T[]) {
    if (queries) {
      this._queries = queries;
    }
  }

  public clone(): MediaQueriesBase<T> {
    return cloneDeep(this);
  }

  public getQueries(): T[] | null {
    return this._queries;
  }

  public setQueries(queries: T[]): void {
    this._queries = queries;
  }
}

export class EventMediaQueries extends MediaQueriesBase<EventQuery> {
  public convertToClipsQueries(): void {
    for (const query of this._queries ?? []) {
      delete query.hasSnapshot;
      query.hasClip = true;
    }
  }

  public clone(): EventMediaQueries {
    return cloneDeep(this);
  }
}

export class RecordingMediaQueries extends MediaQueriesBase<RecordingQuery> {}
