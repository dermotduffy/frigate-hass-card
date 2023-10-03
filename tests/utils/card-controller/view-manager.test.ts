import { describe, expect, it, vi } from 'vitest';
import { QueryType } from '../../../src/camera-manager/types';
import { FrigateCardView } from '../../../src/types';
import { getAllDependentCameras } from '../../../src/utils/camera';
import { ViewManager } from '../../../src/utils/card-controller/view-manager';
import { EventMediaQueries } from '../../../src/view/media-queries';
import {
  createCameraManager,
  createCardAPI,
  createConfig,
  createHASS,
  createView,
  generateViewMediaArray,
} from '../../test-utils';

vi.mock('../../../src/camera-manager/manager.js');
vi.mock('../../../src/utils/camera');

describe('ViewManager.setView', () => {
  it('should set view', () => {
    const api = createCardAPI();
    const manager = new ViewManager(api);

    const view = createView({
      view: 'live',
      camera: 'camera',
      displayMode: 'grid',
    });
    manager.setView(view);

    expect(manager.getView()).toBe(view);
    expect(api.getMediaLoadedInfoManager().clear).toBeCalled();
    expect(api.getCardElementManager().scrollReset).toBeCalled();
    expect(api.getMessageManager().reset).toBeCalled();
    expect(api.getStyleManager().setExpandedMode).toBeCalled();
    expect(api.getConditionsManager()?.setState).toBeCalledWith({
      view: 'live',
      camera: 'camera',
      displayMode: 'grid',
    });
    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should set view with minor changes without media clearing or scroll', () => {
    const api = createCardAPI();
    const manager = new ViewManager(api);

    const view_1 = createView({
      view: 'live',
      camera: 'camera',
    });
    manager.setView(view_1);

    vi.mocked(api.getMediaLoadedInfoManager().clear).mockClear();
    vi.mocked(api.getCardElementManager().scrollReset).mockClear();

    const view_2 = createView({
      view: 'live',
      camera: 'camera',
      displayMode: 'single',
    });

    manager.setView(view_2);

    expect(manager.getView()).toBe(view_2);

    // The new view is neither a major media change, nor a different view name,
    // so media clearing and scrolling should not happen.
    expect(api.getMediaLoadedInfoManager().clear).not.toBeCalled();
    expect(api.getCardElementManager().scrollReset).not.toBeCalled();
  });

  it('should set view with new context', () => {
    const api = createCardAPI();
    const manager = new ViewManager(api);
    const context = { thumbnails: { fetch: false } };

    // Setting context with no existing view does nothing.
    manager.setViewWithNewContext(context);
    expect(manager.getView()).toBeNull();

    const view = createView({
      view: 'live',
      camera: 'camera',
    });
    manager.setView(view);
    manager.setViewWithNewContext(context);

    expect(manager.getView()?.camera).toBe('camera');
    expect(manager.getView()?.view).toBe('live');
    expect(manager.getView()?.context).toEqual(context);
  });
});

describe('ViewManager.reset', () => {
  it('should reset', () => {
    const manager = new ViewManager(createCardAPI());

    const view = createView();
    manager.setView(view);
    manager.reset();

    expect(manager.getView()).toBeNull();
  });
});

describe('ViewManager.setViewDefault', () => {
  it('should set default view', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());

    const manager = new ViewManager(api);
    manager.setViewDefault();

    expect(manager.getView()?.view).toBe('live');
    expect(manager.getView()?.camera).toBe('camera');
    expect(api.getAutoUpdateManager().startDefaultViewTimer).toBeCalled();
  });

  it('should not set default view without config', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(null);

    const manager = new ViewManager(api);
    manager.setViewDefault();

    expect(manager.getView()).toBeNull();
    expect(api.getAutoUpdateManager().startDefaultViewTimer).not.toBeCalled();
  });

  it('should cycle camera when configured', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore().getVisibleCameraIDs).mockReturnValue(
      new Set(['camera_1', 'camera_2']),
    );
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          update_cycle_camera: true,
        },
      }),
    );
    const manager = new ViewManager(api);

    manager.setViewDefault();
    expect(manager.getView()?.camera).toBe('camera_1');

    manager.setViewDefault();
    expect(manager.getView()?.camera).toBe('camera_2');

    manager.setViewDefault();
    expect(manager.getView()?.camera).toBe('camera_1');

    // When a parameter is specified, it will not cycle.
    manager.setViewDefault({ cameraID: 'camera_1' });
    expect(manager.getView()?.camera).toBe('camera_1');
  });

  it('should respect parameters', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore().getVisibleCameraIDs).mockReturnValue(
      new Set(['camera.kitchen', 'camera.office']),
    );
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
    vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);
    const manager = new ViewManager(api);

    manager.setViewDefault({
      cameraID: 'camera.office',
      substream: 'camera.office_hd',
    });
    expect(manager.getView()?.view).toBe('live');
    expect(manager.getView()?.camera).toBe('camera.office');
    expect(manager.getView()?.context?.live?.overrides).toEqual(
      new Map([['camera.office', 'camera.office_hd']]),
    );
  });
});

