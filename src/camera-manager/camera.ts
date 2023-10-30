import { CameraConfig } from '../config/types';
import { localize } from '../localize/localize';
import { CameraManagerEngine } from './engine';
import { CameraNoIDError } from './error';
import { CameraManagerCameraCapabilities } from './types';

export class Camera {
  protected _config: CameraConfig;
  protected _engine: CameraManagerEngine;
  protected _capabilities: CameraManagerCameraCapabilities;

  constructor(
    config: CameraConfig,
    engine: CameraManagerEngine,
    capabilities: CameraManagerCameraCapabilities,
  ) {
    this._config = config;
    this._engine = engine;
    this._capabilities = capabilities;
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

  public getCapabilities(): CameraManagerCameraCapabilities {
    return this._capabilities;
  }
}
