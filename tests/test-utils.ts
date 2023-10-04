import { HassEntities, HassEntity } from 'home-assistant-js-websocket';
import { vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
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
  FrigateCardCondition,
  FrigateCardConfig,
  PerformanceConfig,
  RawFrigateCardConfig,
  cameraConfigSchema,
  frigateCardConditionSchema,
  frigateCardConfigSchema,
  performanceConfigSchema,
} from '../src/config/types';
import { ExtendedHomeAssistant, MediaLoadedInfo } from '../src/types';
import { ActionsManager } from '../src/card-controller/actions-manager';
import { AutoUpdateManager } from '../src/card-controller/auto-update-manager';
import { AutomationsManager } from '../src/card-controller/automations-manager';
import { CameraURLManager } from '../src/card-controller/camera-url-manager';
import { CardElementManager } from '../src/card-controller/card-element-manager';
import { ConditionsManager } from '../src/card-controller/conditions-manager';
import { ConfigManager } from '../src/card-controller/config-manager';
import { CardController } from '../src/card-controller/controller';
import { DownloadManager } from '../src/card-controller/download-manager';
import { ExpandManager } from '../src/card-controller/expand-manager';
import { FullscreenManager } from '../src/card-controller/fullscreen-manager';
import { HASSManager } from '../src/card-controller/hass-manager';
import { InitializationManager } from '../src/card-controller/initialization-manager';
import { InteractionManager } from '../src/card-controller/interaction-manager';
import { MediaLoadedInfoManager } from '../src/card-controller/media-info-manager';
import { MediaPlayerManager } from '../src/card-controller/media-player-manager';
import { MessageManager } from '../src/card-controller/message-manager';
import { MicrophoneManager } from '../src/card-controller/microphone-manager';
import { QueryStringManager } from '../src/card-controller/query-string-manager';
import { StyleManager } from '../src/card-controller/style-manager';
import { TriggersManager } from '../src/card-controller/triggers-manager';
import { ViewManager } from '../src/card-controller/view-manager';
import { Entity } from '../src/utils/ha/entity-registry/types';
import { ViewMedia, ViewMediaType } from '../src/view/media';
import { MediaQueriesResults } from '../src/view/media-queries-results';
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

export const createViewWithMedia = (options?: Partial<ViewParameters>): View => {
  const media = generateViewMediaArray({ count: 5 });
  return createView({
    queryResults: new MediaQueriesResults({
      results: media,
      selectedIndex: 0,
    }),
    ...options,
  });
};

export const createCameraManager = (options?: {
  store?: CameraManagerStore;
  configs?: CameraConfigs;
}): CameraManager => {
  const cameraManager = new CameraManager(createCardAPI());
  let store: CameraManagerStore | undefined = options?.store;
  if (!store) {
    store = mock<CameraManagerStore>();
    const configs = options?.configs ?? new Map([['camera', createCameraConfig()]]);
    vi.mocked(store.getCameras).mockReturnValue(configs);
    vi.mocked(store.getVisibleCameras).mockReturnValue(configs);
    vi.mocked(store.getVisibleCameraIDs).mockReturnValue(new Set(configs.keys()));
    vi.mocked(store.hasVisibleCameraID).mockImplementation((cameraID: string) =>
      [...configs.keys()].includes(cameraID),
    );
    vi.mocked(store.getCameraConfig).mockImplementation(
      (cameraID): CameraConfig | null => {
        return configs.get(cameraID) ?? null;
      },
    );
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
  vi.mocked(cameraManager.getCameraCapabilities).mockReturnValue({
    canFavoriteEvents: true,
    canFavoriteRecordings: true,
    canSeek: true,
    supportsClips: true,
    supportsRecordings: true,
    supportsSnapshots: true,
    supportsTimeline: true,
  });

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
  protected _contentID: string | null;
  protected _title: string | null;
  protected _thumbnail: string | null;

  constructor(options?: {
    id?: string | null;
    startTime?: Date;
    mediaType?: ViewMediaType;
    cameraID?: string;
    endTime?: Date;
    inProgress?: boolean;
    contentID?: string;
    title?: string;
    thumbnail?: string;
  }) {
    super(options?.mediaType ?? 'clip', options?.cameraID ?? 'camera');
    this._id = options?.id !== undefined ? options.id : 'id';
    this._startTime = options?.startTime ?? null;
    this._endTime = options?.endTime ?? null;
    this._inProgress = options?.inProgress !== undefined ? options.inProgress : false;
    this._contentID = options?.contentID ?? null;
    this._title = options?.title ?? null;
    this._thumbnail = options?.thumbnail ?? null;
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
  public getContentID(): string | null {
    return this._contentID;
  }
  public getTitle(): string | null {
    return this._title;
  }
  public getThumbnail(): string | null {
    return this._thumbnail;
  }
}

export const ResizeObserverMock = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}));

