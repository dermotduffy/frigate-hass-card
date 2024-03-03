import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { localize } from '../../localize/localize';
import { EntityRegistryManager } from '../../utils/ha/entity-registry';
import { Entity } from '../../utils/ha/entity-registry/types';
import { Camera } from '../camera';
import { CameraInitializationError } from '../error';

export class BrowseMediaCamera extends Camera {
  protected _entity: Entity | null = null;

  public async initialize(
    hass: HomeAssistant,
    entityRegistryManager: EntityRegistryManager,
  ): Promise<Camera> {
    const config = this.getConfig();
    const entity = config.camera_entity
      ? await entityRegistryManager.getEntity(hass, config.camera_entity)
      : null;

    if (!entity || !config.camera_entity) {
      throw new CameraInitializationError(localize('error.no_camera_entity'), config);
    }
    this._entity = entity;
    return this;
  }

  public getEntity(): Entity | null {
    return this._entity;
  }
}
