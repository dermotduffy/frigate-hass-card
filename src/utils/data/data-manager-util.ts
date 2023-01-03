import startOfHour from 'date-fns/startOfHour';
import endOfHour from 'date-fns/endOfHour';
import startOfDay from 'date-fns/startOfDay';
import endOfDay from 'date-fns/endOfDay';
import endOfMinute from 'date-fns/endOfMinute';
import endOfWeek from 'date-fns/endOfWeek';
import startOfWeek from 'date-fns/startOfWeek';
import { DateRange } from './data-manager-range';

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
  } else if (widthSeconds <= 60 * 60 * 24) {
    cacheableStart = startOfDay(range.start);
    cacheableEnd = endOfDay(range.end);
  } else {
    cacheableStart = startOfWeek(range.start);
    cacheableEnd = endOfWeek(range.end);
  }

  if (options?.endCap) {
    cacheableEnd = endOfMinute(capEndDate(cacheableEnd));
  }

  return {
    start: cacheableStart,
    end: cacheableEnd,
  };
};

export const capEndDate = (end: Date): Date => {
  const now = new Date();
  return end > now ? now : end;
};
