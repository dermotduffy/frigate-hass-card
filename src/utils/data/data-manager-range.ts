import cloneDeep from 'lodash-es/cloneDeep';
import orderBy from 'lodash-es/orderBy';

interface Range<T extends Date | number> {
  start: T;
  end: T;
}

export type DateRange = Range<Date>;

export class MemoryRangeSet {
  protected _ranges: DateRange[];

  constructor(ranges?: DateRange[]) {
    this._ranges = ranges ?? [];
  }

  public clone(): MemoryRangeSet {
    return new MemoryRangeSet(cloneDeep(this._ranges));
  }

  public hasCoverage(range: DateRange): boolean {
    return this._ranges.some((cachedRange) =>
      this._isEntirelyContained(cachedRange, range),
    );
  }

  public add(range: DateRange): void {
    this._ranges.push(range);
    this._ranges = compressRanges(this._ranges);
  }

  protected _isEntirelyContained(bigger: DateRange, smaller: DateRange): boolean {
    return smaller.start >= bigger.start && smaller.end <= bigger.end;
  }
}

export const rangesOverlap = (a: DateRange, b: DateRange): boolean => {
  return (
    // a starts within the range of b.
    (a.start >= b.start && a.start <= b.end) ||
    // a events within the range of b.
    (a.end >= b.start && a.end <= b.end) ||
    // a encompasses the entire range of b.
    (a.start <= b.start && a.end >= b.end)
  );
}

export const compressRanges = <T extends Date | number>(
  ranges: Range<T>[],
  toleranceSeconds = 0,
): Range<T>[] => {
  const compressedRanges: Range<T>[] = [];
  ranges = orderBy(ranges, (range) => range.start, 'asc');

  let current: Range<T> | null = null;
  for (let i = 0; i < ranges.length; ++i) {
    const item = ranges[i];
    const itemStartSeconds =
      item.start instanceof Date ? item.start.getTime() : item.start;

    if (!current) {
      current = { ...item };
      continue;
    }

    const currentEndSeconds =
      current.end instanceof Date ? current.end.getTime() : (current.end as number);

    if (currentEndSeconds + toleranceSeconds * 1000 >= itemStartSeconds) {
      if (item.end > current.end) {
        current.end = item.end;
      }
    } else {
      compressedRanges.push(current);
      current = { ...item };
    }
  }
  if (current) {
    compressedRanges.push(current);
  }

  return compressedRanges;
};
