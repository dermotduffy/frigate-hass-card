import { describe, expect, it } from 'vitest';
import { Camera } from '../../src/camera-manager/camera.js';
import { GenericCameraManagerEngine } from '../../src/camera-manager/generic/engine-generic.js';
import { createCameraCapabilities, createCameraConfig } from '../test-utils.js';

describe('Camera', () => {
  it('should get config', async () => {
    const config = createCameraConfig();
    const camera = new Camera(
      config,
      new GenericCameraManagerEngine(),
      createCameraCapabilities(),
    );
    expect(camera.getConfig()).toBe(config);
  });

  it('should get capabilities', async () => {
    const capabilities = createCameraCapabilities();
    const camera = new Camera(
      createCameraConfig(),
      new GenericCameraManagerEngine(),
      capabilities,
    );
    expect(camera.getCapabilities()).toBe(capabilities);
  });

  it('should get engine', async () => {
    const engine = new GenericCameraManagerEngine();
    const camera = new Camera(createCameraConfig(), engine, createCameraCapabilities());
    expect(camera.getEngine()).toBe(engine);
  });

  it('should set and get id', async () => {
    const config = createCameraConfig();
    const camera = new Camera(
      config,
      new GenericCameraManagerEngine(),
      createCameraCapabilities(),
    );
    camera.setID('foo');
    expect(camera.getID()).toBe('foo');
    expect(camera.getConfig().id).toBe('foo');
  });

  it('should throw without id', async () => {
    const config = createCameraConfig();
    const camera = new Camera(
      config,
      new GenericCameraManagerEngine(),
      createCameraCapabilities(),
    );
    expect(() => camera.getID()).toThrowError(
      'Could not determine camera id for the following ' +
        "camera, may need to set 'id' parameter manually",
    );
  });
});
