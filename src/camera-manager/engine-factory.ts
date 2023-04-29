import { HomeAssistant } from 'custom-card-helpers';
import { localize } from '../localize/localize';
import { CameraConfig, CardWideConfig } from '../types';
import { BrowseMediaManager } from '../utils/ha/browse-media/browse-media-manager';
import { BrowseMedia } from '../utils/ha/browse-media/types';
import { EntityRegistryManager } from '../utils/ha/entity-registry';
import { Entity } from '../utils/ha/entity-registry/types';
import { ResolvedMediaCache } from '../utils/ha/resolved-media';
import { MemoryRequestCache, RecordingSegmentsCache, RequestCache } from './cache';
import { CameraManagerEngine } from './engine';
import { CameraInitializationError } from './error';
import { Engine } from './types';
import { getCameraEntityFromConfig } from './util';

export class CameraManagerEngineFactory {
  protected _entityRegistryManager: EntityRegistryManager;
  protected _resolvedMediaCache: ResolvedMediaCache;
  protected _cardWideConfig: CardWideConfig;

  constructor(
    entityRegistryManager: EntityRegistryManager,
    resolvedMediaCache: ResolvedMediaCache,
    cardWideConfig: CardWideConfig,
  ) {
    this._entityRegistryManager = entityRegistryManager;
    this._cardWideConfig = cardWideConfig;
    this._resolvedMediaCache = resolvedMediaCache;
  }

  public async createEngine(engine: Engine): Promise<CameraManagerEngine | null> {
    let cameraManagerEngine: CameraManagerEngine | null = null;
    switch (engine) {
      case Engine.Generic:
        const { GenericCameraManagerEngine } = await import('./generic/engine-generic');
        cameraManagerEngine = new GenericCameraManagerEngine();
        break;
      case Engine.Frigate:
        const { FrigateCameraManagerEngine } = await import('./frigate/engine-frigate');
        cameraManagerEngine = new FrigateCameraManagerEngine(
          this._cardWideConfig,
          new RecordingSegmentsCache(),
          new RequestCache(),
        );
        break;
      case Engine.MotionEye:
        const { MotionEyeCameraManagerEngine } = await import(
          './motioneye/engine-motioneye'
        );
        cameraManagerEngine = new MotionEyeCameraManagerEngine(
          new BrowseMediaManager(new MemoryRequestCache<string, BrowseMedia>()),
          this._resolvedMediaCache,
          new RequestCache(),
        );
    }
    return cameraManagerEngine;
  }

  public async getEngineForCamera(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
  ): Promise<Engine | null> {
    let engine: Engine | null = null;
    if (cameraConfig.engine === 'frigate') {
      engine = Engine.Frigate;
    } else if (cameraConfig.engine === 'motioneye') {
      engine = Engine.MotionEye;
    } else if (cameraConfig.engine === 'generic') {
      engine = Engine.Generic;
    } else if (cameraConfig.engine === 'auto') {
      const cameraEntity = getCameraEntityFromConfig(cameraConfig);

      if (cameraEntity) {
        let entity: Entity | null;
        try {
          entity = await this._entityRegistryManager.getEntity(hass, cameraEntity);
        } catch (e) {
          // If the camera is not in the registry, but is in the HA states it is
          // assumed to be a generic camera.
          if (hass.states[cameraEntity]) {
            return Engine.Generic;
          }
          // Otherwise, it's probably a typo so throw an exception.
          throw new CameraInitializationError(
            localize('error.no_camera_entity'),
            cameraConfig,
          );
        }

        switch (entity?.platform) {
          case 'frigate':
            engine = Engine.Frigate;
            break;
          case 'motioneye':
            engine = Engine.MotionEye;
            break;
          default:
            engine = Engine.Generic;
        }
      } else if (cameraConfig.frigate.camera_name) {
        // Frigate technically does not need an entity, if the camera name is
        // manually set the camera is assumed to be Frigate.
        engine = Engine.Frigate;
      }
    }

    return engine;
  }
}
