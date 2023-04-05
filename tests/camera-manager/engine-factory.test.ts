import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { EntityRegistryManager } from '../../src/utils/ha/entity-registry';
import { EntityCache } from '../../src/utils/ha/entity-registry/cache';
import { CameraManagerEngineFactory } from '../../src/camera-manager/engine-factory.js';
import { CameraConfig, cameraConfigSchema, CardWideConfig } from '../../src/types.js';
import { HomeAssistant } from 'custom-card-helpers';
import { Engine } from '../../src/camera-manager/types.js';
import { Entity } from '../../src/utils/ha/entity-registry/types.js';
import { ResolvedMediaCache } from '../../src/utils/ha/resolved-media';
import { GenericCameraManagerEngine } from '../../src/camera-manager/generic/engine-generic';
import { FrigateCameraManagerEngine } from '../../src/camera-manager/frigate/engine-frigate';
import { MotionEyeCameraManagerEngine } from '../../src/camera-manager/motioneye/engine-motioneye';

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

const createCameraConfig = (config: Partial<CameraConfig>): CameraConfig => {
  return cameraConfigSchema.parse(config);
};

const createHASS = (): HomeAssistant => {
  return mock<HomeAssistant>();
};

const createEntity = (entity: Partial<Entity>): Entity => {
  return {
    ...entity,
    config_entry_id: entity.config_entry_id ?? null,
    device_id: entity.device_id ?? null,
    disabled_by: entity.disabled_by ?? null,
    entity_id: entity.entity_id ?? 'entity_id',
    hidden_by: entity.hidden_by ?? null,
    platform: entity.platform ?? 'platform',
    translation_key: entity.translation_key ?? null,
    unique_id: entity.unique_id ?? 'unique_id',
  };
};

describe('getEngineForCamera()', () => {
  it('config:frigate', async () => {
    const config = createCameraConfig({ engine: 'frigate' });
    expect(await createFactory().getEngineForCamera(createHASS(), config)).toBe(
      Engine.Frigate,
    );
  });
  it('config:motionEye', async () => {
    const config = createCameraConfig({ engine: 'motioneye' });
    expect(await createFactory().getEngineForCamera(createHASS(), config)).toBe(
      Engine.MotionEye,
    );
  });
  it('auto:frigate', async () => {
    const config = createCameraConfig({ engine: 'auto', camera_entity: 'camera.foo' });
    const entityRegistryManager = new EntityRegistryManager(new EntityCache());

    entityRegistryManager.getEntity = vi
      .fn()
      .mockResolvedValue(createEntity({ entity_id: 'camera.foo', platform: 'frigate' }));

    expect(
      await createFactory({
        entityRegistryManager: entityRegistryManager,
      }).getEngineForCamera(createHASS(), config),
    ).toBe(Engine.Frigate);
  });
  it('auto:motioneye', async () => {
    const config = createCameraConfig({ engine: 'auto', camera_entity: 'camera.foo' });
    const entityRegistryManager = new EntityRegistryManager(new EntityCache());

    entityRegistryManager.getEntity = vi
      .fn()
      .mockResolvedValue(
        createEntity({ entity_id: 'camera.foo', platform: 'motioneye' }),
      );

    expect(
      await createFactory({
        entityRegistryManager: entityRegistryManager,
      }).getEngineForCamera(createHASS(), config),
    ).toBe(Engine.MotionEye);
  });
  it('auto:motioneye', async () => {
    const config = createCameraConfig({ engine: 'auto', camera_entity: 'camera.foo' });
    const entityRegistryManager = new EntityRegistryManager(new EntityCache());

    entityRegistryManager.getEntity = vi
      .fn()
      .mockResolvedValue(createEntity({ entity_id: 'camera.foo', platform: 'generic' }));

    expect(
      await createFactory({
        entityRegistryManager: entityRegistryManager,
      }).getEngineForCamera(createHASS(), config),
    ).toBe(Engine.Generic);
  });
  it('config:frigate:camera_name', async () => {
    const config = createCameraConfig({
      frigate: { client_id: 'bar', camera_name: 'foo' },
    });
    expect(await createFactory().getEngineForCamera(createHASS(), config)).toBe(
      Engine.Frigate,
    );
  });
  it('config:frigate:throw', async () => {
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

describe('createEngine()', () => {
  it('generic', async () => {
    expect(await createFactory().createEngine(Engine.Generic)).toBeInstanceOf(
      GenericCameraManagerEngine,
    );
  });
  it('frigate', async () => {
    expect(await createFactory().createEngine(Engine.Frigate)).toBeInstanceOf(
      FrigateCameraManagerEngine,
    );
  });
  it('motioneye', async () => {
    expect(await createFactory().createEngine(Engine.MotionEye)).toBeInstanceOf(
      MotionEyeCameraManagerEngine,
    );
  });
});
