import { HomeAssistant } from 'custom-card-helpers';
import { homeAssistantWSRequest } from '.';
import {
  Entity,
  EntityList,
  entityListSchema,
  ExtendedEntity,
  extendedEntitySchema,
} from '../../types.js';

export class ExtendedEntityCache {
  protected _cache: Map<string, ExtendedEntity> = new Map();

  /**
   * Determine if the cache has a given entity_id.
   * @param id
   * @returns `true` if the id is in the cache, `false` otherwise.
   */
  public has(id: string): boolean {
    return this._cache.has(id);
  }

  /**
   * Get the first value that returns true for the given predicate.
   * @param func A callback function that returns a boolean.
   * @returns The first matching value.
   */
  public getMatch(func: (arg: ExtendedEntity) => boolean): ExtendedEntity | null {
    return [...this._cache.values()].find(func) ?? null;
  }

  /**
   * Get entity information given an id.
   * @param id The entity id.
   * @returns The `ExtendedEntity` for this id.
   */
  public get(id: string): ExtendedEntity | undefined {
    return this._cache.get(id);
  }

  /**
   * Add a given ExtendedEntity to the cache.
   * @param extendedEntity
   */
  public set(extendedEntity: ExtendedEntity): void {
    this._cache.set(extendedEntity.entity_id, extendedEntity);
  }
}

/**
 * Get the extended entity information for an entity. May throw.
 * @param hass The Home Assistant object.
 * @param entity The entity id.
 * @param cache An optional ExtendedEntityCache.
 * @returns The ExtendedEntity information.
 */
export const getExtendedEntity = async (
  hass: HomeAssistant,
  entity: string,
  cache?: ExtendedEntityCache,
): Promise<ExtendedEntity> => {
  const cachedValue = cache ? cache.get(entity) : undefined;
  if (cachedValue) {
    return cachedValue;
  }
  const result = await homeAssistantWSRequest<ExtendedEntity>(
    hass,
    extendedEntitySchema,
    {
      type: 'config/entity_registry/get',
      entity_id: entity,
    },
  );
  if (cache) {
    cache.set(result);
  }
  return result;
};

/**
 * Get the extended entity information for an array of entities. May throw.
 * @param hass The Home Assistant object.
 * @param entities An array of entity ids.
 * @param cache An optional ExtendedEntityCache.
 * @returns A map of entity id to ExtendedEntity objects.
 */
export const getExtendedEntities = async (
  hass: HomeAssistant,
  entities: string[],
  cache?: ExtendedEntityCache,
): Promise<Map<string, Entity>> => {
  const output: Map<string, Entity> = new Map();
  const _storeExtendedEntity = async (entity: string): Promise<void> => {
    output.set(entity, await getExtendedEntity(hass, entity, cache));
  };
  await Promise.all(entities.map(_storeExtendedEntity));
  return output;
};

/**
 * Get a list of all entities from the entity registry. May throw.
 * @param hass The Home Assistant object.
 * @returns An entity list object.
 */
export const getAllEntities = async (hass: HomeAssistant): Promise<EntityList> => {
  return await homeAssistantWSRequest<EntityList>(hass, entityListSchema, {
    type: 'config/entity_registry/list',
  });
};
