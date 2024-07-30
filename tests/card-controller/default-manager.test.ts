import { afterEach, describe, expect, it, vi } from 'vitest';
import { DefaultManager } from '../../src/card-controller/default-manager';
import {
  callHASubscribeMessageHandler,
  createCardAPI,
  createConfig,
  createHASS,
} from '../test-utils';

// @vitest-environment jsdom
describe('DefaultManager', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('time based', () => {
    it('should set default view when allowed', async () => {
      const api = createCardAPI();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            default_reset: {
              every_seconds: 10,
            },
          },
        }),
      );
      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(true);

      vi.useFakeTimers();

      const manager = new DefaultManager(api);
      await manager.initialize();

      expect(api.getViewManager().setViewDefault).not.toBeCalled();

      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewDefault).not.toBeCalled();

      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);
      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewDefault).toBeCalledTimes(1);

      manager.uninitialize();
      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewDefault).toBeCalledTimes(1);
    });

    it('should not set default view when not configured', () => {
      const api = createCardAPI();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            default_reset: {
              every_seconds: 0,
            },
          },
        }),
      );
      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);

      vi.useFakeTimers();

      const manager = new DefaultManager(api);
      manager.initialize();

      expect(api.getViewManager().setViewDefault).not.toBeCalled();

      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewDefault).not.toBeCalled();
    });

    it('should restart timer when reconfigured', async () => {
      const api = createCardAPI();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            default_reset: {
              every_seconds: 10,
            },
          },
        }),
      );
      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);

      const hass = createHASS();
      const unsubcribeCallback = vi.fn();
      vi.mocked(hass.connection.subscribeMessage).mockResolvedValue(unsubcribeCallback);
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      vi.useFakeTimers();

      const manager = new DefaultManager(api);

      await manager.initialize();
      expect(api.getViewManager().setViewDefault).not.toBeCalled();

      vi.runOnlyPendingTimers();

      expect(api.getViewManager().setViewDefault).toBeCalled();
    });
  });

  describe('state based', () => {
    it('should set default view when state changed', async () => {
      const api = createCardAPI();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            default_reset: {
              every_seconds: 10,
            },
          },
        }),
      );
      vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(false);

      const hass = createHASS();
      const unsubcribeCallback = vi.fn();
      vi.mocked(hass.connection.subscribeMessage).mockResolvedValue(unsubcribeCallback);
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const manager = new DefaultManager(api);
      await manager.initialize();

      callHASubscribeMessageHandler(hass, {
        variables: {
          trigger: {
            from_state: {
              entity_id: 'binary_sensor.foo',
              state: 'off',
            },
            to_state: {
              entity_id: 'binary_sensor.foo',
              state: 'on',
            },
          },
        },
      });

      await manager.initialize();
      expect(unsubcribeCallback).toBeCalledTimes(1);

      expect(api.getViewManager().setViewDefault).toBeCalledTimes(1);
    });

    it('should not monitor state without config', async () => {
      const api = createCardAPI();
      const hass = createHASS();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

      const manager = new DefaultManager(api);
      await manager.initialize();

      const mock = vi.mocked(hass.connection.subscribeMessage).mock;
      expect(mock.calls.length).toBe(0);
    });
  });

  describe('interaction based', () => {
    it('should not register automation on initialization', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            default_reset: {
              after_interaction: false,
            },
          },
        }),
      );

      const manager = new DefaultManager(api);
      await manager.initialize();

      expect(api.getAutomationsManager().addAutomations).not.toBeCalled();
    });

    it('should register automation on initialization', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            default_reset: {
              after_interaction: true,
            },
          },
        }),
      );

      const manager = new DefaultManager(api);
      await manager.initialize();

      expect(api.getAutomationsManager().addAutomations).toBeCalledWith([
        {
          actions: [
            {
              action: 'fire-dom-event',
              frigate_card_action: 'default',
            },
          ],
          conditions: [
            {
              condition: 'interaction',
              interaction: false,
            },
          ],
          tag: expect.anything(),
        },
      ]);
    });

    it('should remove automation on uninitalize', async () => {
      const api = createCardAPI();
      const manager = new DefaultManager(api);
      await manager.uninitialize();

      expect(api.getAutomationsManager().deleteAutomations).toBeCalledWith(manager);
    });
  });
});
