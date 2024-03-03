import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { Camera } from '../../src/camera-manager/camera.js';
import { CameraManagerEngineFactory } from '../../src/camera-manager/engine-factory.js';
import { CameraManagerStore } from '../../src/camera-manager/store.js';
import { Engine } from '../../src/camera-manager/types.js';
import { EntityRegistryManager } from '../../src/utils/ha/entity-registry/index.js';
import { ResolvedMediaCache } from '../../src/utils/ha/resolved-media.js';
import { createCameraConfig, TestViewMedia } from '../test-utils.js';

describe('CameraManagerStore', async () => {
  const configVisible = createCameraConfig({
    id: 'camera-visible',
  });
  const configHidden = createCameraConfig({
    id: 'camera-hidden',
    hide: true,
  });

  const engineFactory = new CameraManagerEngineFactory(
    mock<EntityRegistryManager>(),
    mock<ResolvedMediaCache>(),
  );

  const engineGeneric = await engineFactory.createEngine(Engine.Generic);
  const engineFrigate = await engineFactory.createEngine(Engine.Frigate);

  const setupStore = (): CameraManagerStore => {
    const store = new CameraManagerStore();
    const camera_1 = new Camera(configVisible, engineGeneric);
    const camera_2 = new Camera(configHidden, engineFrigate);

    camera_1.destroy = vi.fn();
    camera_2.destroy = vi.fn();

    store.addCamera(camera_1);
    store.addCamera(camera_2);
    return store;
  };

  it('getCameraConfig', async () => {
    const store = setupStore();
    expect(store.getCameraConfig('camera-visible')).toBe(configVisible);
    expect(store.getCameraConfig('camera-hidden')).toBe(configHidden);
    expect(store.getCameraConfig('camera-not-exist')).toBeNull();
  });

  it('hasCameraID', async () => {
    const store = setupStore();
    expect(store.hasCameraID('camera-visible')).toBeTruthy();
    expect(store.hasCameraID('camera-hidden')).toBeTruthy();
  });

  it('getCameraCount', async () => {
    const store = setupStore();
    expect(store.getCameraCount()).toBe(2);
  });

  it('getVisibleCameraCount', async () => {
    const store = setupStore();
    expect(store.getVisibleCameraCount()).toBe(1);
  });

  describe('getCamera', async () => {
    it('present', async () => {
      const store = setupStore();
      expect(store.getCamera('camera-visible')?.getConfig()).toEqual(configVisible);
    });

    it('absent', async () => {
      const store = setupStore();
      expect(store.getCamera('not-a-camera')).toBeNull();
    });
  });

  describe('getCameraConfigs', async () => {
    it('all', async () => {
      const store = setupStore();
      expect([...store.getCameraConfigs()]).toEqual([configVisible, configHidden]);
    });

    it('named', async () => {
      const store = setupStore();
      expect([...store.getCameraConfigs(['camera-visible', 'not-a-camera'])]).toEqual([
        configVisible,
      ]);
    });
  });

  describe('getCameraConfigEntries', async () => {
    it('all', async () => {
      const store = setupStore();
      expect([...store.getCameraConfigEntries()]).toEqual([
        ['camera-visible', configVisible],
        ['camera-hidden', configHidden],
      ]);
    });

    it('named', async () => {
      const store = setupStore();
      expect([
        ...store.getCameraConfigEntries(['camera-visible', 'not-a-camera']),
      ]).toEqual([['camera-visible', configVisible]]);
    });
  });

  it('getCameras', async () => {
    const store = setupStore();
    expect([...store.getCameras().keys()]).toEqual(['camera-visible', 'camera-hidden']);
    expect(store.getCameras().get('camera-visible')?.getConfig()).toEqual(configVisible);
    expect(store.getCameras().get('camera-hidden')?.getConfig()).toEqual(configHidden);
  });

  it('getCameraIDs', async () => {
    const store = setupStore();
    expect(store.getCameraIDs()).toEqual(new Set(['camera-visible', 'camera-hidden']));
  });

  it('getVisibleCameraIDs', async () => {
    const store = setupStore();
    expect(store.getVisibleCameraIDs()).toEqual(new Set(['camera-visible']));
  });

  it('reset', async () => {
    const store = setupStore();
    const cameras = [...store.getCameras().values()];

    await store.reset();

    expect(store.getCameraCount()).toBe(0);
    expect(store.getVisibleCameraCount()).toBe(0);
    for (const camera of cameras) {
      expect(camera.destroy).toBeCalled();
    }
  });

  it('getCameraConfigForMedia', async () => {
    const store = setupStore();

    const media_1 = new TestViewMedia({ cameraID: 'camera-visible' });
    expect(store.getCameraConfigForMedia(media_1)).toBe(configVisible);

    const media_2 = new TestViewMedia({ cameraID: 'camera-not-exist' });
    expect(store.getCameraConfigForMedia(media_2)).toBeNull();
  });

  it('getEngineOfType', async () => {
    const store = setupStore();
    expect(store.getEngineOfType(Engine.Generic)).toBe(engineGeneric);
    expect(store.getEngineOfType(Engine.Frigate)).toBe(engineFrigate);
    expect(store.getEngineOfType(Engine.MotionEye)).toBeNull();
  });

  it('getEngineForCameraID', async () => {
    const store = setupStore();
    expect(store.getEngineForCameraID('camera-visible')).toBe(engineGeneric);
    expect(store.getEngineForCameraID('camera-hidden')).toBe(engineFrigate);
    expect(store.getEngineForCameraID('camera-not-exist')).toBeNull();
  });

  describe('getEnginesForCameraIDs', async () => {
    it('empty input', async () => {
      const store = setupStore();
      expect(store.getEnginesForCameraIDs(new Set())).toBeNull();
    });

    it('multiple cameras', async () => {
      const store = setupStore();
      store.addCamera(
        new Camera(
          {
            ...configVisible,
            id: 'camera-visible2',
          },
          engineGeneric,
        ),
      );

      expect(
        store.getEnginesForCameraIDs(
          new Set([
            'camera-visible',
            'camera-visible2',
            'camera-hidden',
            'camera-not-exist',
          ]),
        ),
      ).toEqual(
        new Map([
          [engineGeneric, new Set(['camera-visible', 'camera-visible2'])],
          [engineFrigate, new Set(['camera-hidden'])],
        ]),
      );
    });
  });

  it('getEngineForMedia', async () => {
    const store = setupStore();
    const media = new TestViewMedia({ cameraID: 'camera-visible' });
    expect(store.getEngineForMedia(media)).toBe(engineGeneric);
  });

  describe('getAllDependentCameras', () => {
    it('should return dependent cameras', () => {
      const store = new CameraManagerStore();
      store.addCamera(
        new Camera(
          createCameraConfig({
            id: 'one',
            dependencies: {
              cameras: ['two', 'three'],
            },
          }),
          engineGeneric,
        ),
      );
      store.addCamera(
        new Camera(
          createCameraConfig({
            id: 'two',
          }),
          engineGeneric,
        ),
      );
      expect(store.getAllDependentCameras('one')).toEqual(new Set(['one', 'two']));
    });
    it('should return all cameras', () => {
      const store = new CameraManagerStore();
      store.addCamera(
        new Camera(
          createCameraConfig({
            id: 'one',
            dependencies: {
              all_cameras: true,
            },
          }),
          engineGeneric,
        ),
      );
      store.addCamera(
        new Camera(
          createCameraConfig({
            id: 'two',
          }),
          engineGeneric,
        ),
      );
      expect(store.getAllDependentCameras('one')).toEqual(new Set(['one', 'two']));
    });
  });
});