describe('ViewManager.setViewByParameters', () => {
  it('should set view by parameters specifying camera and view', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());

    const manager = new ViewManager(api);
    manager.setViewByParameters({
      cameraID: 'camera',
      viewName: 'clips',
    });

    expect(manager.getView()?.view).toBe('clips');
    expect(manager.getView()?.camera).toBe('camera');
  });

  it('should set view by parameters using existing view if unspecified', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore().getVisibleCameraIDs).mockReturnValue(
      new Set(['camera_1', 'camera_2']),
    );

    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
    vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);

    const manager = new ViewManager(api);
    manager.setViewByParameters({
      cameraID: 'camera_1',
      viewName: 'clips',
    });

    manager.setViewByParameters({
      cameraID: 'camera_2',
    });

    expect(manager.getView()?.view).toBe('clips');
    expect(manager.getView()?.camera).toBe('camera_2');
  });

  it('should set view by parameters using config as fallback', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore().getVisibleCameraIDs).mockReturnValue(
      new Set(['camera_1', 'camera_2']),
    );

    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
    vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);

    const manager = new ViewManager(api);
    manager.setViewByParameters({
      cameraID: 'camera_1',
      // No prior view, and no specified view. This could happen during query
      // string based initialization.
    });

    expect(manager.getView()?.view).toBe('live');
    expect(manager.getView()?.camera).toBe('camera_1');
  });

  it('should not set view by parameters without config', () => {
    const manager = new ViewManager(createCardAPI());

    manager.setViewByParameters({
      viewName: 'live',
    });

    expect(manager.getView()).toBeNull();
  });

  it('should not set view by parameters without visible cameras', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore().getVisibleCameraIDs).mockReturnValue(new Set());

    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
    vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);

    const manager = new ViewManager(api);
    manager.setViewByParameters({
      viewName: 'live',
    });

    expect(manager.getView()).toBeNull();
  });

  describe('should set view by parameters and respect display mode in config for view', () => {
    it.each([
      ['media' as const],
      ['clip' as const],
      ['recording' as const],
      ['snapshot' as const],
      ['live' as const],
    ])('%s', (viewName: FrigateCardView) => {
      const api = createCardAPI();
      vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
      vi.mocked(api.getConfigManager()).getConfig.mockReturnValue(
        createConfig({
          media_viewer: {
            display: {
              mode: 'grid',
            },
          },
          live: {
            display: {
              mode: 'grid',
            },
          },
        }),
      );
      const manager = new ViewManager(api);

      manager.setViewByParameters({
        cameraID: 'camera',
        viewName: viewName,
      });

      expect(manager.getView()?.displayMode).toBe('grid');
    });
  });

  describe('should set view by parameters and leave display mode unset for view', () => {
    it.each([
      ['media' as const],
      ['clip' as const],
      ['recording' as const],
      ['snapshot' as const],
      ['live' as const],
    ])('%s', (viewName: FrigateCardView) => {
      const api = createCardAPI();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
      const manager = new ViewManager(api);

      manager.setViewByParameters({
        cameraID: 'camera',
        viewName: viewName,
      });

      expect(manager.getView()?.displayMode).toBe('single');
    });
  });

  it('should set view by parameters using config as fallback', () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore().getVisibleCameraIDs).mockReturnValue(
      new Set(['camera_1', 'camera_2']),
    );

    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
    vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);
    vi.mocked(getAllDependentCameras).mockReturnValue(
      new Set(['camera_1', 'camera_1_hd']),
    );

    const manager = new ViewManager(api);
    manager.setViewByParameters({
      cameraID: 'camera_1',
      viewName: 'live',
      substream: 'camera_1_hd',
    });

    expect(manager.getView()?.view).toBe('live');
    expect(manager.getView()?.camera).toBe('camera_1');
    expect(manager.getView()?.context?.live?.overrides).toEqual(
      new Map([['camera_1', 'camera_1_hd']]),
    );
  });
});

