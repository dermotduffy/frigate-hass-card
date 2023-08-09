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
  QueryType,
} from '../src/camera-manager/types';
import {
  CameraConfig,
  ExtendedHomeAssistant,
  FrigateCardCondition,
  FrigateCardConfig,
  MediaLoadedInfo,
  PerformanceConfig,
  RawFrigateCardConfig,
  cameraConfigSchema,
  frigateCardConditionSchema,
  frigateCardConfigSchema,
  performanceConfigSchema,
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
    vi.mocked(store.getVisibleCameraIDs).mockReturnValue(new Set(configs.keys()));
    vi.mocked(store.getCameraConfig).mockImplementation((cameraID): CameraConfig => {
      return configs.get(cameraID) ?? createCameraConfig();
    });
  }
  vi.mocked(cameraManager.getStore).mockReturnValue(store);
  vi.mocked(cameraManager.generateDefaultEventQueries).mockReturnValue([
    {
      cameraIDs: new Set(['camera']),
      type: QueryType.Event,
    },
  ]);
  vi.mocked(cameraManager.generateDefaultRecordingQueries).mockReturnValue([
    {
      cameraIDs: new Set(['camera']),
      type: QueryType.Recording,
    },
  ]);

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

export const createPerformanceConfig = (config: unknown): PerformanceConfig => {
  return performanceConfigSchema.parse(config);
};

export const generateViewMediaArray = (options?: {
  cameraIDs?: string[];
  count?: number;
}): ViewMedia[] => {
  const media: ViewMedia[] = [];
  for (let i = 0; i < (options?.count ?? 100); ++i) {
    for (const cameraID of options?.cameraIDs ?? ['kitchen', 'office']) {
      media.push(new TestViewMedia({ cameraID: cameraID, id: `id-${cameraID}-${i}` }));
    }
  }
  return media;
};

// ViewMedia itself has no native way to set startTime and ID that aren't linked
// to an engine.
export class TestViewMedia extends ViewMedia {
  protected _id: string | null;
  protected _startTime: Date | null;
  protected _endTime: Date | null;
  protected _inProgress: boolean | null;

  constructor(options?: {
    id?: string | null;
    startTime?: Date;
    mediaType?: ViewMediaType;
    cameraID?: string;
    endTime?: Date;
    inProgress?: boolean;
  }) {
    super(options?.mediaType ?? 'clip', options?.cameraID ?? 'camera');
    this._id = options?.id !== undefined ? options.id : 'id';
    this._startTime = options?.startTime ?? null;
    this._endTime = options?.endTime ?? null;
    this._inProgress = options?.inProgress !== undefined ? options.inProgress : false;
  }
  public getID(): string | null {
    return this._id;
  }
  public getStartTime(): Date | null {
    return this._startTime;
  }
  public getEndTime(): Date | null {
    return this._endTime;
  }
  public inProgress(): boolean | null {
    return this._inProgress;
  }
}

export const createResizeObserverImplementation = (): (() => void) => {
  return () => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  });
};

export const createMutationObserverImplementation = (): (() => void) => {
  return () => ({
    observe: vi.fn(),
    disconnect: vi.fn(),
  });
};
