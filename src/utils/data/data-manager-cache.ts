import isEqual from 'lodash-es/isEqual';
import orderBy from 'lodash-es/orderBy';
import sortedUniqBy from 'lodash-es/sortedUniqBy';
import { RecordingSegment, RecordingSegments } from '../frigate';
import { DateRange, MemoryRangeSet } from './data-manager-range';
import { DataQuery, QueryResults } from './data-types';

interface RequestCacheItem<Request, Response> {
  request: Request;
  response: Response;
  expires?: Date;
}

interface DataManagerCache<Request, Response> {
  get(request: Request): Response | null;
  has(request: Request): boolean;
  set(request: Request, response: Response, expiry?: Date): void;
}

export class MemoryRequestCache<Request, Response>
  implements DataManagerCache<Request, Response>
{
  protected _data: RequestCacheItem<Request, Response>[] = [];

  public get(request: Request): Response | null {
    const now = new Date();
    for (const item of this._data) {
      if (
        (!item.expires || now <= item.expires) &&
        this._contains(request, item.request)
      ) {
        return item.response;
      }
    }
    return null;
  }

  public has(request: Request): boolean {
    return !!this.get(request);
  }

  public set(request: Request, response: Response, expiry?: Date): void {
    this._data.push({
      request: request,
      response: response,
      expires: expiry,
    });

    // Clean up old requests on set.
    this._expireOldRequests();
  }

  protected _contains(a: Request, b: Request): boolean {
    return isEqual(a, b);
  }

  protected _expireOldRequests(): void {
    const now = new Date();
    this._data = this._data.filter((item) => !item.expires || now < item.expires);
  }
}

export class RequestCache extends MemoryRequestCache<DataQuery, QueryResults> {}

export class MemoryRangedCache<Data> {
  protected _ranges: MemoryRangeSet = new MemoryRangeSet();
  protected _data: Data[] = [];
  protected _timeFunc: (data: Data) => number;
  protected _idFunc: (data: Data) => string;

  constructor(timeFunc: (data: Data) => number, idFunc: (data: Data) => string) {
    this._timeFunc = timeFunc;
    this._idFunc = idFunc;
  }

  public add(range: DateRange, data: Data[]) {
    this._ranges.add(range);
    this._data = sortedUniqBy(
      orderBy(this._data.concat(data), this._timeFunc, 'asc'),
      this._idFunc,
    );
  }

  public hasCoverage(range: DateRange): boolean {
    return this._ranges.hasCoverage(range);
  }

  public get(range: DateRange): Data[] | null {
    if (!this.hasCoverage(range)) {
      return null;
    }

    const output: Data[] = [];
    for (const data of this._data) {
      const start = this._timeFunc(data);
      if (start > range.start.getTime()) {
        if (start > range.end.getTime()) {
          // Data is kept in order.
          break;
        }
        output.push(data);
      }
    }
    return output;
  }
}

export class RecordingSegmentsCache {
  protected _segments: Map<string, MemoryRangedCache<RecordingSegment>> = new Map();

  public add(cameraID: string, range: DateRange, segments: RecordingSegments) {
    let cameraSegmentCache: MemoryRangedCache<RecordingSegment> | undefined =
      this._segments.get(cameraID);
    if (!cameraSegmentCache) {
      cameraSegmentCache = new MemoryRangedCache(
        (segment: RecordingSegment) => segment.start_time * 1000,
        (segment: RecordingSegment) => segment.id,
      );
      this._segments.set(cameraID, cameraSegmentCache);
    }
    cameraSegmentCache.add(range, segments);
  }

  public hasCoverage(cameraID: string, range: DateRange): boolean {
    return !!this._segments.get(cameraID)?.hasCoverage(range);
  }

  public get(cameraID: string, range: DateRange): RecordingSegments | null {
    return this._segments.get(cameraID)?.get(range) ?? null;
  }
}
