import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { QueryType } from '../../../src/camera-manager/types';
import { ViewFactory } from '../../../src/card-controller/view/factory';
import { QueryExecutor } from '../../../src/card-controller/view/query-executor';
import { ViewModifier } from '../../../src/card-controller/view/types';
import { FrigateCardView, ViewDisplayMode } from '../../../src/config/types';
import {
  EventMediaQueries,
  RecordingMediaQueries,
} from '../../../src/view/media-queries';
import { MediaQueriesResults } from '../../../src/view/media-queries-results';
import { View } from '../../../src/view/view';
import {
  createCameraManager,
  createCapabilities,
  createCardAPI,
  createConfig,
  createStore,
  createView,
} from '../../test-utils';
import { createPopulatedAPI } from './test-utils';

describe('getViewDefault', () => {
  it('should return null without config', () => {
    const factory = new ViewFactory(createCardAPI());
    expect(factory.getViewDefault()).toBeNull();
  });

  it('should return null if no cameras support view', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());

    // No cameras support live.
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({
            live: false,
          }),
        },
        {
          cameraID: 'camera.kitchen',
          capabilities: createCapabilities({
            live: false,
          }),
        },
      ]),
    );

    const factory = new ViewFactory(api);
    expect(factory.getViewDefault()).toBeNull();
  });

  it('should create view', () => {
    const factory = new ViewFactory(createPopulatedAPI());
    const view = factory.getViewDefault();

    expect(view?.is('live')).toBeTruthy();
    expect(view?.camera).toBe('camera.office');
  });

  it('should cycle camera when configured', () => {
    const api = createPopulatedAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          default_cycle_camera: true,
        },
      }),
    );

    const factory = new ViewFactory(api);

    let view = factory.getViewDefault();
    expect(view?.camera).toBe('camera.office');

    view = factory.getViewDefault({ baseView: view });
    expect(view?.camera).toBe('camera.kitchen');

    view = factory.getViewDefault({ baseView: view });
    expect(view?.camera).toBe('camera.office');

    // When a parameter is specified, it will not cycle.
    view = factory.getViewDefault({
      params: { camera: 'camera.office' },
      baseView: view,
    });
    expect(view?.camera).toBe('camera.office');
  });

  it('should use default camera when camera unspecified', () => {
    // Even though baseView has a camera, since default is called it should
    // use that camera.

    const factory = new ViewFactory(createPopulatedAPI());
    const baseView = createView({ camera: 'camera.kitchen' });
    const view = factory.getViewDefault({
      baseView: baseView,
    });

    expect(view?.is('live')).toBeTruthy();
    expect(view?.camera).toBe('camera.office');
  });

  it('should respect parameters', () => {
    const factory = new ViewFactory(createPopulatedAPI());
    const view = factory.getViewDefault({
      params: {
        camera: 'camera.kitchen',
      },
    });

    expect(view?.is('live')).toBeTruthy();
    expect(view?.camera).toBe('camera.kitchen');
  });
});

