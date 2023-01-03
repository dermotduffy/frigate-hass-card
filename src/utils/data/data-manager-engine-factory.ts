import { CameraConfig } from '../../types';
import { RecordingSegmentsCache } from './data-manager-cache';
import { DataManagerEngine } from './data-manager-engine';
import { FrigateDataManagerEngine } from './data-manager-engine-frigate';
import { DataQuery } from './data-types';

export class DataManagerEngineFactory {
  protected _engines: Map<string, DataManagerEngine> = new Map();

  protected _getOrCreateEngine(engineKey: string): DataManagerEngine | null {
    const cachedEngine = this._engines.get(engineKey);
    if (cachedEngine) {
      return cachedEngine;
    }
    let newEngine: DataManagerEngine | null = null;
    switch (engineKey) {
      case 'frigate':
        newEngine = new FrigateDataManagerEngine(new RecordingSegmentsCache());
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
  ): DataManagerEngine | null {
    const cameraConfig = cameras.get(query.cameraID);
    return cameraConfig ? this.getEngineForCamera(cameraConfig) : null;
  }

  public getEngineForCamera(cameraConfig: CameraConfig): DataManagerEngine | null {
    let engineKey: string | null = null;
    if (cameraConfig.frigate.camera_name) {
      engineKey = 'frigate';
    }
    return engineKey ? this._getOrCreateEngine(engineKey) : null;
  }
}
