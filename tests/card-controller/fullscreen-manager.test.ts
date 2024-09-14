import screenfull from 'screenfull';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FullscreenManager } from '../../src/card-controller/fullscreen-manager';
import { createCardAPI } from '../test-utils';

vi.mock('screenfull', () => ({
  default: {
    exit: vi.fn(),
    toggle: vi.fn(),
    off: vi.fn(),
    on: vi.fn(),
  },
}));

const setScreenfulEnabled = (enabled: boolean): void => {
  Object.defineProperty(screenfull, 'isEnabled', { value: enabled, writable: true });
};

const setScreenfulFullscreen = (fullscreen: boolean): void => {
  Object.defineProperty(screenfull, 'isFullscreen', {
    value: fullscreen,
    writable: true,
  });
};

// @vitest-environment jsdom
describe('FullscreenManager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should initialize', () => {
    const api = createCardAPI();
    const manager = new FullscreenManager(api);

    setScreenfulEnabled(true);
    setScreenfulFullscreen(false);

    manager.initialize();
    expect(api.getConditionsManager().setState).toBeCalledWith({ fullscreen: false });
  });

  it('should correctly determine whether in fullscreen', () => {
    const manager = new FullscreenManager(createCardAPI());

    setScreenfulEnabled(true);
    setScreenfulFullscreen(true);
    expect(manager.isInFullscreen()).toBeTruthy();

    setScreenfulFullscreen(false);
    expect(manager.isInFullscreen()).toBeFalsy();
  });

  it('should toggle fullscreen', () => {
    const toggle = vi.mocked(screenfull.toggle);
    const element = document.createElement('div');
    const api = createCardAPI();
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    const manager = new FullscreenManager(api);

    manager.toggleFullscreen();

    expect(toggle).toBeCalledWith(element);
  });

  it('should stop fullscreen', () => {
    const manager = new FullscreenManager(createCardAPI());
    const exit = vi.mocked(screenfull.exit);

    manager.stopFullscreen();

    expect(exit).toBeCalled();
  });

  it('should disconnect', () => {
    const manager = new FullscreenManager(createCardAPI());
    const off = vi.mocked(screenfull.off);

    setScreenfulEnabled(true);

    manager.disconnect();

    expect(off).toBeCalledWith('change', expect.anything());
  });

  it('should not disconnect when screenfull disabled', () => {
    const manager = new FullscreenManager(createCardAPI());
    const off = vi.mocked(screenfull.off);

    setScreenfulEnabled(false);

    manager.disconnect();

    expect(off).not.toBeCalled();
  });

  it('should connect', () => {
    const manager = new FullscreenManager(createCardAPI());
    const on = vi.mocked(screenfull.on);

    setScreenfulEnabled(true);

    manager.connect();

    expect(on).toBeCalledWith('change', expect.anything());
  });

  it('should not connect when screenfull disabled', () => {
    const manager = new FullscreenManager(createCardAPI());
    const on = vi.mocked(screenfull.on);

    setScreenfulEnabled(false);

    manager.connect();

    expect(on).not.toBeCalled();
  });

  it('should make correct api calls on fullscreen change', () => {
    const api = createCardAPI();
    const manager = new FullscreenManager(api);
    const on = vi.mocked(screenfull.on);

    setScreenfulEnabled(true);
    setScreenfulFullscreen(true);

    manager.connect();

    expect(on).toBeCalled();
    on.mock.calls[0][1](new Event('fullscreen'));

    expect(api.getExpandManager().setExpanded).toBeCalledWith(false);
    expect(api.getConditionsManager().setState).toBeCalledWith({
      fullscreen: true,
    });
    expect(api.getCardElementManager().update).toBeCalled();
  });
});
