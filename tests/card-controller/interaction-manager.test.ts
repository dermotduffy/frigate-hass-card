import add from 'date-fns/add';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InteractionManager } from '../../src/card-controller/interaction-manager';
import { createCardAPI, createConfig } from '../test-utils';

vi.mock('lodash-es/throttle', () => ({
  default: vi.fn((fn) => fn),
}));

// @vitest-environment jsdom
describe('InteractionManager', () => {
  const start = new Date('2023-09-24T20:20:00');

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should take action when interaction is reported', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          timeout_seconds: 10,
        },
      }),
    );
    const manager = new InteractionManager(api);
    vi.useFakeTimers();
    vi.setSystemTime(start);

    manager.reportInteraction();

    expect(api.getTriggersManager().untrigger).toBeCalled();
    expect(manager.hasInteraction()).toBeTruthy();
    expect(api.getViewManager().setViewDefault).not.toBeCalled();

    vi.mocked(api.getTriggersManager().isTriggered).mockReturnValue(false);
    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    expect(api.getViewManager().setViewDefault).toBeCalled();
  });

  it('should not take action when triggered', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          timeout_seconds: 10,
        },
      }),
    );
    const manager = new InteractionManager(api);
    vi.useFakeTimers();
    vi.setSystemTime(start);

    manager.reportInteraction();

    vi.mocked(api.getTriggersManager().isTriggered).mockReturnValue(true);
    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    // First call is blocked by triggers (above), so interaction will report
    // true but the default view will not have been set.
    expect(api.getViewManager().setViewDefault).not.toBeCalled();
  });

  it('should not take action when not configured', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          timeout_seconds: 0,
        },
      }),
    );
    const manager = new InteractionManager(api);

    manager.reportInteraction();

    // First call is blocked by triggers (above), so interaction will report
    // true but the default view will not have been set.
    expect(api.getViewManager().setViewDefault).not.toBeCalled();
  });
});