describe('getViewByParameters', () => {
  it('should get view by parameters specifying camera and view', () => {
    const api = createPopulatedAPI();
    vi.mocked(api.getCameraManager().getAggregateCameraCapabilities).mockReturnValue(
      createCapabilities({
        clips: true,
      }),
    );

    const factory = new ViewFactory(api);
    const view = factory.getViewByParameters({
      params: {
        camera: 'camera.kitchen',
        view: 'clips',
      },
    });

    expect(view?.is('clips')).toBeTruthy();
    expect(view?.camera).toBe('camera.kitchen');
  });

  it('should get view by parameters using base view if unspecified', () => {
    const api = createPopulatedAPI();
    vi.mocked(api.getCameraManager().getAggregateCameraCapabilities).mockReturnValue(
      createCapabilities({
        clips: true,
      }),
    );

    const factory = new ViewFactory(api);
    const baseView = new View({
      camera: 'camera.kitchen',
      view: 'clips',
    });

    const view = factory.getViewByParameters({
      baseView: baseView,
      params: {
        camera: 'camera.office',
      },
    });

    expect(view?.view).toBe('clips');
    expect(view?.camera).toBe('camera.office');
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

    const factory = new ViewFactory(api);
    const view = factory.getViewByParameters({
      params: {
        camera: 'camera.kitchen',

        // No prior view, and no specified view. This could happen during query
        // string based initialization.
      },
    });

    expect(view?.is('live')).toBeTruthy();
    expect(view?.camera).toBe('camera.kitchen');
  });

  it('should not set view by parameters without config', () => {
    const factory = new ViewFactory(createCardAPI());

    const view = factory.getViewByParameters({
      params: {
        view: 'live',
      },
    });

    expect(view).toBeNull();
  });

  it('should throw without camera and without failsafe', () => {
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

    const factory = new ViewFactory(api);
    expect(() =>
      factory.getViewByParameters({
        // Since no camera is specified, and no camera supports the capabilities
        // necessary for this view, the view will be null.
        params: {
          view: 'snapshots',
        },
      }),
    ).toThrowError(/No cameras support this view/);
  });

  describe('should handle unsupported view', () => {
    it('should throw without failsafe', () => {
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

      const factory = new ViewFactory(api);
      expect(() =>
        factory.getViewByParameters({
          params: {
            camera: 'camera.kitchen',
            view: 'snapshots',
          },
        }),
      ).toThrowError(/The selected camera does not support this view/);
    });

    it('should choose live view with failsafe', () => {
      const api = createCardAPI();
      vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
      vi.mocked(api.getCameraManager().getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera.kitchen',
            capabilities: createCapabilities({ live: true, snapshots: false }),
          },
        ]),
      );
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());
      vi.mocked(api.getCameraManager().getAggregateCameraCapabilities).mockReturnValue(
        createCapabilities({
          live: true,
          snapshots: false,
        }),
      );

      const factory = new ViewFactory(api);
      const view = factory.getViewByParameters({
        params: {
          camera: 'camera.kitchen',
          view: 'snapshots',
        },
        failSafe: true,
      });
      expect(view?.is('live')).toBeTruthy();
    });
  });

  it('should call modifiers', () => {
    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera.office',
          capabilities: createCapabilities({ live: true }),
        },
      ]),
    );
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

    const modifyCallback = vi.fn();
    class TestViewModifier implements ViewModifier {
      modify = modifyCallback;
    }

    const view = new View({
      view: 'live',
      camera: 'camera.office',
    });
    const factory = new ViewFactory(api);
    const modifiedView = factory.getViewByParameters({
      baseView: view,
      modifiers: [new TestViewModifier()],
    });

    expect(modifiedView?.is('live')).toBeTruthy();
    expect(modifiedView?.camera).toBe('camera.office');
    expect(view).not.toBe(modifiedView);
    expect(modifyCallback).toHaveBeenCalledWith(modifiedView);
  });

  describe('should get correct default display mode', () => {
    describe.each([['single' as const], ['grid' as const]])(
      '%s',
      (displayMode: ViewDisplayMode) => {
        it.each([
          ['media' as const],
          ['clip' as const],
          ['recording' as const],
          ['snapshot' as const],
          ['live' as const],
        ])('%s', (viewName: FrigateCardView) => {
          const api = createPopulatedAPI({
            media_viewer: {
              display: {
                mode: displayMode,
              },
            },
            live: {
              display: {
                mode: displayMode,
              },
            },
          });

          const factory = new ViewFactory(api);
          expect(
            factory.getViewByParameters({
              params: {
                view: viewName,
              },
            })?.displayMode,
          ).toBe(displayMode);
        });
      },
    );
  });
});

