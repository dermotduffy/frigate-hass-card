import uniq from 'lodash-es/uniq';
import { CameraConfig } from '../types';
import { ViewMedia } from '../view/media';
import { CameraManagerEngine } from './engine';
import { CameraConfigs, Engine } from './types';

type CameraManagerEngineCameraIDMap = Map<CameraManagerEngine, Set<string>>;

export class CameraManagerStore {
  protected _configs: Map<string, CameraConfig> = new Map();
  protected _engines: Map<string, CameraManagerEngine> = new Map();
  protected _enginesByType: Map<Engine, CameraManagerEngine> = new Map();

  public addCamera(
    cameraID: string,
    cameraConfig: CameraConfig,
    engine: CameraManagerEngine,
  ): void {
    this._configs.set(cameraID, cameraConfig);
    this._engines.set(cameraID, engine);
    this._enginesByType.set(engine.getEngineType(), engine);
  }

  public getCameraCount(): number {
    return this._configs.size;
  }

  public hasCameraID(cameraID: string): boolean {
    return this._configs.has(cameraID);
  }

  public getCameraConfig(cameraID: string): CameraConfig | null {
    return this._configs.get(cameraID) ?? null;
  }

  public getCameras(): CameraConfigs {
    return this._configs;
  }

  public getCameraIDs(): Set<string> {
    return new Set(this._configs.keys());
  }

  public getCameraConfigForMedia(media: ViewMedia): CameraConfig | null {
    const cameraID = media.getCameraID();
    if (!cameraID) {
      return null;
    }
    return this.getCameraConfig(cameraID);
  }

  public getEngineOfType(engine: Engine): CameraManagerEngine | null {
    return this._enginesByType.get(engine) ?? null;
  }

  public getEngineForCameraID(cameraID: string): CameraManagerEngine | null {
    return this._engines.get(cameraID) ?? null;
  }

  public getEnginesForCameraIDs(
    cameraIDs: Set<string>,
  ): CameraManagerEngineCameraIDMap | null {
    const output: CameraManagerEngineCameraIDMap = new Map();

    for (const cameraID of cameraIDs) {
      const engine = this.getEngineForCameraID(cameraID);
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

  public getEngineForMedia(media: ViewMedia): CameraManagerEngine | null {
    const cameraID = media.getCameraID();
    if (!cameraID) {
      return null;
    }
    return this.getEngineForCameraID(cameraID);
  }

  public getAllEngines(): CameraManagerEngine[] {
    return uniq([...this._engines.values()]);
  }
}
