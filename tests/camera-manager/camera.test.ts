import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Camera } from '../../src/camera-manager/camera.js';
import { GenericCameraManagerEngine } from '../../src/camera-manager/generic/engine-generic.js';
import { EntityRegistryManager } from '../../src/utils/ha/entity-registry/index.js';
import {
  callHASubscribeMessageHandler,
  createCameraCapabilities,
  createCameraConfig,
  createHASS,
} from '../test-utils.js';

describe('Camera', () => {
  it('should get config', async () => {
    const config = createCameraConfig();
    const camera = new Camera(config, new GenericCameraManagerEngine());
    expect(camera.getConfig()).toBe(config);
  });

  describe('should get capabilities', async () => {
    it('when populated', async () => {
      const capabilities = createCameraCapabilities();
      const camera = new Camera(createCameraConfig(), new GenericCameraManagerEngine(), {
        capabilities: capabilities,
      });
      expect(camera.getCapabilities()).toBe(capabilities);
    });

    it('when unpopulated', async () => {
      const camera = new Camera(createCameraConfig(), new GenericCameraManagerEngine());
      expect(camera.getCapabilities()).toBeNull();
    });
  });

  it('should get engine', async () => {
    const engine = new GenericCameraManagerEngine();
    const camera = new Camera(createCameraConfig(), engine);
    expect(camera.getEngine()).toBe(engine);
  });

  it('should set and get id', async () => {
    const camera = new Camera(createCameraConfig(), new GenericCameraManagerEngine());
    camera.setID('foo');
    expect(camera.getID()).toBe('foo');
    expect(camera.getConfig().id).toBe('foo');
  });

  it('should throw without id', async () => {
    const camera = new Camera(createCameraConfig(), new GenericCameraManagerEngine());
    expect(() => camera.getID()).toThrowError(
      'Could not determine camera id for the following ' +
        "camera, may need to set 'id' parameter manually",
    );
  });

  it('should initialize and destroy', async () => {
    const camera = new Camera(
      createCameraConfig({
        triggers: {
          entities: ['camera.foo'],
        },
      }),
      new GenericCameraManagerEngine(),
    );
    const hass = createHASS();
    const unsubcribeCallback = vi.fn();

    vi.mocked(hass.connection.subscribeMessage).mockResolvedValue(unsubcribeCallback);

    await camera.initialize(hass, mock<EntityRegistryManager>());

    expect(hass.connection.subscribeMessage).toBeCalledWith(
      expect.anything(),
      expect.objectContaining({
        type: 'subscribe_trigger',
        trigger: {
          entity_id: ['camera.foo'],
          platform: 'state',
          from: null,
          to: null,
        },
      }),
    );
    expect(unsubcribeCallback).not.toBeCalled();

    await camera.destroy();
    expect(unsubcribeCallback).toBeCalled();
  });

  it('should not subscribe without trigger entities', async () => {
    const camera = new Camera(createCameraConfig(), new GenericCameraManagerEngine());
    const hass = createHASS();

    await camera.initialize(hass, mock<EntityRegistryManager>());
    expect(hass.connection.subscribeMessage).not.toBeCalled();
  });

  describe('should handle trigger state changes', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('when malformed', async () => {
      vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

      const eventCallback = vi.fn();
      const camera = new Camera(
        createCameraConfig({
          triggers: {
            entities: ['camera.foo'],
          },
        }),
        new GenericCameraManagerEngine(),
        { eventCallback: eventCallback },
      );

      const hass = createHASS();
      await camera.initialize(hass, mock<EntityRegistryManager>());

      callHASubscribeMessageHandler(hass, 'MALFORMED_DATA');

      expect(eventCallback).not.toBeCalled();
    });

    it.each([
      ['off' as const, 'on' as const, 'new' as const],
      ['on' as const, 'off' as const, 'end' as const],
    ])(
      'from %s to %s',
      async (stateFrom: string, stateTo: string, eventType: 'new' | 'end') => {
        vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

        const eventCallback = vi.fn();
        const camera = new Camera(
          createCameraConfig({
            id: 'camera_1',
            triggers: {
              entities: ['binary_sensor.foo'],
            },
          }),
          new GenericCameraManagerEngine(),
          { eventCallback: eventCallback },
        );

        const hass = createHASS();
        await camera.initialize(hass, mock<EntityRegistryManager>());

        callHASubscribeMessageHandler(hass, {
          variables: {
            trigger: {
              from_state: {
                entity_id: 'binary_sensor.foo',
                state: stateFrom,
              },
              to_state: {
                entity_id: 'binary_sensor.foo',
                state: stateTo,
              },
            },
          },
        });

        expect(eventCallback).toBeCalledWith({
          cameraID: 'camera_1',
          type: eventType,
        });
      },
    );
  });
});