describe('getViewByParametersWithNewQuery', () => {
  it('should not execute query without config', async () => {
    const factory = new ViewFactory(createCardAPI());
    expect(await factory.getViewByParametersWithNewQuery()).toBeNull();
  });

  describe('with a live view', () => {
    beforeAll(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2024-07-21T13:22:06Z'));
    });

    afterAll(() => {
      vi.useRealTimers();
    });

    describe('should set timeline window', async () => {
      it('should set timeline to now for live views', async () => {
        const executor = mock<QueryExecutor>();
        const factory = new ViewFactory(createPopulatedAPI(), executor);
        const view = await factory.getViewByParametersWithNewQuery({
          params: {
            view: 'live',
          },
        });

        expect(view?.context).toEqual({
          timeline: {
            window: {
              start: new Date('2024-07-21T12:22:06.000Z'),
              end: new Date('2024-07-21T13:22:06.000Z'),
            },
          },
        });
      });

      it('should unset timeline for non-live views', async () => {
        const executor = mock<QueryExecutor>();
        const factory = new ViewFactory(createPopulatedAPI(), executor);
        const view = await factory.getViewByParametersWithNewQuery({
          baseView: createView({
            context: {
              timeline: {
                window: {
                  start: new Date('2024-07-21T12:22:06.000Z'),
                  end: new Date('2024-07-21T13:22:06.000Z'),
                },
              },
            },
          }),
          params: {
            view: 'clip',
          },
        });

        expect(view?.context).toEqual({ timeline: {} });
      });
    });

    it('should not fetch anything if configured for no thumbnails', async () => {
      const executor = mock<QueryExecutor>();
      const factory = new ViewFactory(
        createPopulatedAPI({
          live: {
            controls: {
              thumbnails: {
                mode: 'none' as const,
              },
            },
          },
        }),
        executor,
      );
      const view = await factory.getViewByParametersWithNewQuery({
        params: {
          view: 'live',
        },
      });

      expect(view?.query).toBeNull();
      expect(view?.queryResults).toBeNull();
      expect(executor.executeDefaultEventQuery).not.toHaveBeenCalled();
      expect(executor.executeDefaultRecordingQuery).not.toHaveBeenCalled();
    });

    it('should fetch events', async () => {
      const executor = mock<QueryExecutor>();
      const query = new EventMediaQueries();
      const queryResults = new MediaQueriesResults();

      executor.executeDefaultEventQuery.mockResolvedValue({
        query: query,
        queryResults: queryResults,
      });

      const factory = new ViewFactory(createPopulatedAPI(), executor);
      const view = await factory.getViewByParametersWithNewQuery({
        params: {
          view: 'live',
        },
      });

      expect(view?.query).toBe(query);
      expect(view?.queryResults).toBe(queryResults);
      expect(executor.executeDefaultEventQuery).toBeCalledWith({
        cameraID: 'camera.office',
        eventsMediaType: 'all',
        executorOptions: {
          useCache: false,
        },
      });
      expect(executor.executeDefaultRecordingQuery).not.toHaveBeenCalled();
    });

    it('should fetch recordings', async () => {
      const executor = mock<QueryExecutor>();
      const query = new RecordingMediaQueries();
      const queryResults = new MediaQueriesResults();

      executor.executeDefaultRecordingQuery.mockResolvedValue({
        query: query,
        queryResults: queryResults,
      });

      const factory = new ViewFactory(
        createPopulatedAPI({
          live: {
            controls: {
              thumbnails: {
                media_type: 'recordings',
              },
            },
          },
        }),
        executor,
      );
      const view = await factory.getViewByParametersWithNewQuery({
        params: {
          view: 'live',
        },
      });

      expect(view?.query).toBe(query);
      expect(view?.queryResults).toBe(queryResults);
      expect(executor.executeDefaultEventQuery).not.toBeCalled();
      expect(executor.executeDefaultRecordingQuery).toBeCalledWith({
        cameraID: 'camera.office',
        executorOptions: {
          useCache: false,
        },
      });
    });
  });

  describe('with a media view', () => {
    it('should do nothing with same camera', async () => {
      const executor = mock<QueryExecutor>();
      const factory = new ViewFactory(createPopulatedAPI(), executor);
      const baseView = new View({
        view: 'media',
        camera: 'camera.office',
      });
      const view = await factory.getViewByParametersWithNewQuery({
        baseView: baseView,
        params: {
          view: 'media',
        },
      });

      expect(view?.query).toBeNull();
      expect(view?.queryResults).toBeNull();
      expect(executor.executeDefaultEventQuery).not.toHaveBeenCalled();
      expect(executor.executeDefaultRecordingQuery).not.toHaveBeenCalled();
    });

    it('should fetch clips with different camera', async () => {
      const executor = mock<QueryExecutor>();
      const query = new EventMediaQueries();
      const queryResults = new MediaQueriesResults();

      executor.executeDefaultEventQuery.mockResolvedValue({
        query: query,
        queryResults: queryResults,
      });

      const factory = new ViewFactory(createPopulatedAPI(), executor);
      const baseView = new View({
        view: 'media',
        camera: 'camera.office',
      });
      const view = await factory.getViewByParametersWithNewQuery({
        baseView: baseView,
        params: {
          view: 'media',
          camera: 'camera.kitchen',
        },
      });

      expect(view?.query).toBe(query);
      expect(view?.queryResults).toBe(queryResults);
      expect(executor.executeDefaultEventQuery).toBeCalledWith({
        cameraID: 'camera.kitchen',
        eventsMediaType: 'clips',
        executorOptions: {
          useCache: false,
        },
      });
      expect(executor.executeDefaultRecordingQuery).not.toHaveBeenCalled();
    });
  });

  describe('with an events-based view', () => {
    it.each([
      ['clip' as const, 'clips' as const],
      ['clips' as const, 'clips' as const],
      ['snapshot' as const, 'snapshots' as const],
      ['snapshots' as const, 'snapshots' as const],
    ])(
      '%s',
      async (viewName: FrigateCardView, eventsMediaType: 'clips' | 'snapshots') => {
        const executor = mock<QueryExecutor>();
        const query = new EventMediaQueries();
        const queryResults = new MediaQueriesResults();

        executor.executeDefaultEventQuery.mockResolvedValue({
          query: query,
          queryResults: queryResults,
        });

        const factory = new ViewFactory(createPopulatedAPI(), executor);
        const view = await factory.getViewByParametersWithNewQuery({
          params: {
            view: viewName,
          },
        });

        expect(view?.query).toBe(query);
        expect(view?.queryResults).toBe(queryResults);
        expect(executor.executeDefaultEventQuery).toBeCalledWith({
          cameraID: 'camera.office',
          eventsMediaType: eventsMediaType,
          executorOptions: {
            useCache: false,
          },
        });
        expect(executor.executeDefaultRecordingQuery).not.toHaveBeenCalled();
      },
    );
  });

  describe('with an recordings-based view', () => {
    it.each([['recording' as const], ['recordings' as const]])(
      '%s',
      async (viewName: FrigateCardView) => {
        const executor = mock<QueryExecutor>();
        const query = new RecordingMediaQueries();
        const queryResults = new MediaQueriesResults();

        executor.executeDefaultRecordingQuery.mockResolvedValue({
          query: query,
          queryResults: queryResults,
        });

        const factory = new ViewFactory(createPopulatedAPI(), executor);
        const view = await factory.getViewByParametersWithNewQuery({
          params: {
            view: viewName,
          },
        });

        expect(view?.query).toBe(query);
        expect(view?.queryResults).toBe(queryResults);
        expect(executor.executeDefaultEventQuery).not.toHaveBeenCalled();
        expect(executor.executeDefaultRecordingQuery).toBeCalledWith({
          cameraID: 'camera.office',
          executorOptions: {
            useCache: false,
          },
        });
      },
    );
  });

  describe('with an media viewer view', () => {
    it('hould not fetch anything if configured for no thumbnails', async () => {
      const executor = mock<QueryExecutor>();
      const factory = new ViewFactory(
        createPopulatedAPI({
          media_viewer: {
            controls: {
              thumbnails: {
                mode: 'none' as const,
              },
            },
          },
        }),
        executor,
      );
      const view = await factory.getViewByParametersWithNewQuery({
        params: {
          view: 'clip',
        },
      });

      expect(view?.query).toBeNull();
      expect(view?.queryResults).toBeNull();
      expect(executor.executeDefaultEventQuery).not.toHaveBeenCalled();
      expect(executor.executeDefaultRecordingQuery).not.toHaveBeenCalled();
    });
  });

  describe('when changing to gallery from the media viewer', () => {
    it('should adopt query and results', async () => {
      const executor = mock<QueryExecutor>();
      const factory = new ViewFactory(createPopulatedAPI(), executor);

      const baseView = new View({
        view: 'media',
        camera: 'camera.office',
        query: new EventMediaQueries([
          {
            type: QueryType.Event,
            cameraIDs: new Set(['camera.office']),
            hasClip: true,
          },
        ]),
        queryResults: new MediaQueriesResults(),
      });

      const view = await factory.getViewByParametersWithNewQuery({
        baseView: baseView,
        params: {
          view: 'clips',
        },
      });

      expect(view?.query).toBe(baseView.query);
      expect(view?.queryResults).toBe(baseView.queryResults);
      expect(executor.executeDefaultEventQuery).not.toHaveBeenCalled();
      expect(executor.executeDefaultRecordingQuery).not.toHaveBeenCalled();
    });
  });

  describe('when set or remove seek time', () => {
    it('should set seek time when results are selected based on time', async () => {
      const now = new Date();
      const executor = mock<QueryExecutor>();
      const factory = new ViewFactory(createPopulatedAPI(), executor);

      const view = await factory.getViewByParametersWithNewQuery({
        params: {
          view: 'clips',
        },
        queryExecutorOptions: {
          selectResult: {
            time: {
              time: now,
            },
          },
        },
      });

      expect(view?.context).toEqual({
        mediaViewer: {
          seek: now,
        },
      });
    });

    it('should remove seek time when results are not selected based on time', async () => {
      const executor = mock<QueryExecutor>();
      const factory = new ViewFactory(createPopulatedAPI(), executor);

      const view = await factory.getViewByParametersWithNewQuery({
        baseView: new View({
          view: 'clips',
          camera: 'camera.office',
          context: {
            mediaViewer: {
              seek: new Date(),
            },
          },
        }),
        params: {
          view: 'clips',
        },
      });

      expect(view?.context?.mediaViewer?.seek).toBeUndefined();
    });
  });
});

