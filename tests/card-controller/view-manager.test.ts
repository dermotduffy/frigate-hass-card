import { describe, expect, it, vi } from 'vitest';
import { QueryType } from '../../src/camera-manager/types';
import { ViewManager } from '../../src/card-controller/view-manager';
import { FrigateCardView } from '../../src/config/types';
import { executeMediaQueryForView } from '../../src/utils/media-to-view';
import { EventMediaQueries } from '../../src/view/media-queries';
import { MediaQueriesResults } from '../../src/view/media-queries-results';
import { View } from '../../src/view/view';
import {
  createCameraConfig,
  createCameraManager,
  createCapabilities,
  createCardAPI,
  createConfig,
  createHASS,
  createStore,
  createView,
  generateViewMediaArray,
} from '../test-utils';

vi.mock('../../src/utils/media-to-view');

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
    expect(manager.hasView()).toBeTruthy();
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
    const context = { live: { fetchThumbnails: false } };

    // Setting context with no existing view does nothing.
    manager.setViewWithMergedContext(context);
    expect(manager.getView()).toBeNull();

    const view = createView({
      view: 'live',
      camera: 'camera',
    });
    manager.setView(view);
    manager.setViewWithMergedContext(context);

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
    expect(manager.hasView()).toBeFalsy();
  });
});

