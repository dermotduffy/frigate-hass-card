import { sub } from 'date-fns';
import { describe, expect, it } from 'vitest';
import { isMediaWithinDates } from '../../../../src/camera-manager/browse-media/utils/within-dates';
import { createBrowseMedia } from './test-utils';

describe('isMediaWithinDates', () => {
  const rangeStart = new Date('2024-11-19T07:00:00');
  const rangeEnd = new Date('2024-11-19T08:00:00');

  it('should never match media without metadata', () => {
    const media = createBrowseMedia({ _metadata: undefined });
    expect(isMediaWithinDates(media, rangeStart, rangeEnd)).toBe(false);
  });

  it('should always match media without start or end date', () => {
    expect(isMediaWithinDates(createBrowseMedia(), undefined, undefined)).toBe(true);
  });

  it('should match without a start date in the range', () => {
    expect(isMediaWithinDates(createBrowseMedia(), undefined, rangeEnd)).toBe(true);
  });

  it('should match without an end date in the range', () => {
    expect(isMediaWithinDates(createBrowseMedia(), rangeStart, undefined)).toBe(true);
  });

  it('should match when ranges overlap', () => {
    expect(isMediaWithinDates(createBrowseMedia(), rangeStart, rangeEnd)).toBe(true);
  });

  it('should not match when ranges do not overlap', () => {
    expect(
      isMediaWithinDates(
        createBrowseMedia(),
        sub(rangeStart, { days: 1 }),
        sub(rangeEnd, { days: 1 }),
      ),
    ).toBe(false);
  });
});
