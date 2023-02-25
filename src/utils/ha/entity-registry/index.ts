import { HomeAssistant } from 'custom-card-helpers';
import { homeAssistantWSRequest } from '..';
import { EntityCache } from './cache';
import {
  Entity,
  EntityList,
  entityListSchema,
  ExtendedEntity,
  extendedEntitySchema,
} from './types.js';

type EntityRegistryCache = EntityCache<Entity>;
type ExtendedEntityRegistryCache = EntityCache<ExtendedEntity>;

// Tne `entity_registry/list` call returns a smaller set of information for
// every entity, than the full `entity_registry/get` call returns for a single
// entity. This class manages interactions with entities, caching results
// (either the partial or extended versions) and fetching as necessary. Some
// calls require every entity to be fetched, which may be non-trivial in size
// (after which it is cached forever).

export class EntityRegistryManager {
  protected _cache: EntityRegistryCache;
  protected _extendedCache: ExtendedEntityRegistryCache;
  protected _fetchedEntityList = false;

  constructor(cache: EntityCache<Entity>, extendedCache: EntityCache<ExtendedEntity>) {
    this._cache = cache;
    this._extendedCache = extendedCache;
  }

  public async getEntity(hass: HomeAssistant, entityID: string): Promise<Entity | null> {
    const cachedEntity = this._cache.get(entityID);
    if (cachedEntity) {
      return cachedEntity;
    }

    const cachedExtendedEntity = this._extendedCache.get(entityID);
    if (cachedExtendedEntity) {
      return cachedExtendedEntity;
    }
    return await this.getExtendedEntity(hass, entityID);
  }

  public async getMatchingEntities(
    hass: HomeAssistant,
    func: (arg: Entity) => boolean,
  ): Promise<Entity[]> {
    await this.fetchEntityList(hass);
    return this._cache.getMatches(func);
  }

  public async getExtendedEntity(
    hass: HomeAssistant,
    entityID: string,
  ): Promise<ExtendedEntity> {
    const cachedValue = this._extendedCache.get(entityID);
    if (cachedValue) {
      return cachedValue;
    }
    const extendedEntity = await homeAssistantWSRequest<ExtendedEntity>(
      hass,
      extendedEntitySchema,
      {
        type: 'config/entity_registry/get',
        entity_id: entityID,
      },
    );
    this._extendedCache.set(extendedEntity);
    return extendedEntity;
  }

  public async getEntities(
    hass: HomeAssistant,
    entityIDs: string[],
  ): Promise<Map<string, Entity>> {
    const output: Map<string, Entity> = new Map();
    const _storeEntity = async (entityID: string): Promise<void> => {
      const entity = await this.getEntity(hass, entityID);
      if (entity) {
        output.set(entityID, entity);
      }
    };
    await Promise.all(entityIDs.map(_storeEntity));
    return output;
  }

  public async getExtendedEntities(
    hass: HomeAssistant,
    entityIDs: string[],
  ): Promise<Map<string, ExtendedEntity>> {
    const output: Map<string, ExtendedEntity> = new Map();
    const _storeExtendedEntity = async (entityID: string): Promise<void> => {
      const extendedEntity = await this.getExtendedEntity(hass, entityID);
      if (extendedEntity) {
        output.set(entityID, extendedEntity);
      }
    };
    await Promise.all(entityIDs.map(_storeExtendedEntity));
    return output;
  }

  public async fetchEntityList(hass: HomeAssistant): Promise<void> {
    if (this._fetchedEntityList) {
      return;
    }
    const entityList = await homeAssistantWSRequest<EntityList>(hass, entityListSchema, {
      type: 'config/entity_registry/list',
    });
    this._cache.set(entityList);
    this._fetchedEntityList = true;
  }
}
