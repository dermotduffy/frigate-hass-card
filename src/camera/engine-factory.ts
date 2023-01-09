import { CameraConfig } from '../types';
import { RecordingSegmentsCache } from './cache';
import { CameraManagerEngine } from './engine';
import { FrigateCameraManagerEngine } from './frigate/engine-frigate';
import { DataQuery } from './types';

export class CameraManagerEngineFactory {
  protected _engines: Map<string, CameraManagerEngine> = new Map();

  protected _getOrCreateEngine(engineKey: string): CameraManagerEngine | null {
    const cachedEngine = this._engines.get(engineKey);
    if (cachedEngine) {
      return cachedEngine;
    }
    let newEngine: CameraManagerEngine | null = null;
    switch (engineKey) {
      case 'frigate':
        newEngine = new FrigateCameraManagerEngine(new RecordingSegmentsCache());
        break;
    }
    if (newEngine) {
      this._engines.set(engineKey, newEngine);
    }
    return newEngine;
  }

  public getEngineForQuery(
    cameras: Map<string, CameraConfig>,
    query: DataQuery,
  ): CameraManagerEngine | null {
    const cameraConfig = cameras.get(query.cameraID);
    return cameraConfig ? this.getEngineForCamera(cameraConfig) : null;
  }

  public getEngineForCamera(cameraConfig?: CameraConfig): CameraManagerEngine | null {
    if (!cameraConfig) {
      return null;
    }

    let engineKey: string | null = null;
    if (cameraConfig.frigate.camera_name) {
      engineKey = 'frigate';
    }
    return engineKey ? this._getOrCreateEngine(engineKey) : null;
  }
}
