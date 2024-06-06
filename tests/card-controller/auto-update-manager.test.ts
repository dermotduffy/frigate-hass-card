import { add } from 'date-fns';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AutoUpdateManager } from '../../src/card-controller/auto-update-manager';
import { createCardAPI, createConfig } from '../test-utils';

// @vitest-environment jsdom
describe('AutoUpdateManager', () => {
  const start = new Date('2023-09-23T19:12:00');

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should set default view when allowed', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          update_seconds: 10,
        },
      }),
    );
    // Card is triggered.
    vi.mocked(api.getTriggersManager().isTriggered).mockReturnValue(true);
    vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);

    vi.useFakeTimers();
    vi.setSystemTime(start);

    const manager = new AutoUpdateManager(api);
    manager.startDefaultViewTimer();

    expect(api.getViewManager().setViewDefault).not.toBeCalled();

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    expect(api.getViewManager().setViewDefault).not.toBeCalled();

    vi.mocked(api.getTriggersManager().isTriggered).mockReturnValue(false);

    vi.setSystemTime(add(start, { seconds: 20 }));
    vi.runOnlyPendingTimers();

    expect(api.getViewManager().setViewDefault).toBeCalled();
  });

  it('should not set default view when not configured', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          update_seconds: 0,
        },
      }),
    );
    vi.mocked(api.getTriggersManager().isTriggered).mockReturnValue(false);
    vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);

    vi.useFakeTimers();
    vi.setSystemTime(start);

    const manager = new AutoUpdateManager(api);
    manager.startDefaultViewTimer();

    expect(api.getViewManager().setViewDefault).not.toBeCalled();

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    expect(api.getViewManager().setViewDefault).not.toBeCalled();
  });
});
