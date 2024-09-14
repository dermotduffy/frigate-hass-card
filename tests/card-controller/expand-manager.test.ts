import { describe, expect, it, vi } from 'vitest';
import { ExpandManager } from '../../src/card-controller/expand-manager';
import { createCardAPI } from '../test-utils';

describe('ExpandManager', () => {
  it('should construct', () => {
    const api = createCardAPI();
    const manager = new ExpandManager(api);
    expect(manager.isExpanded()).toBeFalsy();
  });

  it('should initialize', () => {
    const api = createCardAPI();
    const manager = new ExpandManager(api);

    manager.initialize();
    expect(api.getConditionsManager().setState).toBeCalledWith({ expand: false });
  });

  it('should set expanded', () => {
    const api = createCardAPI();
    vi.mocked(api.getFullscreenManager().isInFullscreen).mockReturnValue(true);
    const manager = new ExpandManager(api);

    manager.setExpanded(true);

    expect(manager.isExpanded()).toBeTruthy();
    expect(api.getFullscreenManager().stopFullscreen).toBeCalled();
    expect(api.getConditionsManager().setState).toBeCalledWith({ expand: true });
    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should not exit fullscreen when not in fullscreen', () => {
    const api = createCardAPI();
    vi.mocked(api.getFullscreenManager().isInFullscreen).mockReturnValue(false);
    const manager = new ExpandManager(api);

    manager.setExpanded(true);

    expect(api.getFullscreenManager().stopFullscreen).not.toBeCalled();
  });

  it('should toggle expanded', () => {
    const api = createCardAPI();
    vi.mocked(api.getFullscreenManager().isInFullscreen).mockReturnValue(false);
    const manager = new ExpandManager(api);

    manager.toggleExpanded();
    expect(manager.isExpanded()).toBeTruthy();

    manager.toggleExpanded();
    expect(manager.isExpanded()).toBeFalsy();
  });
});
