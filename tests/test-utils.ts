import { HomeAssistant } from 'custom-card-helpers';
import { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { mock } from 'vitest-mock-extended';
import {
  CameraConfig,
  FrigateCardCondition,
  FrigateCardConfig,
  cameraConfigSchema,
  frigateCardConditionSchema,
  frigateCardConfigSchema,
} from '../src/types';
import { Entity } from '../src/utils/ha/entity-registry/types';

export const createCameraConfig = (config: Partial<CameraConfig>): CameraConfig => {
  return cameraConfigSchema.parse(config);
};

export const createCondition = (
  condition?: Partial<FrigateCardCondition>,
): FrigateCardCondition => {
  return frigateCardConditionSchema.parse(condition ?? {});
};

export const createConfig = (config?: Partial<FrigateCardConfig>): FrigateCardConfig => {
  return frigateCardConfigSchema.parse(config);
};

export const createHASS = (states?: HassEntities): HomeAssistant => {
  const hass = mock<HomeAssistant>();
  if (states) {
    hass.states = states;
  }
  return hass;
};

export const createRegistryEntity = (entity?: Partial<Entity>): Entity => {
  return {
    config_entry_id: entity?.config_entry_id ?? null,
    device_id: entity?.device_id ?? null,
    disabled_by: entity?.disabled_by ?? null,
    entity_id: entity?.entity_id ?? 'entity_id',
    hidden_by: entity?.hidden_by ?? null,
    platform: entity?.platform ?? 'platform',
    translation_key: entity?.translation_key ?? null,
    unique_id: entity?.unique_id ?? 'unique_id',
  };
};

export const createStateEntity = (entity?: Partial<HassEntity>): HassEntity => {
  return {
    entity_id: entity?.entity_id ?? 'entity_id',
    state: entity?.state ?? 'on',
    last_changed: entity?.last_changed ?? 'never',
    last_updated: entity?.last_updated ?? 'never',
    attributes: entity?.attributes ?? {},
    context: entity?.context ?? {
      id: 'id',
      parent_id: 'parent_id',
      user_id: 'user_id',
    },
  };
};
