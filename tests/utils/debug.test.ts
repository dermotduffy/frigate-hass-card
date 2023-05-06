import { describe, expect, it, vi } from 'vitest';
import { log } from '../../src/utils/debug.js';

describe('log', () => {
  it('should do nothing without debug logging set', () => {
    const spy = vi.spyOn(global.console, 'debug');
    log({}, 'foo');
    expect(spy).not.toBeCalled();
  });
  it('should log debug when appropriately configured', () => {
    const spy = vi.spyOn(global.console, 'debug');
    log({ debug: { logging: true } }, 'foo');
    expect(spy).toBeCalledWith('foo');
  });
});
