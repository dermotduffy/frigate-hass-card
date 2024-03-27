import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import uniq from 'lodash-es/uniq';
import { CameraConfig } from '../../config/types';
import { localize } from '../../localize/localize';
import { PTZCapabilities, PTZMovementType } from '../../types';
import { errorToConsole } from '../../utils/basic';
import { subscribeToTrigger } from '../../utils/ha';
import { EntityRegistryManager } from '../../utils/ha/entity-registry';
import { Entity } from '../../utils/ha/entity-registry/types';
import { Camera } from '../camera';
import { Capabilities } from '../capabilities';
import { CameraInitializationError } from '../error';
import { getCameraEntityFromConfig } from '../utils/camera-entity-from-config';
import { getPTZInfo } from './requests';
import { PTZInfo, frigateEventChangeTriggerResponseSchema } from './types';

const CAMERA_BIRDSEYE = 'birdseye' as const;

export const isBirdseye = (cameraConfig: CameraConfig): boolean => {
  return cameraConfig.frigate.camera_name === CAMERA_BIRDSEYE;
};

export class FrigateCamera extends Camera {
  public async initialize(
    hass: HomeAssistant,
    entityRegistryManager: EntityRegistryManager,
  ): Promise<Camera> {
    await this._initializeConfig(hass, entityRegistryManager);
    await this._initializeCapabilities(hass);
    await this._subscribeToEvents(hass);
    return await super.initialize(hass, entityRegistryManager);
  }

  protected async _initializeConfig(
    hass: HomeAssistant,
    entityRegistryManager: EntityRegistryManager,
  ): Promise<void> {
    const config = this.getConfig();
    const hasCameraName = !!config.frigate?.camera_name;
    const hasAutoTriggers = config.triggers.motion || config.triggers.occupancy;

    let entity: Entity | null = null;
    const cameraEntity = getCameraEntityFromConfig(config);

    // Entity information is required if the Frigate camera name is missing, or
    // if the entity requires automatic resolution of motion/occupancy sensors.
    if (cameraEntity && (!hasCameraName || hasAutoTriggers)) {
      try {
        entity = await entityRegistryManager.getEntity(hass, cameraEntity);
      } catch (e) {
        throw new CameraInitializationError(localize('error.no_camera_entity'), config);
      }
    }

    if (entity && !hasCameraName) {
      const resolvedName = this._getFrigateCameraNameFromEntity(entity);
      if (resolvedName) {
        this._config.frigate.camera_name = resolvedName;
      }
    }

    if (hasAutoTriggers) {
      // Try to find the correct entities for the motion & occupancy sensors.
      // We know they are binary_sensors, and that they'll have the same
      // config entry ID as the camera. Searching via unique_id ensures this
      // search still works if the user renames the entity_id.
      const binarySensorEntities = await entityRegistryManager.getMatchingEntities(
        hass,
        (ent) =>
          ent.config_entry_id === entity?.config_entry_id &&
          !ent.disabled_by &&
          ent.entity_id.startsWith('binary_sensor.'),
      );

      if (config.triggers.motion) {
        const motionEntity = this._getMotionSensor(config, [
          ...binarySensorEntities.values(),
        ]);
        if (motionEntity) {
          config.triggers.entities.push(motionEntity);
        }
      }

      if (config.triggers.occupancy) {
        const occupancyEntities = this._getOccupancySensor(config, [
          ...binarySensorEntities.values(),
        ]);
        if (occupancyEntities) {
          config.triggers.entities.push(...occupancyEntities);
        }
      }

      // De-duplicate triggering entities.
      config.triggers.entities = uniq(config.triggers.entities);
    }
  }

  protected async _initializeCapabilities(hass: HomeAssistant): Promise<void> {
    const config = this.getConfig();
    const ptz = await this._getPTZCapabilities(hass, config);
    const birdseye = isBirdseye(config);
    this._capabilities = new Capabilities(
      {
        'favorite-events': !birdseye,
        'favorite-recordings': false,
        seek: !birdseye,
        clips: !birdseye,
        snapshots: !birdseye,
        recordings: !birdseye,
        live: true,
        menu: true,
        substream: true,
        ...(ptz && { ptz: ptz }),
      },
      {
        disable: config.capabilities?.disable,
        disableExcept: config.capabilities?.disable_except,
      },
    );
  }

  protected _getFrigateCameraNameFromEntity(entity: Entity): string | null {
    if (
      entity.platform === 'frigate' &&
      entity.unique_id &&
      typeof entity.unique_id === 'string'
    ) {
      const match = entity.unique_id.match(/:camera:(?<camera>[^:]+)$/);
      if (match && match.groups) {
        return match.groups['camera'];
      }
    }
    return null;
  }

