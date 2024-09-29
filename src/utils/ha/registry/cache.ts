export class RegistryCache<T> {
  protected _cache: Map<string, T> = new Map();
  protected _keyCallback: (_data: T) => string;

  constructor(keyCallback: (_data: T) => string) {
    this._keyCallback = keyCallback;
  }

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
  public getMatches(func: (arg: T) => boolean): T[] {
    return [...this._cache.values()].filter(func);
  }

  /**
   * Get entity information given an id.
   * @param id The entity id.
   * @returns The entity for this id.
   */
  public get(id: string): T | null {
    return this._cache.get(id) ?? null;
  }

  /**
   * Add a given entity to the cache.
   * @param input The entity.
   */
  public add(input: T | T[]): void {
    const _set = (arg: T) => this._cache.set(this._keyCallback(arg), arg);

    if (Array.isArray(input)) {
      input.forEach(_set);
    } else {
      _set(input);
    }
  }
}