describe('ViewManager.setViewDefault', () => {
  it('should set default view', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera',
          capabilities: createCapabilities({ live: true }),
        },
      ]),
    );

    const manager = new ViewManager(api);
    manager.setViewDefault();

    expect(manager.getView()?.view).toBe('live');
    expect(manager.getView()?.camera).toBe('camera');
  });

  it('should not set default view without config', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(null);

    const manager = new ViewManager(api);
    manager.setViewDefault();

    expect(manager.getView()).toBeNull();
  });

  it('should cycle camera when configured', () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera_1',
          capabilities: createCapabilities({ live: true }),
        },
        {
          cameraID: 'camera_2',
          capabilities: createCapabilities({ live: true }),
        },
      ]),
    );
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          default_cycle_camera: true,
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
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.kitchen',
          capabilities: createCapabilities({ live: true }),
        },
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({ live: true }),
        },
      ]),
    );
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
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
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.kitchen',
          capabilities: createCapabilities({ clips: true }),
        },
      ]),
    );
    vi.mocked(api.getCameraManager().getAggregateCameraCapabilities).mockReturnValue(
      createCapabilities({
        clips: true,
      }),
    );

    const manager = new ViewManager(api);
    manager.setViewByParameters({
      cameraID: 'camera.kitchen',
      viewName: 'clips',
    });

    expect(manager.getView()?.view).toBe('clips');
    expect(manager.getView()?.camera).toBe('camera.kitchen');
  });

  it('should set view by parameters using existing view if unspecified', () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.kitchen',
          capabilities: createCapabilities({ clips: true }),
        },
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({ clips: true }),
        },
      ]),
    );
    vi.mocked(api.getCameraManager().getAggregateCameraCapabilities).mockReturnValue(
      createCapabilities({
        clips: true,
      }),
    );
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

    const manager = new ViewManager(api);
    manager.setViewByParameters({
      cameraID: 'camera.kitchen',
      viewName: 'clips',
    });

    manager.setViewByParameters({
      cameraID: 'camera.office',
    });

    expect(manager.getView()?.view).toBe('clips');
    expect(manager.getView()?.camera).toBe('camera.office');
  });

  it('should set view by parameters using config as fallback', () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.kitchen',
          capabilities: createCapabilities({ live: true }),
        },
      ]),
    );
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

    const manager = new ViewManager(api);
    manager.setViewByParameters({
      cameraID: 'camera.kitchen',
      // No prior view, and no specified view. This could happen during query
      // string based initialization.
    });

    expect(manager.getView()?.view).toBe('live');
    expect(manager.getView()?.camera).toBe('camera.kitchen');
  });

  it('should not set view by parameters without config', () => {
    const manager = new ViewManager(createCardAPI());

    manager.setViewByParameters({
      viewName: 'live',
    });

    expect(manager.getView()).toBeNull();
  });

  describe('should handle unsupported view', () => {
    it('without camera without failsafe', () => {
      const api = createCardAPI();
      vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera.kitchen',
            capabilities: createCapabilities({ snapshots: false }),
          },
        ]),
      );
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      const manager = new ViewManager(api);
      manager.setViewByParameters({
        // Since no camera is specified, and no camera supports the capabilities
        // necessary for this view, the view will be null.
        viewName: 'snapshots',
      });

      expect(manager.getView()).toBeNull();
    });

    it('without camera with failsafe', () => {
      const api = createCardAPI();
      vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera.kitchen',
            capabilities: createCapabilities({ snapshots: false }),
          },
          {
            cameraID: 'camera.office',
            // No capabilities.
            capabilities: null,
          },
        ]),
      );
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

      const manager = new ViewManager(api);
      manager.setViewByParameters({
        // Since no camera is specified, and no camera supports the capabilities
        // necessary for this view, and since failSafe is specified, an error
        // will be shown.
        viewName: 'snapshots',
        failSafe: true,
      });

      expect(manager.getView()).toBeNull();
      expect(manager.hasView()).toBeFalsy();
      expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'No cameras support this view',
          context: {
            view: 'snapshots',
            cameras_capabilities: {
              'camera.kitchen': {
                'favorite-events': false,
                'favorite-recordings': false,
                clips: false,
                live: false,
                recordings: false,
                seek: false,
                snapshots: false,
              },
            },
          },
        }),
      );
    });

    it('with camera without failsafe', () => {
      const api = createCardAPI();
      vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera.kitchen',
            capabilities: createCapabilities({ snapshots: false }),
          },
        ]),
      );
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(api.getCameraManager().getAggregateCameraCapabilities).mockReturnValue(
        createCapabilities({
          snapshots: false,
        }),
      );

      const manager = new ViewManager(api);
      manager.setViewByParameters({
        cameraID: 'camera.kitchen',
        viewName: 'snapshots',
      });

      expect(manager.hasView()).toBeFalsy();
      expect(manager.getView()).toBeNull();
    });

    it('with camera with failsafe', () => {
      const api = createCardAPI();
      vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera.kitchen',
            capabilities: createCapabilities({ snapshots: false, live: true }),
          },
        ]),
      );
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(api.getCameraManager().getAggregateCameraCapabilities).mockReturnValue(
        createCapabilities({
          snapshots: false,
          live: true,
        }),
      );

      const manager = new ViewManager(api);
      manager.setViewByParameters({
        cameraID: 'camera.kitchen',
        viewName: 'snapshots',
        failSafe: true,
      });

      expect(manager.hasView()).toBeTruthy();
      expect(manager.getView()?.view).toBe('live');
    });

    it('with camera with failsafe when live unsupported', () => {
      const api = createCardAPI();
      vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera.kitchen',
            capabilities: createCapabilities({ snapshots: false, live: false }),
          },
        ]),
      );
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(api.getCameraManager().getAggregateCameraCapabilities).mockReturnValue(
        createCapabilities({
          snapshots: false,
          live: false,
        }),
      );

      const manager = new ViewManager(api);
      manager.setViewByParameters({
        cameraID: 'camera.kitchen',
        viewName: 'snapshots',
        failSafe: true,
      });

      expect(manager.hasView()).toBeFalsy();
      expect(manager.getView()).toBeNull();
      expect(api.getMessageManager().setMessageIfHigherPriority).toBeCalledWith(
        expect.objectContaining({
          type: 'error',
          message: 'The selected camera does not support this view',
          context: {
            view: 'snapshots',
            camera: 'camera.kitchen',
            camera_capabilities: {
              'favorite-events': false,
              'favorite-recordings': false,
              clips: false,
              live: false,
              recordings: false,
              seek: false,
              snapshots: false,
            },
          },
        }),
      );
    });
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
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera.kitchen',
            capabilities: createCapabilities({
              live: true,
              clips: true,
              recordings: true,
              snapshots: true,
            }),
          },
        ]),
      );
      vi.mocked(api.getCameraManager().getAggregateCameraCapabilities).mockReturnValue(
        createCapabilities({
          live: true,
          clips: true,
          recordings: true,
          snapshots: true,
        }),
      );

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
        cameraID: 'camera.kitchen',
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
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera.kitchen',
            capabilities: createCapabilities({
              live: true,
              clips: true,
              recordings: true,
              snapshots: true,
            }),
          },
        ]),
      );
      vi.mocked(api.getCameraManager().getAggregateCameraCapabilities).mockReturnValue(
        createCapabilities({
          live: true,
          clips: true,
          recordings: true,
          snapshots: true,
        }),
      );

      const manager = new ViewManager(api);

      manager.setViewByParameters({
        cameraID: 'camera.kitchen',
        viewName: viewName,
      });

      expect(manager.getView()?.displayMode).toBe('single');
    });
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
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.kitchen',
          capabilities: createCapabilities({
            clips: true,
            recordings: true,
            snapshots: true,
          }),
        },
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({
            clips: true,
            recordings: true,
            snapshots: true,
          }),
        },
      ]),
    );

    const hass = createHASS();
    vi.mocked(api.getHASSManager()).getHASS.mockReturnValue(hass);

    const mediaArray = generateViewMediaArray({ count: 5 });
    vi.mocked(executeMediaQueryForView).mockResolvedValue(
      new View({
        view: 'clip',
        camera: 'camera.kitchen',
        queryResults: new MediaQueriesResults({ results: mediaArray }),
      }),
    );

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

    expect(manager.getView()?.queryResults?.getResults()).toBe(mediaArray);
  });

  it('should set display mode to single and create new query', async () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.kitchen',
          capabilities: createCapabilities({
            clips: true,
            recordings: true,
            snapshots: true,
          }),
        },
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({
            clips: true,
            recordings: true,
            snapshots: true,
          }),
        },
      ]),
    );

    const hass = createHASS();
    vi.mocked(api.getHASSManager()).getHASS.mockReturnValue(hass);

    const mediaArray = generateViewMediaArray({ count: 5 });
    vi.mocked(executeMediaQueryForView).mockResolvedValue(
      new View({
        view: 'clip',
        camera: 'camera.kitchen',
        queryResults: new MediaQueriesResults({ results: mediaArray }),
      }),
    );

    const manager = new ViewManager(api);
    const query = new EventMediaQueries([
      {
        type: QueryType.Event,
        cameraIDs: new Set(['camera.kitchen', 'camera.office']),
        hasClip: true,
      },
    ]);

    manager.setView(
      createView({
        view: 'clip',
        camera: 'camera.office',
        query: query,
      }),
    );

    await manager.setViewWithNewDisplayMode('single');

    expect(manager.getView()?.queryResults?.getResults()).toBe(mediaArray);
  });

  it('should set display mode to single and handle failed new query', async () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.kitchen',
          capabilities: createCapabilities({
            clips: true,
            recordings: true,
            snapshots: true,
          }),
        },
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({
            clips: true,
            recordings: true,
            snapshots: true,
          }),
        },
      ]),
    );

    const manager = new ViewManager(api);
    const query = new EventMediaQueries([
      {
        type: QueryType.Event,
        cameraIDs: new Set(['camera.kitchen', 'camera.office']),
        hasClip: true,
      },
    ]);

    const originalView = createView({
      view: 'clip',
      camera: 'camera.office',
      query: query,
    });
    manager.setView(originalView);

    // Query execution fails / returns null.
    vi.mocked(executeMediaQueryForView).mockRejectedValue(null);

    await manager.setViewWithNewDisplayMode('single');

    expect(manager.getView()).toBe(originalView);
  });

  it('should set display mode and handle empty new query results', async () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.kitchen',
          capabilities: createCapabilities({
            clips: true,
            recordings: true,
            snapshots: true,
          }),
        },
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({
            clips: true,
            recordings: true,
            snapshots: true,
          }),
        },
      ]),
    );
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

    const manager = new ViewManager(api);

    const query = new EventMediaQueries([
      {
        type: QueryType.Event,
        cameraIDs: new Set(['camera.kitchen']),
        hasClip: true,
      },
    ]);
    const originalView = createView({
      view: 'clip',
      camera: 'camera.office',
      query: query,
    });
    manager.setView(originalView);

    await manager.setViewWithNewDisplayMode('grid');

    vi.mocked(executeMediaQueryForView).mockResolvedValue(null);

    // Empty queries will not be executed, so view will not be changed.
    expect(manager.getView()?.displayMode).toBeNull();
  });
});