  protected async _getPTZCapabilities(
    hass: HomeAssistant,
    cameraConfig: CameraConfig,
  ): Promise<PTZCapabilities | null> {
    if (!cameraConfig.frigate.camera_name || isBirdseye(cameraConfig)) {
      return null;
    }

    let ptzInfo: PTZInfo | null = null;
    try {
      ptzInfo = await getPTZInfo(
        hass,
        cameraConfig.frigate.client_id,
        cameraConfig.frigate.camera_name,
      );
    } catch (e) {
      errorToConsole(e as Error);
      return null;
    }

    const panTilt: PTZMovementType[] = [
      ...(ptzInfo.features?.includes('pt') ? ['continuous' as const] : []),
      ...(ptzInfo.features?.includes('pt-r') ? ['relative' as const] : []),
    ];
    const zoom: PTZMovementType[] = [
      ...(ptzInfo.features?.includes('zoom') ? ['continuous' as const] : []),
      ...(ptzInfo.features?.includes('zoom-r') ? ['relative' as const] : []),
    ];
    const presets = ptzInfo.presets;

    if (panTilt.length || zoom.length || presets?.length) {
      return {
        ...(panTilt && { panTilt: panTilt }),
        ...(zoom && { zoom: zoom }),
        ...(presets && { presets: presets }),
      };
    }
    return null;
  }

  /**
   * Get the motion sensor entity for a given camera.
   * @param cache The EntityCache of entity registry information.
   * @param cameraConfig The camera config in question.
   * @returns The entity id of the motion sensor or null.
   */
  protected _getMotionSensor(
    cameraConfig: CameraConfig,
    entities: Entity[],
  ): string | null {
    if (cameraConfig.frigate.camera_name) {
      return (
        entities.find(
          (entity) =>
            typeof entity.unique_id === 'string' &&
            !!entity.unique_id?.match(
              new RegExp(`:motion_sensor:${cameraConfig.frigate.camera_name}`),
            ),
        )?.entity_id ?? null
      );
    }
    return null;
  }

  /**
   * Get the occupancy sensor entity for a given camera.
   * @param cache The EntityCache of entity registry information.
   * @param cameraConfig The camera config in question.
   * @returns The entity id of the occupancy sensor or null.
   */
  protected _getOccupancySensor(
    cameraConfig: CameraConfig,
    entities: Entity[],
  ): string[] | null {
    const entityIDs: string[] = [];
    const addEntityIDIfFound = (cameraOrZone: string, label: string): void => {
      const entityID =
        entities.find(
          (entity) =>
            typeof entity.unique_id === 'string' &&
            !!entity.unique_id?.match(
              new RegExp(`:occupancy_sensor:${cameraOrZone}_${label}`),
            ),
        )?.entity_id ?? null;
      if (entityID) {
        entityIDs.push(entityID);
      }
    };

    if (cameraConfig.frigate.camera_name) {
      // If zone(s) are specified, the master occupancy sensor for the overall
      // camera is not used by default (but could be manually added by the
      // user).
      const camerasAndZones = cameraConfig.frigate.zones?.length
        ? cameraConfig.frigate.zones
        : [cameraConfig.frigate.camera_name];

      const labels = cameraConfig.frigate.labels?.length
        ? cameraConfig.frigate.labels
        : ['all'];
      for (const cameraOrZone of camerasAndZones) {
        for (const label of labels) {
          addEntityIDIfFound(cameraOrZone, label);
        }
      }

      if (entityIDs.length) {
        return entityIDs;
      }
    }
    return null;
  }

  protected async _subscribeToEvents(hass: HomeAssistant): Promise<void> {
    const config = this.getConfig();
    if (!config.triggers.events.length || !config.frigate.camera_name) {
      return;
    }

    this._destroyCallbacks.push(
      await subscribeToTrigger(hass, (ev) => this._handleEventChange(ev), {
        platform: 'mqtt',
        topic: `${config.frigate.client_id}/events`,

        // Only trigger for events pertaining to this camera.
        payload: config.frigate.camera_name,
        valueTemplate: '{{ value_json.after.camera }}',
      }),
    );
  }

  protected _handleEventChange(ev: unknown): void {
    const parseResult = frigateEventChangeTriggerResponseSchema.safeParse(ev);
    if (!parseResult.success) {
      console.warn('Ignoring unparseable Frigate event', ev);
      return;
    }

    const change = parseResult.data.variables.trigger.payload_json;
    const snapshotChange =
      (!change.before.has_snapshot && change.after.has_snapshot) ||
      change.before.snapshot?.frame_time !== change.after.snapshot?.frame_time;
    const clipChange = !change.before.has_clip && change.after.has_clip;

    const config = this.getConfig();
    if (config.frigate.camera_name !== change.after.camera) {
      return;
    }

    if (
      (config.frigate.zones?.length &&
        !config.frigate.zones.some((zone) =>
          change.after.current_zones.includes(zone),
        )) ||
      (config.frigate.labels?.length &&
        !config.frigate.labels.includes(change.after.label))
    ) {
      return;
    }

    const eventsToTriggerOn = config.triggers.events;
    if (
      !(
        eventsToTriggerOn.includes('events') ||
        (eventsToTriggerOn.includes('snapshots') && snapshotChange) ||
        (eventsToTriggerOn.includes('clips') && clipChange)
      )
    ) {
      return;
    }

    this._eventCallback?.({
      fidelity: 'high',
      cameraID: this.getID(),
      type: change.type,
      // In cases where there are both clip and snapshot media, ensure to only
      // trigger on the media type that is allowed by the configuration.
      clip: clipChange && eventsToTriggerOn.includes('clips'),
      snapshot: snapshotChange && eventsToTriggerOn.includes('snapshots'),
    });
  }
}