export const IntersectionObserverMock = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}));

export const MutationObserverMock = vi.fn(() => ({
  disconnect: vi.fn(),
  observe: vi.fn(),
  unobserve: vi.fn(),
}));

export const requestAnimationFrameMock = (callback: FrameRequestCallback) => {
  callback(new Date().getTime());
  return 1;
};

export const createSlotHost = (options?: {
  slot?: HTMLSlotElement;
  children?: HTMLElement[];
}): HTMLElement => {
  const parent = document.createElement('div');
  parent.attachShadow({ mode: 'open' });

  if (options?.slot) {
    parent.shadowRoot?.append(options.slot);
  }
  if (options?.children) {
    // Children will automatically be slotted into the default slot when it is
    // created.
    parent.append(...options.children);
  }
  return parent;
};

export const createSlot = (): HTMLSlotElement => {
  return document.createElement('slot');
};

export const createParent = (options?: { children?: HTMLElement[] }): HTMLElement => {
  const parent = document.createElement('div');
  parent.append(...(options?.children ?? []));
  return parent;
};

export const createCardAPI = (): CardController => {
  const api = mock<CardController>();

  api.getActionsManager.mockReturnValue(mock<ActionsManager>());
  api.getAutomationsManager.mockReturnValue(mock<AutomationsManager>());
  api.getAutoUpdateManager.mockReturnValue(mock<AutoUpdateManager>());
  api.getCameraManager.mockReturnValue(mock<CameraManager>());
  api.getCameraURLManager.mockReturnValue(mock<CameraURLManager>());
  api.getCardElementManager.mockReturnValue(mock<CardElementManager>());
  api.getConditionsManager.mockReturnValue(mock<ConditionsManager>());
  api.getConfigManager.mockReturnValue(mock<ConfigManager>());
  api.getDownloadManager.mockReturnValue(mock<DownloadManager>());
  api.getExpandManager.mockReturnValue(mock<ExpandManager>());
  api.getFullscreenManager.mockReturnValue(mock<FullscreenManager>());
  api.getHASSManager.mockReturnValue(mock<HASSManager>());
  api.getInitializationManager.mockReturnValue(mock<InitializationManager>());
  api.getInteractionManager.mockReturnValue(mock<InteractionManager>());
  api.getMediaLoadedInfoManager.mockReturnValue(mock<MediaLoadedInfoManager>());
  api.getMediaPlayerManager.mockReturnValue(mock<MediaPlayerManager>());
  api.getMessageManager.mockReturnValue(mock<MessageManager>());
  api.getMicrophoneManager.mockReturnValue(mock<MicrophoneManager>());
  api.getQueryStringManager.mockReturnValue(mock<QueryStringManager>());
  api.getStyleManager.mockReturnValue(mock<StyleManager>());
  api.getTriggersManager.mockReturnValue(mock<TriggersManager>());
  api.getViewManager.mockReturnValue(mock<ViewManager>());

  return api;
};
