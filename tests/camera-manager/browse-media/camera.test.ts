import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { BrowseMediaCamera } from '../../../src/camera-manager/browse-media/camera';
import { CameraManagerEngine } from '../../../src/camera-manager/engine';
import { EntityRegistryManager } from '../../../src/utils/ha/entity-registry';
import { Entity } from '../../../src/utils/ha/entity-registry/types';
import { createCameraConfig, createHASS } from '../../test-utils';

describe('BrowseMediaCamera', () => {
  describe('should initialize', () => {
    it('without a camera_entity', async () => {
      const camera = new BrowseMediaCamera(
        createCameraConfig(),
        mock<CameraManagerEngine>(),
      );

      expect(
        async () => await camera.initialize(createHASS(), mock<EntityRegistryManager>()),
      ).rejects.toThrowError(/Could not find camera entity/);
    });

    it('with a camera_entity', async () => {
      const camera = new BrowseMediaCamera(
        createCameraConfig({
          camera_entity: 'camera.foo',
        }),
        mock<CameraManagerEngine>(),
      );
      const entityRegistryManager = mock<EntityRegistryManager>();
      const entity = mock<Entity>();
      entityRegistryManager.getEntity.mockResolvedValue(entity);

      expect(await camera.initialize(createHASS(), entityRegistryManager)).toBe(camera);
      expect(camera.getEntity()).toBe(entity);
    });
  });
});
