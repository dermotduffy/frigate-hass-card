import { CameraConfig } from '../types';
import { ViewMedia } from '../view/media';
import { CameraManagerEngine } from './engine';
import { CameraConfigs, Engine } from './types';

type CameraManagerEngineCameraIDMap = Map<CameraManagerEngine, Set<string>>;

export interface CameraManagerReadOnlyConfigStore {
  getCameraConfig(cameraID: string): CameraConfig | null;
  getCameraConfigForMedia(media: ViewMedia): CameraConfig | null;

  hasCameraID(cameraID: string): boolean;
  hasVisibleCameraID(cameraID: string): boolean;

  getCameraCount(): number;
  getVisibleCameraCount(): number;

  getCameras(): CameraConfigs;
  getVisibleCameras(): CameraConfigs;

  getCameraIDs(): Set<string>;
  getVisibleCameraIDs(): Set<string>;
}

export class CameraManagerStore implements CameraManagerReadOnlyConfigStore {
  protected _allConfigs: Map<string, CameraConfig> = new Map();
  protected _visibleConfigs: Map<string, CameraConfig> = new Map();
  protected _enginesByCamera: Map<string, CameraManagerEngine> = new Map();
  protected _enginesByType: Map<Engine, CameraManagerEngine> = new Map();

  public addCamera(
    cameraID: string,
    cameraConfig: CameraConfig,
    engine: CameraManagerEngine,
  ): void {
    if (!cameraConfig.hide) {
      this._visibleConfigs.set(cameraID, cameraConfig);
    }
    this._allConfigs.set(cameraID, cameraConfig);
    this._enginesByCamera.set(cameraID, engine);
    this._enginesByType.set(engine.getEngineType(), engine);
  }

  public getCameraConfig(cameraID: string): CameraConfig | null {
    return this._allConfigs.get(cameraID) ?? null;
  }

  public hasCameraID(cameraID: string): boolean {
    return this._allConfigs.has(cameraID);
  }
  public hasVisibleCameraID(cameraID: string): boolean {
    return this._visibleConfigs.has(cameraID);
  }

  public getCameraCount(): number {
    return this._allConfigs.size;
  }
  public getVisibleCameraCount(): number {
    return this._visibleConfigs.size;
  }

  public getCameras(): CameraConfigs {
    return this._allConfigs;
  }
  public getVisibleCameras(): CameraConfigs {
    return this._visibleConfigs;
  }

  public getCameraIDs(): Set<string> {
    return new Set(this._allConfigs.keys());
  }
  public getVisibleCameraIDs(): Set<string> {
    return new Set(this._visibleConfigs.keys());
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
    return this._enginesByCamera.get(cameraID) ?? null;
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
    return [...this._enginesByType.values()];
  }
}
