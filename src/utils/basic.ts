import differenceInHours from 'date-fns/differenceInHours';
import differenceInMinutes from 'date-fns/differenceInMinutes';
import differenceInSeconds from 'date-fns/differenceInSeconds';
import format from 'date-fns/format';
import isEqual from 'lodash-es/isEqual';
import { FrigateCardError } from '../types';

export type ModifyInterface<T, R> = Omit<T, keyof R> & R;

/**
 * Dispatch a Frigate Card event.
 * @param target The target from which send the event.
 * @param name The name of the Frigate card event to send.
 * @param detail An optional detail object to attach.
 */
export function dispatchFrigateCardEvent<T>(
  target: EventTarget,
  name: string,
  detail?: T,
): void {
  target.dispatchEvent(
    new CustomEvent<T>(`frigate-card:${name}`, {
      bubbles: true,
      composed: true,
      detail: detail,
    }),
  );
}

/**
 * Prettify a title by converting '_' to spaces and capitalizing words.
 * @param input The input Frigate (camera/label/zone) name.
 * @returns A prettified name.
 */
export function prettifyTitle(input: string): string;
export function prettifyTitle(input?: string): string | undefined;
export function prettifyTitle(input?: string): string | undefined {
  if (!input) {
    return undefined;
  }
  const words = input.split(/[_\s]+/);
  return words
    .map((word) => {
      return word[0].toUpperCase() + word.substring(1);
    })
    .join(' ');
}

/**
 * Move an element within an array.
 * @param target Target array.
 * @param from From index.
 * @param to To index.
 */
export function arrayMove(target: unknown[], from: number, to: number): unknown[] {
  const element = target[from];
  target.splice(from, 1);
  target.splice(to, 0, element);
  return target;
}

/**
 * Convert a value to an array if it is not already one.
 * @param value: A value (which may be an array).
 * @returns An array.
 */
export const arrayify = <T>(value: T | T[]): T[] => {
  return Array.isArray(value) ? value : [value];
};

/**
 * Convert a value to an set if it is not already one.
 * @param value: A value (which may be a set, an array or a T)
 * @returns A set of T.
 */
export const setify = <T>(value: T | T[] | Set<T>): Set<T> => {
  return value instanceof Set ? value : new Set(arrayify(value));
};

/**
 * Determine if the contents of the n(ew) and o(ld) values have changed. For use
 * in lit web components that may have a value that changes address but not
 * contents -- and for which a re-render is expensive/jarring.
 * @param n The new value.
 * @param o The old value.
 * @returns `true` is the contents have changed.
 */
export function contentsChanged(n: unknown, o: unknown): boolean {
  return !isEqual(n, o);
}

/**
 * Log an error as a warning to the console.
 * @param e The Error object.
 * @param func The Console func to call.
 */
export function errorToConsole(e: Error, func: CallableFunction = console.warn): void {
  if (e instanceof FrigateCardError && e.context) {
    func(e, e.context);
  } else {
    func(e);
  }
}

/**
 * Determine if the device supports hovering.
 * @returns `true` if the device supports hovering, `false` otherwise.
 */
export const isHoverableDevice = (): boolean =>
  window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/**
 * Format a date object to RFC3339.
 * @param date A Date object.
 * @returns A date and time.
 */
export const formatDateAndTime = (date: Date, includeSeconds?: boolean): string => {
  return format(date, `yyyy-MM-dd HH:mm${includeSeconds ? ':ss' : ''}`);
};

/**
 * Format a date object to RFC3339.
 * @param date A Date object.
 * @returns A date.
 */
export const formatDate = (date: Date): string => {
  return format(date, 'yyyy-MM-dd');
};

/**
 * Run a function in idle periods. If idle callbacks are not supported (e.g.
 * Safari) the callback is run immediately.
 * @param func The function to call.
 * @param timeout The maximum number of seconds to wait.
 */
export const runWhenIdleIfSupported = (func: () => void, timeout?: number): void => {
  if (window.requestIdleCallback) {
    window.requestIdleCallback(func, {
      ...(timeout && { timeout: timeout }),
    });
  } else {
    func();
  }
};

/**
 * Convenience function to return a string representing the difference in hours,
 * minutes and seconds between two dates. Heavily inspired by, and returning the
 * same format as, the Frigate UI:
 * https://github.com/blakeblackshear/frigate/blob/master/web/src/components/RecordingPlaylist.jsx#L97
 * @param start The start date.
 * @param end The end date.
 * @returns A duration string.
 */
export function getDurationString(start: Date, end: Date): string {
  const hours = differenceInHours(end, start);
  const minutes = differenceInMinutes(end, start) - hours * 60;
  const seconds = differenceInSeconds(end, start) - hours * 60 * 60 - minutes * 60;
  let duration = '';

  if (hours) {
    duration += `${hours}h `;
  }
  if (minutes) {
    duration += `${minutes}m `;
  }
  duration += `${seconds}s`;
  return duration;
}

export const allPromises = async <T, R>(
  items: Iterable<T>,
  func: (arg: T) => R,
): Promise<Awaited<R>[]> => {
  return await Promise.all(Array.from(items).map((item) => func(item)));
};

/**
 * Simple efficient YYYY-MM-DD -> date converter.
 */
export const dayToDate = (day: string): Date => {
  // Must provide the hour:minute:second on parsing or Javascript will assume
  // *UTC* midnight.
  return new Date(`${day}T00:00:00`);
};

export const isSuperset = (superset: Set<unknown>, subset: Set<unknown>) => {
  for (const item of subset) {
    if (!superset.has(item)) {
      return false;
    }
  }
  return true;
};

// Usage of this function needs to be justified with a comment.
export const sleep = async (seconds: number) => {
  await new Promise((r) => setTimeout(r, seconds * 1000));
};

export const isValidDate = (date: Date): boolean => {
  return !isNaN(date.getTime());
};

/**
 * Set or remove an attribute on a HTMLElement.
 * @param element The element.
 * @param set If `true` sets the attribute, otherwise removes it.
 * @param name The attribute name.
 * @param value An optional value to set the attribute to.
 */
export const setOrRemoveAttribute = (
  element: HTMLElement,
  set: boolean,
  name: string,
  value?: string,
): void => {
  if (set) {
    element.setAttribute(name, value ?? '');
  } else {
    element.removeAttribute(name);
  }
};
