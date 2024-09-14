import { add } from 'date-fns';
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

  it('should initialize', () => {
    const api = createCardAPI();
    const manager = new InteractionManager(api);

    manager.initialize();
    expect(api.getConditionsManager().setState).toBeCalledWith({ interaction: false });
  });

  it('should not take action without an interaction timeout', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          interaction_seconds: 0,
        },
      }),
    );
    const manager = new InteractionManager(api);

    manager.reportInteraction();

    expect(manager.hasInteraction()).toBeFalsy();
  });

  it('should set condition state', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          interaction_seconds: 10,
        },
      }),
    );
    const manager = new InteractionManager(api);
    vi.useFakeTimers();
    vi.setSystemTime(start);

    expect(api.getConditionsManager().setState).not.toBeCalled();

    manager.reportInteraction();
    expect(api.getConditionsManager().setState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        interaction: true,
      }),
    );
    expect(manager.hasInteraction()).toBeTruthy();

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    expect(api.getConditionsManager().setState).toHaveBeenLastCalledWith(
      expect.objectContaining({
        interaction: false,
      }),
    );
    expect(manager.hasInteraction()).toBeFalsy();
  });
});
