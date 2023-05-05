import { describe, expect, it, vi } from 'vitest';
import { CameraManagerEngineFactory } from '../../src/camera-manager/engine-factory.js';
import { FrigateCameraManagerEngine } from '../../src/camera-manager/frigate/engine-frigate';
import { GenericCameraManagerEngine } from '../../src/camera-manager/generic/engine-generic';
import { MotionEyeCameraManagerEngine } from '../../src/camera-manager/motioneye/engine-motioneye';
import { Engine } from '../../src/camera-manager/types.js';
import { CardWideConfig } from '../../src/types.js';
import { EntityRegistryManager } from '../../src/utils/ha/entity-registry';
import { EntityCache } from '../../src/utils/ha/entity-registry/cache';
import { ResolvedMediaCache } from '../../src/utils/ha/resolved-media';
import { createCameraConfig, createHASS, createRegistryEntity } from '../test-utils';

vi.mock('../../src/utils/ha/entity-registry');
vi.mock('../../src/utils/ha/entity-registry/cache');

const createFactory = (options?: {
  entityRegistryManager?: EntityRegistryManager;
  resolvedMediaCache?: ResolvedMediaCache;
  cardWideConfig?: CardWideConfig;
}): CameraManagerEngineFactory => {
  return new CameraManagerEngineFactory(
    options?.entityRegistryManager ?? new EntityRegistryManager(new EntityCache()),
    options?.resolvedMediaCache ?? new ResolvedMediaCache(),
    options?.cardWideConfig ?? {},
  );
};

describe('CameraManagerEngineFactory.getEngineForCamera()', () => {
  it('should get frigate engine from config', async () => {
    const config = createCameraConfig({ engine: 'frigate' });
    expect(await createFactory().getEngineForCamera(createHASS(), config)).toBe(
      Engine.Frigate,
    );
  });
  it('should get motionEye engine from config', async () => {
    const config = createCameraConfig({ engine: 'motioneye' });
    expect(await createFactory().getEngineForCamera(createHASS(), config)).toBe(
      Engine.MotionEye,
    );
  });
  it('should get generic engine from config', async () => {
    const config = createCameraConfig({ engine: 'generic' });
    expect(await createFactory().getEngineForCamera(createHASS(), config)).toBe(
      Engine.Generic,
    );
  });
  it('should get frigate engine from auto config', async () => {
    const config = createCameraConfig({ engine: 'auto', camera_entity: 'camera.foo' });
    const entityRegistryManager = new EntityRegistryManager(new EntityCache());

    entityRegistryManager.getEntity = vi
      .fn()
      .mockResolvedValue(
        createRegistryEntity({ entity_id: 'camera.foo', platform: 'frigate' }),
      );

    expect(
      await createFactory({
        entityRegistryManager: entityRegistryManager,
      }).getEngineForCamera(createHASS(), config),
    ).toBe(Engine.Frigate);
  });
  it('should get motioneye engine from auto config', async () => {
    const config = createCameraConfig({ engine: 'auto', camera_entity: 'camera.foo' });
    const entityRegistryManager = new EntityRegistryManager(new EntityCache());

    entityRegistryManager.getEntity = vi
      .fn()
      .mockResolvedValue(
        createRegistryEntity({ entity_id: 'camera.foo', platform: 'motioneye' }),
      );

    expect(
      await createFactory({
        entityRegistryManager: entityRegistryManager,
      }).getEngineForCamera(createHASS(), config),
    ).toBe(Engine.MotionEye);
  });
  it('should get generic engine from auto config', async () => {
    const config = createCameraConfig({ engine: 'auto', camera_entity: 'camera.foo' });
    const entityRegistryManager = new EntityRegistryManager(new EntityCache());

    entityRegistryManager.getEntity = vi
      .fn()
      .mockResolvedValue(
        createRegistryEntity({ entity_id: 'camera.foo', platform: 'generic' }),
      );

    expect(
      await createFactory({
        entityRegistryManager: entityRegistryManager,
      }).getEngineForCamera(createHASS(), config),
    ).toBe(Engine.Generic);
  });
  it('should get frigate engine from config with camera_name', async () => {
    const config = createCameraConfig({
      frigate: { client_id: 'bar', camera_name: 'foo' },
    });
    expect(await createFactory().getEngineForCamera(createHASS(), config)).toBe(
      Engine.Frigate,
    );
  });
  it('should throw error on invalid entity', async () => {
    const config = createCameraConfig({ engine: 'auto', camera_entity: 'camera.foo' });
    const entityRegistryManager = new EntityRegistryManager(new EntityCache());

    entityRegistryManager.getEntity = vi.fn().mockRejectedValue(new Error());

    await expect(
      createFactory({
        entityRegistryManager: entityRegistryManager,
      }).getEngineForCamera(createHASS(), config),
    ).rejects.toThrow();
  });
  it('should treat entity not in registry but with state as generic', async () => {
    const config = createCameraConfig({
      engine: 'auto',
      webrtc_card: { entity: 'camera.foo' },
    });
    const entityRegistryManager = new EntityRegistryManager(new EntityCache());

    entityRegistryManager.getEntity = vi.fn().mockRejectedValue(new Error());

    expect(
      await createFactory({
        entityRegistryManager: entityRegistryManager,
      }).getEngineForCamera(
        createHASS({
          'camera.foo': {
            entity_id: 'camera.foo',
            state: 'streaming',
            last_changed: 'bar',
            last_updated: 'baz',
            attributes: {},
            context: {
              id: 'context',
              user_id: null,
              parent_id: null,
            },
          },
        }),
        config,
      ),
    ).toBe(Engine.Generic);
  });
  it('should get engine from webrtc-card configuration', async () => {
    const config = createCameraConfig({ engine: 'auto', camera_entity: 'camera.foo' });
    const entityRegistryManager = new EntityRegistryManager(new EntityCache());

    entityRegistryManager.getEntity = vi.fn().mockRejectedValue(new Error());

    await expect(
      createFactory({
        entityRegistryManager: entityRegistryManager,
      }).getEngineForCamera(createHASS(), config),
    ).rejects.toThrow();
  });
});

describe('CameraManagerEngineFactory.createEngine()', () => {
  it('should create generic engine', async () => {
    expect(await createFactory().createEngine(Engine.Generic)).toBeInstanceOf(
      GenericCameraManagerEngine,
    );
  });
  it('should create frigate engine', async () => {
    expect(await createFactory().createEngine(Engine.Frigate)).toBeInstanceOf(
      FrigateCameraManagerEngine,
    );
  });
  it('should create motioneye engine', async () => {
    expect(await createFactory().createEngine(Engine.MotionEye)).toBeInstanceOf(
      MotionEyeCameraManagerEngine,
    );
  });
});
