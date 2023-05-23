import { describe, it, expect, vi, afterAll } from 'vitest';
import { FrigateCardError } from '../../src/types';
import {
  allPromises,
  arrayify,
  arrayMove,
  contentsChanged,
  dayToDate,
  dispatchFrigateCardEvent,
  errorToConsole,
  formatDate,
  formatDateAndTime,
  getDurationString,
  isHoverableDevice,
  isSuperset,
  isValidDate,
  prettifyTitle,
  runWhenIdleIfSupported,
  setify,
  setOrRemoveAttribute,
  sleep,
} from '../../src/utils/basic';

// @vitest-environment jsdom
describe('dispatchFrigateCardEvent', () => {
  it('should dispatch event without data', () => {
    const element = document.createElement('div');
    const handler = vi.fn();
    element.addEventListener('frigate-card:foo', handler);

    dispatchFrigateCardEvent(element, 'foo');
    expect(handler).toBeCalled();
  });

  it('should dispatch event with data', () => {
    const element = document.createElement('div');
    const data = { bar: 2 };
    const handler = vi.fn((ev) => {
      expect(ev.detail).toBe(data);
    });

    element.addEventListener('frigate-card:foo', handler);
    dispatchFrigateCardEvent(element, 'foo', data);
    expect(handler).toBeCalled();
  });
});

describe('prettifyTitle', () => {
  it('should return undefined when passed undefined', () => {
    expect(prettifyTitle(undefined)).toBe(undefined);
  });
  it('should prettify words', () => {
    expect(prettifyTitle('this is_a  string')).toBe('This Is A String');
  });
});

describe('arrayMove', () => {
  it('should move array item', () => {
    const data = [1, 2, 3];
    expect(arrayMove(data, 1, 0)).toEqual([2, 1, 3]);
  });
});

describe('arrayify', () => {
  it('should convert non array to array', () => {
    expect(arrayify(1)).toEqual([1]);
  });
  it('should return array', () => {
    const data = [1, 2, 3];
    expect(arrayify(data)).toBe(data);
  });
});

describe('setify', () => {
  it('should convert non set to set', () => {
    expect(setify(1)).toEqual(new Set([1]));
  });
  it('should return set', () => {
    const data = new Set([1, 2, 3]);
    expect(setify(data)).toBe(data);
  });
});

describe('contentsChanged', () => {
  it('should have changed contents', () => {
    expect(contentsChanged([1, 2], [2, 1])).toBeTruthy();
  });
  it('should not have changed contents', () => {
    expect(contentsChanged([1, 2], [1, 2])).toBeFalsy();
  });
});

describe('errorToConsole', () => {
  const spy = vi.spyOn(global.console, 'warn').mockImplementation(() => true);

  it('should log given error', () => {
    const error = new Error();
    errorToConsole(error);
    expect(spy).toHaveBeenCalledWith(error);
  });
  it('should log with context given frigate card error', () => {
    const data = { foo: 2 };
    const error = new FrigateCardError('foo', { foo: 2 });
    errorToConsole(error);
    expect(spy).toHaveBeenCalledWith(error, data);
  });
  it('should log with custom function', () => {
    const func = vi.fn();
    const error = new Error();
    errorToConsole(error, func);
    expect(func).toHaveBeenCalledWith(error);
  });
});

describe('isHoverableDevice', () => {
  it('should return hoverable', () => {
    const spy = vi
      .spyOn(window, 'matchMedia')
      .mockReturnValue(<MediaQueryList>{ matches: true });
    expect(isHoverableDevice()).toBeTruthy();
  });
  it('should return not hoverable', () => {
    const spy = vi
      .spyOn(window, 'matchMedia')
      .mockReturnValue(<MediaQueryList>{ matches: false });
    expect(isHoverableDevice()).toBeFalsy();
  });
});

describe('formatDateAndTime', () => {
  it('should format date and time', () => {
    const date = new Date(2023, 3, 14, 13, 35, 0);
    expect(formatDateAndTime(date)).toBe('2023-04-14 13:35');
  });
  it('should format date and time with seconds', () => {
    const date = new Date(2023, 3, 14, 13, 35, 1);
    expect(formatDateAndTime(date, true)).toBe('2023-04-14 13:35:01');
  });
});

describe('formatDate', () => {
  it('should format date', () => {
    const date = new Date(2023, 3, 14, 13, 35, 0);
    expect(formatDate(date)).toBe('2023-04-14');
  });
});

describe('runWhenIdleIfSupported', () => {
  const originalRequestIdleCallback = window.requestIdleCallback;
  afterAll(() => {
    window.requestIdleCallback = originalRequestIdleCallback;
  });

  it('should run directly when not supported', () => {
    (window as any).requestIdleCallback = undefined;
    const func = vi.fn();
    runWhenIdleIfSupported(func);
    expect(func).toHaveBeenCalled();
  });

  it('should run idle when supported', () => {
    const requestIdle = vi.fn();
    (window as any).requestIdleCallback = requestIdle;
    const func = vi.fn();
    runWhenIdleIfSupported(func);
    expect(requestIdle).toBeCalledWith(func, {});
  });

  it('should run idle with timeout when supported', () => {
    const requestIdle = vi.fn();
    (window as any).requestIdleCallback = requestIdle;
    const func = vi.fn();
    runWhenIdleIfSupported(func, 10);
    expect(requestIdle).toBeCalledWith(func, { timeout: 10 });
  });
});

describe('getDurationString', () => {
  it('should return duration', () => {
    const start = new Date(2023, 3, 14, 13, 35, 0);
    const end = new Date(2023, 3, 14, 15, 37, 20);
    expect(getDurationString(start, end)).toBe('2h 2m 20s');
  });
});

describe('allPromises', () => {
  it('should await all promises', async () => {
    const results = await allPromises([1, 2, 3], async (n) => n * 2);
    expect(results).toEqual([2, 4, 6]);
  });
});

describe('dayToDate', () => {
  it('should return correct date', () => {
    expect(dayToDate('2023-04-14')).toEqual(new Date(2023, 3, 14));
  });
});

describe('isSuperset', () => {
  it('should return is a superset', () => {
    expect(isSuperset(new Set([1, 2, 3, 4]), new Set([2, 3]))).toBeTruthy();
  });
  it('should return is not a superset', () => {
    expect(isSuperset(new Set([1, 2, 3, 4]), new Set([2, 3, 5]))).toBeFalsy();
  });
});

describe('sleep', () => {
  it('should sleep', async () => {
    const spy = vi
      .spyOn(global, 'setTimeout')
      .mockImplementation((func: () => unknown, _time?: number): any => {
        func();
      });
    sleep(10);
    expect(spy).toHaveBeenCalledWith(expect.anything(), 10000);
  });
});

describe('isValidDate', () => {
  it('should be valid date', () => {
    expect(isValidDate(new Date(2023, 3, 28))).toBeTruthy();
  });
  it('should be invalid date', () => {
    expect(isValidDate(new Date('moo'))).toBeFalsy();
  });
});

describe('setOrRemoveAttribute', () => {
  it('should set attribute', () => {
    const element = document.createElement('div');
    setOrRemoveAttribute(element, true, 'key', 'value');
    expect(element.getAttribute('key')).toBe('value');
  });

  it('should remove attribute date', () => {
    const element = document.createElement('div');
    element.setAttribute('key', 'value');
    setOrRemoveAttribute(element, false, 'key');
    expect(element.getAttribute('key')).toBeFalsy();
  });
});