// @vitest-environment jsdom
describe('ViewManager.setViewWithNewDisplayMode', () => {
  it('should set display mode', async () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    const manager = new ViewManager(api);
    manager.setView(createView());

    await manager.setViewWithNewDisplayMode('grid');

    expect(manager.getView()?.displayMode).toBe('grid');
  });

  it('should not set display mode without view', async () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    const manager = new ViewManager(api);

    manager.setViewWithNewDisplayMode('grid');

    expect(manager.getView()).toBeNull();
  });

  it('should set display mode to grid and create new query', async () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore().getVisibleCameraCount).mockReturnValue(2);
    vi.mocked(cameraManager.getStore().getVisibleCameraIDs).mockReturnValue(
      new Set(['camera_1', 'camera_2']),
    );

    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);

    const hass = createHASS();
    vi.mocked(api.getHASSManager()).getHASS.mockReturnValue(hass);

    const media = generateViewMediaArray({ count: 5 });
    vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue(media);

    const manager = new ViewManager(api);
    const query = new EventMediaQueries([
      { type: QueryType.Event, cameraIDs: new Set(['camera_1']), hasClip: true },
    ]);

    manager.setView(
      createView({
        camera: 'camera_1',
        view: 'clip',
        query: query,
      }),
    );

    await manager.setViewWithNewDisplayMode('grid');

    expect(manager.getView()?.queryResults?.getResults()).toBe(media);
    expect(cameraManager.executeMediaQueries).toBeCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'event-query',
          cameraIDs: new Set(['camera_1', 'camera_2']),
          hasClip: true,
        }),
      ]),
    );
  });

  it('should set display mode to single and create new query', async () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore().getVisibleCameraCount).mockReturnValue(2);
    vi.mocked(cameraManager.getStore().getVisibleCameraIDs).mockReturnValue(
      new Set(['camera_1', 'camera_2']),
    );

    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);

    const hass = createHASS();
    vi.mocked(api.getHASSManager()).getHASS.mockReturnValue(hass);

    const media = generateViewMediaArray({ count: 5 });
    vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue(media);

    const manager = new ViewManager(api);
    const query = new EventMediaQueries([
      {
        type: QueryType.Event,
        cameraIDs: new Set(['camera_1', 'camera_2']),
        hasClip: true,
      },
    ]);

    manager.setView(
      createView({
        view: 'clip',
        camera: 'camera_2',
        query: query,
      }),
    );

    await manager.setViewWithNewDisplayMode('single');

    expect(manager.getView()?.queryResults?.getResults()).toBe(media);
    expect(cameraManager.executeMediaQueries).toBeCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          type: 'event-query',
          cameraIDs: new Set(['camera_2']),
          hasClip: true,
        }),
      ]),
    );
  });

  it('should set display mode to single and handle failed new query', async () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore().getVisibleCameraCount).mockReturnValue(2);
    vi.mocked(cameraManager.getStore().getVisibleCameraIDs).mockReturnValue(
      new Set(['camera_1', 'camera_2']),
    );

    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);

    const manager = new ViewManager(api);
    const query = new EventMediaQueries([
      {
        type: QueryType.Event,
        cameraIDs: new Set(['camera_1', 'camera_2']),
        hasClip: true,
      },
    ]);

    const originalView = createView({
      view: 'clip',
      camera: 'camera_2',
      query: query,
    });
    manager.setView(originalView);

    // Query execution fails / returns null.
    vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue(null);

    await manager.setViewWithNewDisplayMode('single');

    expect(manager.getView()).toBe(originalView);
  });

  it('should set display mode and handle empty new query results', async () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore().getVisibleCameraCount).mockReturnValue(2);
    vi.mocked(cameraManager.getStore().getVisibleCameraIDs).mockReturnValue(
      new Set(['camera_1', 'camera_2']),
    );

    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

    const manager = new ViewManager(api);

    const query = new EventMediaQueries([
      {
        type: QueryType.Event,
        cameraIDs: new Set(['camera_1']),
        hasClip: true,
      },
    ]);
    const originalView = createView({
      view: 'clip',
      camera: 'camera_2',
      query: query,
    });
    manager.setView(originalView);

    await manager.setViewWithNewDisplayMode('grid');

    vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue(null);

    // Empty queries will not be executed, so view will not be changed.
    expect(manager.getView()?.displayMode).toBeNull();
  });
});

