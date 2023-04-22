import { allPromises } from './basic';

enum InitializationState {
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
}

type Initializer = () => Promise<unknown>;

/**
 * Manages initialization state & calling initializers.
 */
export class FrigateCardInitializer {
  protected _state: Map<string, InitializationState>;

  constructor() {
    this._state = new Map();
  }

  public async initializeMultipleIfNecessary(
    aspects: Record<string, Initializer>,
  ): Promise<boolean> {
    const results = await allPromises(
      Object.entries(aspects),
      async ([aspect, options]) => this.initializeIfNecessary(aspect, options),
    );
    return results.every(Boolean);
  }

  /**
   *
   * @param aspect The aspect to initialize.
   * @param initializer The initializer to call.
   * @returns `true` if the state is confirmed as initialized, `false`
   * otherwise (i.e. initializing).
   */
  public async initializeIfNecessary(
    aspect: string,
    initializer?: Initializer,
  ): Promise<boolean> {
    const state = this._state.get(aspect);
    if (state !== InitializationState.INITIALIZED) {
      if (state !== InitializationState.INITIALIZING) {
        if (initializer) {
          this._state.set(aspect, InitializationState.INITIALIZING);
          await initializer();
          this._state.set(aspect, InitializationState.INITIALIZED);
        } else {
          this._state.set(aspect, InitializationState.INITIALIZED);
        }
        return true;
      }
      return false;
    }
    return true;
  }

  public uninitialize(aspect: string) {
    return this._state.delete(aspect);
  }

  public isInitialized(aspect: string): boolean {
    return this._state.get(aspect) == InitializationState.INITIALIZED;
  }

  public isInitializedMultiple(aspects: string[]): boolean {
    return aspects.every((aspect) => this.isInitialized(aspect));
  }
}
