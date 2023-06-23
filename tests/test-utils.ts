import { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManagerEngineFactory } from '../src/camera-manager/engine-factory';
import { FrigateEvent, FrigateRecording } from '../src/camera-manager/frigate/types';
import { CameraManager } from '../src/camera-manager/manager';
import { CameraManagerStore } from '../src/camera-manager/store';
import {
  CameraConfigs,
  CameraManagerCameraCapabilities,
  CameraManagerMediaCapabilities,
} from '../src/camera-manager/types';
import {
  CameraConfig,
  ExtendedHomeAssistant,
  FrigateCardCondition,
  FrigateCardConfig,
  MediaLoadedInfo,
  RawFrigateCardConfig,
  cameraConfigSchema,
  frigateCardConditionSchema,
  frigateCardConfigSchema,
} from '../src/types';
import { Entity } from '../src/utils/ha/entity-registry/types';
import { ViewMedia, ViewMediaType } from '../src/view/media';
import { View, ViewParameters } from '../src/view/view';

export const createCameraConfig = (config?: unknown): CameraConfig => {
  return cameraConfigSchema.parse(config ?? {});
};

export const createCondition = (
  condition?: Partial<FrigateCardCondition>,
): FrigateCardCondition => {
  return frigateCardConditionSchema.parse(condition ?? {});
};

export const createConfig = (config?: RawFrigateCardConfig): FrigateCardConfig => {
  return frigateCardConfigSchema.parse({
    type: 'frigate-hass-card',
    cameras: [],
    ...config,
  });
};

export const createHASS = (states?: HassEntities): ExtendedHomeAssistant => {
  const hass = mock<ExtendedHomeAssistant>();
  if (states) {
    hass.states = states;
  }
  return hass;
};

export const createRegistryEntity = (entity?: Partial<Entity>): Entity => {
  return {
    config_entry_id: entity?.config_entry_id ?? null,
    device_id: entity?.device_id ?? null,
    disabled_by: entity?.disabled_by ?? null,
    entity_id: entity?.entity_id ?? 'entity_id',
    hidden_by: entity?.hidden_by ?? null,
    platform: entity?.platform ?? 'platform',
    translation_key: entity?.translation_key ?? null,
    unique_id: entity?.unique_id ?? 'unique_id',
  };
};

export const createStateEntity = (entity?: Partial<HassEntity>): HassEntity => {
  return {
    entity_id: entity?.entity_id ?? 'entity_id',
    state: entity?.state ?? 'on',
    last_changed: entity?.last_changed ?? 'never',
    last_updated: entity?.last_updated ?? 'never',
    attributes: entity?.attributes ?? {},
    context: entity?.context ?? {
      id: 'id',
      parent_id: 'parent_id',
      user_id: 'user_id',
    },
  };
};

export const createFrigateEvent = (event?: Partial<FrigateEvent>) => {
  return {
    camera: 'camera',
    end_time: 1683397124,
    false_positive: false,
    has_clip: true,
    has_snapshot: true,
    id: '1683396875.643998-hmzrh5',
    label: 'person',
    sub_label: null,
    start_time: 1683395000,
    top_score: 0.841796875,
    zones: [],
    retain_indefinitely: false,
    ...event,
  };
};

export const createFrigateRecording = (recording?: Partial<FrigateRecording>) => {
  return {
    cameraID: 'cameraID',
    startTime: new Date('2023-04-29T14:00:00'),
    endTime: new Date('2023-04-29T14:59:59'),
    events: 42,
    ...recording,
  };
};

export const createView = (options?: Partial<ViewParameters>): View => {
  return new View({
    view: 'live',
    camera: 'camera',
    ...options,
  });
};

export const createCameraManager = (options?: {
  store?: CameraManagerStore;
  configs?: CameraConfigs;
}): CameraManager => {
  const cameraManager = new CameraManager(mock<CameraManagerEngineFactory>(), {});
  let store: CameraManagerStore | undefined = options?.store;
  if (!store) {
    store = mock<CameraManagerStore>();
    const configs = options?.configs ?? new Map([['camera', createCameraConfig()]]);
    vi.mocked(store.getCameras).mockReturnValue(configs);
    vi.mocked(store.getVisibleCameras).mockReturnValue(configs);
    vi.mocked(store.getCameraConfig).mockImplementation((cameraID): CameraConfig => {
      return configs.get(cameraID) ?? createCameraConfig();
    });
  }
  vi.mocked(cameraManager.getStore).mockReturnValue(store);
  return cameraManager;
};

export const createCameraCapabilities = (
  options?: Partial<CameraManagerCameraCapabilities>,
): CameraManagerCameraCapabilities => {
  return {
    canFavoriteEvents: false,
    canFavoriteRecordings: false,
    canSeek: false,
    supportsClips: false,
    supportsRecordings: false,
    supportsSnapshots: false,
    supportsTimeline: false,
    ...options,
  };
};

export const createMediaCapabilities = (
  options?: Partial<CameraManagerMediaCapabilities>,
): CameraManagerMediaCapabilities => {
  return {
    canFavorite: false,
    canDownload: false,
    ...options,
  };
};

export const createMediaLoadedInfo = (
  options?: Partial<MediaLoadedInfo>,
): MediaLoadedInfo => {
  return {
    width: 100,
    height: 100,
    ...options,
  };
};

// ViewMedia itself has no native way to set startTime and ID that aren't linked
// to an engine.
export class TestViewMedia extends ViewMedia {
  protected _id: string | null;
  protected _startTime: Date;

  constructor(
    id: string | null,
    startTime: Date,
    mediaType: ViewMediaType,
    cameraID: string,
  ) {
    super(mediaType, cameraID);
    this._id = id;
    this._startTime = startTime;
  }
  public getID(): string | null {
    return this._id;
  }
  public getStartTime(): Date | null {
    return this._startTime;
  }
}