describe('ViewManager.setViewWithSubstream', () => {
  it('should set new equal view with no dependencies', () => {
    const view = createView({
      view: 'live',
      camera: 'camera',
    });
    vi.mocked(getAllDependentCameras).mockReturnValue(new Set(['camera']));

    const manager = new ViewManager(createCardAPI());
    manager.setView(view);
    manager.setViewWithSubstream();

    expect(manager.getView()?.camera).toBe(view.camera);
    expect(manager.getView()?.view).toBe(view.view);
    expect(manager.getView()?.context).toEqual(view.context);
  });

  it('should set new view with next substream', () => {
    const view = createView({
      view: 'live',
      camera: 'camera',
    });
    vi.mocked(getAllDependentCameras).mockReturnValue(new Set(['camera', 'camera2']));

    const manager = new ViewManager(createCardAPI());
    manager.setView(view);
    manager.setViewWithSubstream();

    expect(manager.getView()?.context?.live?.overrides).toEqual(
      new Map([['camera', 'camera2']]),
    );
  });

  it('should set new view with next substream when view has invalid substream', () => {
    const view = createView({
      view: 'live',
      camera: 'camera',
      context: {
        live: {
          overrides: new Map([['camera', 'camera-that-does-not-exist']]),
        },
      },
    });
    vi.mocked(getAllDependentCameras).mockReturnValue(new Set(['camera', 'camera2']));

    const manager = new ViewManager(createCardAPI());
    manager.setView(view);
    manager.setViewWithSubstream();

    expect(manager.getView()?.context?.live?.overrides).toEqual(
      new Map([['camera', 'camera']]),
    );
  });

  it('should set new view with selected substream', () => {
    const view = createView({
      view: 'live',
      camera: 'camera',
    });

    const manager = new ViewManager(createCardAPI());
    manager.setView(view);
    manager.setViewWithSubstream('substream');

    expect(manager.getView()?.context?.live?.overrides).toEqual(
      new Map([['camera', 'substream']]),
    );
  });

  it('should not set view with next substream without an existing view', () => {
    const manager = new ViewManager(createCardAPI());
    manager.setViewWithSubstream();
    expect(manager.getView()).toBeNull();
  });

  it('should not set view with selected substream without an existing view', () => {
    const manager = new ViewManager(createCardAPI());
    manager.setViewWithSubstream('substream');
    expect(manager.getView()).toBeNull();
  });

  it('should not set view without substream without an existing view', () => {
    const manager = new ViewManager(createCardAPI());
    manager.setViewWithoutSubstream();
    expect(manager.getView()).toBeNull();
  });

  it('should set new view without substream', () => {
    const view = createView({
      view: 'live',
      camera: 'camera',
      context: {
        live: {
          overrides: new Map([['camera', 'camera']]),
        },
      },
    });

    const manager = new ViewManager(createCardAPI());
    manager.setView(view);
    manager.setViewWithoutSubstream();

    expect(manager.getView()?.context?.live?.overrides).toEqual(new Map());
  });

  it('should set new view without substream', () => {
    const view = createView({
      view: 'live',
      camera: 'camera',
      context: {
        live: {
          overrides: new Map([['camera-2', 'camera-3']]),
        },
      },
    });

    const manager = new ViewManager(createCardAPI());
    manager.setView(view);
    manager.setViewWithoutSubstream();

    expect(manager.getView()?.context?.live?.overrides).toEqual(
      view.context?.live?.overrides,
    );
  });
});

describe('ViewManager.isViewSupportedByCamera', () => {
  it.each([
    ['live' as const, true],
    ['image' as const, true],
    ['diagnostics' as const, true],
    ['clip' as const, false],
    ['clips' as const, false],
    ['snapshot' as const, false],
    ['snapshots' as const, false],
    ['recording' as const, false],
    ['recordings' as const, false],
    ['timeline' as const, false],
    ['media' as const, false],
  ])('%s', (viewName: FrigateCardView, expected: boolean) => {
    const api = createCardAPI();
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getCameraCapabilities).mockReturnValue({
      canFavoriteEvents: false,
      canFavoriteRecordings: false,
      canSeek: false,
      supportsClips: false,
      supportsRecordings: false,
      supportsSnapshots: false,
      supportsTimeline: false,
    });
    vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);
    const manager = new ViewManager(api);

    expect(manager.isViewSupportedByCamera('camera', viewName)).toBe(expected);
  });
});