describe('ViewManager.setViewWithSubstream', () => {
  it('should set new equal view with no dependencies', () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.kitchen',
        },
      ]),
    );
    const manager = new ViewManager(api);
    const view = createView({
      view: 'live',
      camera: 'camera',
    });

    manager.setView(view);
    manager.setViewWithSubstream();

    expect(manager.getView()?.camera).toBe(view.camera);
    expect(manager.getView()?.view).toBe(view.view);
    expect(manager.getView()?.context).toEqual(view.context);
  });

  it('should set new view with next substream', () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.kitchen',
          config: createCameraConfig({
            dependencies: {
              cameras: ['camera.kitchen_hd'],
            },
          }),
        },
        {
          cameraID: 'camera.kitchen_hd',
        },
      ]),
    );
    const manager = new ViewManager(api);
    const view = createView({
      view: 'live',
      camera: 'camera.kitchen',
    });

    manager.setView(view);
    manager.setViewWithSubstream();

    expect(manager.getView()?.context?.live?.overrides).toEqual(
      new Map([['camera.kitchen', 'camera.kitchen_hd']]),
    );
  });

  it('should set new view with next substream when view has invalid substream', () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.kitchen',
          config: createCameraConfig({
            dependencies: {
              cameras: ['camera.kitchen_hd'],
            },
          }),
        },
        {
          cameraID: 'camera.kitchen_hd',
        },
      ]),
    );
    const manager = new ViewManager(api);
    const view = createView({
      view: 'live',
      camera: 'camera.kitchen',
      context: {
        live: {
          overrides: new Map([['camera.kitchen', 'camera-that-does-not-exist']]),
        },
      },
    });

    manager.setView(view);
    manager.setViewWithSubstream();

    expect(manager.getView()?.context?.live?.overrides).toEqual(
      new Map([['camera.kitchen', 'camera.kitchen']]),
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
    ['live' as const, false],
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
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.kitchen',
          capabilities: createCapabilities({
            live: false,
            'favorite-events': false,
            'favorite-recordings': false,
            seek: false,
            clips: false,
            recordings: false,
            snapshots: false,
          }),
        },
      ]),
    );
    const manager = new ViewManager(api);

    expect(manager.isViewSupportedByCamera('camera', viewName)).toBe(expected);
  });
});
