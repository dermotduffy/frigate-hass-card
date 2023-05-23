import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManagerEngineFactory } from '../../src/camera-manager/engine-factory.js';
import { CameraManager } from '../../src/camera-manager/manager.js';
import { CameraManagerStore } from '../../src/camera-manager/store.js';
import { CameraConfigs } from '../../src/camera-manager/types.js';
import { getAllDependentCameras, getCameraID } from '../../src/utils/camera.js';
import { createCameraConfig } from '../test-utils.js';

vi.mock('../../src/camera-manager/manager.js');

describe('getCameraID', () => {
  it('should get camera id with id', () => {
    const config = createCameraConfig({ id: 'foo' });
    expect(getCameraID(config)).toBe('foo');
  });
  it('should get camera id with camera_entity', () => {
    const config = createCameraConfig({ camera_entity: 'foo' });
    expect(getCameraID(config)).toBe('foo');
  });
  it('should get camera id with webrtc entity', () => {
    const config = createCameraConfig({ webrtc_card: { entity: 'foo' } });
    expect(getCameraID(config)).toBe('foo');
  });
  it('should get camera id with frigate camera_name', () => {
    const config = createCameraConfig({
      frigate: { client_id: 'bar', camera_name: 'foo' },
    });
    expect(getCameraID(config)).toBe('foo');
  });
  it('should get blank id without anything', () => {
    const config = createCameraConfig({});
    expect(getCameraID(config)).toBe('');
  });
});

describe('getAllDependentCameras', () => {
  it('should return null without cameraManager', () => {
    expect(getAllDependentCameras()).toBeNull();
  });
  it('should return null without cameraID', () => {
    expect(getAllDependentCameras(mock<CameraManager>())).toBeNull();
  });
  it('should return dependent cameras', () => {
    const cameraConfigs: CameraConfigs = new Map([
      [
        'one',
        createCameraConfig({
          dependencies: {
            cameras: ['two', 'three'],
          },
        }),
      ],
      ['two', createCameraConfig({})],
    ]);

    const cameraManager = new CameraManager(mock<CameraManagerEngineFactory>(), {});
    const store = mock<CameraManagerStore>();
    vi.mocked(cameraManager.getStore).mockReturnValue(store);
    store.getCameras.mockReturnValue(cameraConfigs);

    expect(getAllDependentCameras(cameraManager, 'one')).toEqual(
      new Set(['one', 'two']),
    );
  });
  it('should return all cameras', () => {
    const cameraConfigs: CameraConfigs = new Map([
      [
        'one',
        createCameraConfig({
          dependencies: {
            all_cameras: true,
          },
        }),
      ],
      ['two', createCameraConfig({})],
    ]);

    const cameraManager = new CameraManager(mock<CameraManagerEngineFactory>(), {});
    const store = mock<CameraManagerStore>();
    vi.mocked(cameraManager.getStore).mockReturnValue(store);
    store.getCameras.mockReturnValue(cameraConfigs);

    expect(getAllDependentCameras(cameraManager, 'one')).toEqual(
      new Set(['one', 'two']),
    );
  });
});
