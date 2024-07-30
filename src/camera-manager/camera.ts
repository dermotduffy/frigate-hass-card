import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { CameraConfig } from '../config/types';
import { localize } from '../localize/localize';
import { allPromises } from '../utils/basic';
import {
  DestroyCallback,
  isTriggeredState,
  parseStateChangeTrigger,
  subscribeToTrigger,
} from '../utils/ha';
import { EntityRegistryManager } from '../utils/ha/entity-registry';
import { Capabilities } from './capabilities';
import { CameraManagerEngine } from './engine';
import { CameraNoIDError } from './error';
import { CameraEventCallback } from './types';

export class Camera {
  protected _config: CameraConfig;
  protected _engine: CameraManagerEngine;
  protected _capabilities?: Capabilities;
  protected _eventCallback?: CameraEventCallback;
  protected _destroyCallbacks: DestroyCallback[] = [];

  constructor(
    config: CameraConfig,
    engine: CameraManagerEngine,
    options?: {
      capabilities?: Capabilities;
      eventCallback?: CameraEventCallback;
    },
  ) {
    this._config = config;
    this._engine = engine;
    this._capabilities = options?.capabilities;
    this._eventCallback = options?.eventCallback;
  }

  protected async _convertStateChangeToCameraEvent(data: unknown): Promise<void> {
    const stateChange = parseStateChangeTrigger(data);
    if (!stateChange) {
      return;
    }

    this._eventCallback?.({
      cameraID: this.getID(),
      type: isTriggeredState(stateChange.to_state.state) ? 'new' : 'end',
    });
  }

  protected async _subscribeToTriggerEntities(hass: HomeAssistant): Promise<void> {
    if (!this._config.triggers.entities.length) {
      return;
    }

    this._destroyCallbacks.push(
      await subscribeToTrigger(
        hass,
        (data) => this._convertStateChangeToCameraEvent(data),
        {
          entityID: this._config.triggers.entities,
          platform: 'state',
          stateOnly: true,
        },
      ),
    );
  }

  async initialize(
    hass: HomeAssistant,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _entityRegistryManager: EntityRegistryManager,
  ): Promise<Camera> {
    await this._subscribeToTriggerEntities(hass);
    return this;
  }

  async destroy(): Promise<void> {
    await allPromises(this._destroyCallbacks, (cb) => cb());
  }

  public getConfig(): CameraConfig {
    return this._config;
  }

  public setID(cameraID: string): void {
    this._config.id = cameraID;
  }

  public getID(): string {
    if (this._config.id) {
      return this._config.id;
    }
    throw new CameraNoIDError(localize('error.no_camera_id'));
  }

  public getEngine(): CameraManagerEngine {
    return this._engine;
  }

  public getCapabilities(): Capabilities | null {
    return this._capabilities ?? null;
  }
}
