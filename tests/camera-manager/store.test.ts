import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManagerEngineFactory } from '../../src/camera-manager/engine-factory.js';
import { CameraManagerStore } from '../../src/camera-manager/store.js';
import { Engine } from '../../src/camera-manager/types.js';
import { EntityRegistryManager } from '../../src/utils/ha/entity-registry/index.js';
import { ResolvedMediaCache } from '../../src/utils/ha/resolved-media.js';
import { TestViewMedia, createCameraConfig } from '../test-utils.js';

describe('CameraManagerStore', async () => {
  const config_visible = createCameraConfig();
  const config_hidden = createCameraConfig({
    hide: true,
  });

  const engineFactory = new CameraManagerEngineFactory(
    mock<EntityRegistryManager>(),
    mock<ResolvedMediaCache>(),
  );

  const engineGeneric = await engineFactory.createEngine(Engine.Generic);
  const engineFrigate = await engineFactory.createEngine(Engine.Frigate);

  const setupStore = async (): Promise<CameraManagerStore> => {
    const store = new CameraManagerStore();
    store.addCamera('camera-visible', config_visible, engineGeneric);
    store.addCamera('camera-hidden', config_hidden, engineFrigate);
    return store;
  };

  it('getCameraConfig', async () => {
    const store = await setupStore();
    expect(store.getCameraConfig('camera-visible')).toBe(config_visible);
    expect(store.getCameraConfig('camera-hidden')).toBe(config_hidden);
    expect(store.getCameraConfig('camera-not-exist')).toBeNull();
  });

  it('hasCameraID', async () => {
    const store = await setupStore();
    expect(store.hasCameraID('camera-visible')).toBeTruthy();
    expect(store.hasCameraID('camera-hidden')).toBeTruthy();
  });

  it('hasVisibleCameraID', async () => {
    const store = await setupStore();
    expect(store.hasVisibleCameraID('camera-visible')).toBeTruthy();
    expect(store.hasVisibleCameraID('camera-hidden')).toBeFalsy();
  });

  it('getCameraCount', async () => {
    const store = await setupStore();
    expect(store.getCameraCount()).toBe(2);
  });

  it('getVisibleCameraCount', async () => {
    const store = await setupStore();
    expect(store.getVisibleCameraCount()).toBe(1);
  });

  it('getCameras', async () => {
    const store = await setupStore();
    expect(store.getCameras()).toEqual(
      new Map([
        ['camera-visible', config_visible],
        ['camera-hidden', config_hidden],
      ]),
    );
  });

  it('getVisibleCameras', async () => {
    const store = await setupStore();
    expect(store.getVisibleCameras()).toEqual(
      new Map([['camera-visible', config_visible]]),
    );
  });

  it('getCameraIDs', async () => {
    const store = await setupStore();
    expect(store.getCameraIDs()).toEqual(new Set(['camera-visible', 'camera-hidden']));
  });

  it('getVisibleCameraIDs', async () => {
    const store = await setupStore();
    expect(store.getVisibleCameraIDs()).toEqual(new Set(['camera-visible']));
  });

  it('reset', async () => {
    const store = await setupStore();

    store.reset();

    expect(store.getCameraCount()).toBe(0);
    expect(store.getVisibleCameraCount()).toBe(0);
  });

  it('getCameraConfigForMedia', async () => {
    const store = await setupStore();

    const media_1 = new TestViewMedia({ cameraID: 'camera-visible' });
    expect(store.getCameraConfigForMedia(media_1)).toBe(config_visible);

    const media_2 = new TestViewMedia({ cameraID: 'camera-not-exist' });
    expect(store.getCameraConfigForMedia(media_2)).toBeNull();
  });

  it('getEngineOfType', async () => {
    const store = await setupStore();
    expect(store.getEngineOfType(Engine.Generic)).toBe(engineGeneric);
    expect(store.getEngineOfType(Engine.Frigate)).toBe(engineFrigate);
    expect(store.getEngineOfType(Engine.MotionEye)).toBeNull();
  });

  it('getEngineForCameraID', async () => {
    const store = await setupStore();
    expect(store.getEngineForCameraID('camera-visible')).toBe(engineGeneric);
    expect(store.getEngineForCameraID('camera-hidden')).toBe(engineFrigate);
    expect(store.getEngineForCameraID('camera-not-exist')).toBeNull();
  });

  describe('getEnginesForCameraIDs', async () => {
    it('empty input', async () => {
      const store = await setupStore();
      expect(store.getEnginesForCameraIDs(new Set())).toBeNull();
    });

    it('multiple cameras', async () => {
      const store = await setupStore();
      store.addCamera('camera-visible2', config_visible, engineGeneric);
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
    const store = await setupStore();
    const media = new TestViewMedia({ cameraID: 'camera-visible' });
    expect(store.getEngineForMedia(media)).toBe(engineGeneric);
  });

  it('getAllEngines', async () => {
    const store = await setupStore();
    expect(store.getAllEngines()).toEqual([engineGeneric, engineFrigate]);
  });
});