describe('getViewDefaultWithNewQuery', () => {
  it('should fetch events', async () => {
    const executor = mock<QueryExecutor>();
    const query = new EventMediaQueries();
    const queryResults = new MediaQueriesResults();

    executor.executeDefaultEventQuery.mockResolvedValue({
      query: query,
      queryResults: queryResults,
    });

    const factory = new ViewFactory(createPopulatedAPI(), executor);
    const view = await factory.getViewDefaultWithNewQuery();

    expect(view?.query).toBe(query);
    expect(view?.queryResults).toBe(queryResults);
    expect(executor.executeDefaultEventQuery).toBeCalledWith({
      cameraID: 'camera.office',
      eventsMediaType: 'all',
      executorOptions: {
        useCache: false,
      },
    });
    expect(executor.executeDefaultRecordingQuery).not.toHaveBeenCalled();
  });
});

describe('getViewByParametersWithExistingQuery', () => {
  it('should not execute anything when query is absent', async () => {
    const executor = mock<QueryExecutor>();
    const factory = new ViewFactory(createPopulatedAPI(), executor);
    const view = await factory.getViewByParametersWithExistingQuery({
      params: {
        view: 'live',
        camera: 'camera.office',
      },
    });

    expect(view?.query).toBeNull();
    expect(view?.queryResults).toBeNull();
    expect(executor.executeDefaultEventQuery).not.toBeCalled();
    expect(executor.executeDefaultRecordingQuery).not.toBeCalled();
  });

  it('should set query results', async () => {
    const executor = mock<QueryExecutor>();
    const queryResults = new MediaQueriesResults();
    executor.execute.mockResolvedValue(queryResults);

    const factory = new ViewFactory(createPopulatedAPI(), executor);
    const query = new RecordingMediaQueries();
    const view = await factory.getViewByParametersWithExistingQuery({
      params: {
        view: 'live',
        camera: 'camera.office',
        query: query,
      },
    });

    expect(view?.query).toBe(query);
    expect(view?.queryResults).toBe(queryResults);
  });
});
