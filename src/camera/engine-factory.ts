import { CameraConfig } from '../types';
import { RecordingSegmentsCache, RequestCache } from './cache';
import { CameraManagerEngine } from './engine';
import { FrigateCameraManagerEngine } from './frigate/engine-frigate';
import { Engine } from './types';

type CameraManagerEngineCameraIDMap = Map<CameraManagerEngine, Set<string>>;

export class CameraManagerEngineFactory {
  protected _engines: Map<Engine, CameraManagerEngine> = new Map();

  public getEngine(engine: Engine): CameraManagerEngine | null {
    const cachedEngine = this._engines.get(engine);
    if (cachedEngine) {
      return cachedEngine;
    }
    let cameraManagerEngine: CameraManagerEngine | null = null;
    switch (engine) {
      case Engine.Frigate:
        cameraManagerEngine = new FrigateCameraManagerEngine(
          new RecordingSegmentsCache(),
          new RequestCache(),
        );
        break;
    }
    if (cameraManagerEngine) {
      this._engines.set(engine, cameraManagerEngine);
    }
    return cameraManagerEngine;
  }

  public getEngineForCamera(cameraConfig?: CameraConfig): CameraManagerEngine | null {
    if (!cameraConfig) {
      return null;
    }

    let engine: Engine | null = null;
    if (cameraConfig.frigate.camera_name) {
      engine = Engine.Frigate;
    }
    return engine ? this.getEngine(engine) : null;
  }

  public getEnginesForCameraIDs(
    cameras: Map<string, CameraConfig>,
    cameraIDs: Set<string>,
  ): CameraManagerEngineCameraIDMap | null {
    const output: CameraManagerEngineCameraIDMap = new Map();

    for (const cameraID of cameraIDs) {
      const cameraConfig = cameras.get(cameraID);
      if (!cameraConfig) {
        continue;
      }

      const engine = this.getEngineForCamera(cameraConfig);
      if (!engine) {
        continue;
      }
      if (!output.has(engine)) {
        output.set(engine, new Set());
      }
      output.get(engine)?.add(cameraID);
    }
    return output.size ? output : null;
  }

  public getAllEngines(
    cameras: Map<string, CameraConfig>,
  ): CameraManagerEngine[] | null {
    const engines = this.getEnginesForCameraIDs(cameras, new Set(cameras.keys()));
    return engines ? [...engines.keys()] : null;
  }
}
