import { HomeAssistant } from 'custom-card-helpers';
import { localize } from '../localize/localize';
import { CameraConfig, CardWideConfig } from '../types';
import { EntityRegistryManager } from '../utils/ha/entity-registry';
import { Entity } from '../utils/ha/entity-registry/types';
import { RecordingSegmentsCache, RequestCache } from './cache';
import { CameraManagerEngine } from './engine';
import { CameraInitializationError } from './error';
import { FrigateCameraManagerEngine } from './frigate/engine-frigate';
import { GenericCameraManagerEngine } from './generic/engine-generic';
import { Engine } from './types';

export class CameraManagerEngineFactory {
  protected _entityRegistryManager: EntityRegistryManager;
  protected _cardWideConfig: CardWideConfig;

  constructor(
    entityRegistryManager: EntityRegistryManager,
    cardWideConfig: CardWideConfig,
  ) {
    this._entityRegistryManager = entityRegistryManager;
    this._cardWideConfig = cardWideConfig;
  }

  public async createEngine(engine: Engine): Promise<CameraManagerEngine | null> {
    let cameraManagerEngine: CameraManagerEngine | null = null;
    switch (engine) {
      case Engine.Generic:
        cameraManagerEngine = new GenericCameraManagerEngine();
        break;
      case Engine.Frigate:
        cameraManagerEngine = new FrigateCameraManagerEngine(
          this._cardWideConfig,
          new RecordingSegmentsCache(),
          new RequestCache(),
        );
        break;
    }
    return cameraManagerEngine;
  }

  public async getEngineForCamera(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
  ): Promise<Engine | null> {
    if (!cameraConfig) {
      return null;
    }

    let engine: Engine | null = null;
    if (cameraConfig.engine === 'frigate') {
      engine = Engine.Frigate;
    } else if (cameraConfig.engine === 'auto') {
      const cameraEntity = cameraConfig.camera_entity;

      if (cameraEntity) {
        let entity: Entity | null;
        try {
          entity = await this._entityRegistryManager.getEntity(hass, cameraEntity);
        } catch (e) {
          // Throw a slightly friendlier exception (as a typo in the entity is
          // likely to be a common failure mode).
          throw new CameraInitializationError(
            localize('error.no_camera_entity'),
            cameraConfig,
          );
        }

        switch (entity?.platform) {
          case 'frigate':
            engine = Engine.Frigate;
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
