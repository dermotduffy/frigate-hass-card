import endOfDay from 'date-fns/endOfDay';
import endOfHour from 'date-fns/endOfHour';
import endOfMinute from 'date-fns/endOfMinute';
import startOfDay from 'date-fns/startOfDay';
import startOfHour from 'date-fns/startOfHour';
import { DateRange } from '../range';
import { capEndDate } from './cap-end-date';

export const convertRangeToCacheFriendlyTimes = (
  range: DateRange,
  options?: {
    endCap?: boolean;
  },
): DateRange => {
  const widthSeconds = (range.end.getTime() - range.start.getTime()) / 1000;
  let cacheableStart: Date;
  let cacheableEnd: Date;

  if (widthSeconds <= 60 * 60) {
    cacheableStart = startOfHour(range.start);
    cacheableEnd = endOfHour(range.end);
  } else {
    cacheableStart = startOfDay(range.start);
    cacheableEnd = endOfDay(range.end);
  }

  if (options?.endCap) {
    cacheableEnd = endOfMinute(capEndDate(cacheableEnd));
  }

  return {
    start: cacheableStart,
    end: cacheableEnd,
  };
};
