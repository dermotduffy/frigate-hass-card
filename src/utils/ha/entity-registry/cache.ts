import { Entity, ExtendedEntity } from './types.js';

export class EntityCache<T extends Entity | ExtendedEntity> {
  protected _cache: Map<string, T> = new Map();

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

  public getMatches(func: (arg: T) => boolean): T[] {
    return [...this._cache.values()].filter(func);
  }

  /**
   * Get entity information given an id.
   * @param id The entity id.
   * @returns The `ExtendedEntity` for this id.
   */
  public get(id: string): T | undefined {
    return this._cache.get(id);
  }

  /**
   * Add a given entity to the cache.
   * @param extendedEntity
   */
  public set(input: T | T[]): void {
    const _set = (entity: T) => this._cache.set(entity.entity_id, entity);

    if (Array.isArray(input)) {
      input.forEach(_set);
    } else {
      _set(input);
    }
  }
}
