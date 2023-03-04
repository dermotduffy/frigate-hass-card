import { Entity } from './types.js';

export class EntityCache {
  protected _cache: Map<string, Entity> = new Map();

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
  // public getFirstMatch(func: (arg: T) => boolean): T | null {
  //   return [...this._cache.values()].find(func) ?? null;
  // }

  public getMatches(func: (arg: Entity) => boolean): Entity[] {
    return [...this._cache.values()].filter(func);
  }

  /**
   * Get entity information given an id.
   * @param id The entity id.
   * @returns The entity for this id.
   */
  public get(id: string): Entity | undefined {
    return this._cache.get(id);
  }

  /**
   * Add a given entity to the cache.
   * @param input The entity.
   */
  public set(input: Entity | Entity[]): void {
    const _set = (entity: Entity) => this._cache.set(entity.entity_id, entity);

    if (Array.isArray(input)) {
      input.forEach(_set);
    } else {
      _set(input);
    }
  }
}
