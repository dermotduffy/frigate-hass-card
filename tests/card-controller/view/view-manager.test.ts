import { ViewContext } from 'view';
import { describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { ViewFactory } from '../../../src/card-controller/view/factory';
import { ViewManager } from '../../../src/card-controller/view/view-manager';
import { FrigateCardView } from '../../../src/config/types';
import { ViewMedia } from '../../../src/view/media';
import { MediaQueriesResults } from '../../../src/view/media-queries-results';
import {
  createCameraManager,
  createCapabilities,
  createCardAPI,
  createStore,
  createView,
} from '../../test-utils';

describe('should act correctly when view is set', () => {
  it('basic view', () => {
    const view = createView({
      view: 'live',
      camera: 'camera',
      displayMode: 'grid',
    });

    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(view);

    const api = createCardAPI();
    const manager = new ViewManager(api, factory);

    manager.setViewDefault();

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

  it('view with minor changes without media clearing or scroll', () => {
    const view_1 = createView({
      view: 'live',
      camera: 'camera',
    });
    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(view_1);

    const api = createCardAPI();
    const manager = new ViewManager(api, factory);

    manager.setViewDefault();

    vi.mocked(api.getMediaLoadedInfoManager().clear).mockClear();
    vi.mocked(api.getCardElementManager().scrollReset).mockClear();

    const view_2 = createView({
      view: 'live',
      camera: 'camera',
      displayMode: 'single',
    });
    factory.getViewDefault.mockReturnValue(view_2);

    manager.setViewDefault();

    expect(manager.getView()).toBe(view_2);

    // The new view is neither a major media change, nor a different view name,
    // so media clearing and scrolling should not happen.
    expect(api.getMediaLoadedInfoManager().clear).not.toBeCalled();
    expect(api.getCardElementManager().scrollReset).not.toBeCalled();
  });
});

it('setViewWithMergedContext', () => {
  const api = createCardAPI();
  const factory = mock<ViewFactory>();

  const manager = new ViewManager(api, factory);
  const context: ViewContext = { timeline: {} };

  // Setting context with no existing view does nothing.
  manager.setViewWithMergedContext(context);
  expect(manager.getView()).toBeNull();

  const view = createView({
    view: 'live',
    camera: 'camera',
  });
  factory.getViewDefault.mockReturnValue(view);
  manager.setViewDefault();
  manager.setViewWithMergedContext(context);

  expect(manager.getView()?.camera).toBe('camera');
  expect(manager.getView()?.view).toBe('live');
  expect(manager.getView()?.context).toEqual(context);
});

it('getEpoch', () => {
  const factory = mock<ViewFactory>();
  const manager = new ViewManager(createCardAPI(), factory);
  expect(manager.getEpoch()).toBeTruthy();
  expect(manager.getEpoch().manager).toBe(manager);
});

it('reset', () => {
  const factory = mock<ViewFactory>();
  const manager = new ViewManager(createCardAPI(), factory);

  manager.reset();
  expect(manager.getView()).toBeNull();
  expect(manager.hasView()).toBeFalsy();

  factory.getViewDefault.mockReturnValue(createView());
  manager.setViewDefault();

  expect(manager.getView()).not.toBeNull();
  expect(manager.hasView()).toBeTruthy();

  manager.reset();

  expect(manager.getView()).toBeNull();
  expect(manager.hasView()).toBeFalsy();
});

it('setViewDefault', () => {
  const factory = mock<ViewFactory>();
  factory.getViewDefault.mockReturnValue(createView());

  const manager = new ViewManager(createCardAPI(), factory);
  manager.setViewDefault();

  expect(manager.getView()?.view).toBe('live');
  expect(manager.getView()?.camera).toBe('camera');
});

it('setViewByParameters', () => {
  const factory = mock<ViewFactory>();
  factory.getViewByParameters.mockReturnValue(createView());

  const manager = new ViewManager(createCardAPI(), factory);
  manager.setViewByParameters();

  expect(manager.getView()?.view).toBe('live');
  expect(manager.getView()?.camera).toBe('camera');
});

it('setViewDefaultWithNewQuery', async () => {
  const factory = mock<ViewFactory>();
  factory.getViewDefaultWithNewQuery.mockResolvedValue(createView());

  const manager = new ViewManager(createCardAPI(), factory);
  await manager.setViewDefaultWithNewQuery();

  expect(manager.getView()?.view).toBe('live');
  expect(manager.getView()?.camera).toBe('camera');
});

it('setViewByParametersWithNewQuery', async () => {
  const factory = mock<ViewFactory>();
  factory.getViewByParametersWithNewQuery.mockResolvedValue(createView());

  const manager = new ViewManager(createCardAPI(), factory);
  await manager.setViewByParametersWithNewQuery();

  expect(manager.getView()?.view).toBe('live');
  expect(manager.getView()?.camera).toBe('camera');
});

it('setViewByParametersWithExistingQuery', async () => {
  const factory = mock<ViewFactory>();
  factory.getViewByParametersWithExistingQuery.mockResolvedValue(createView());

  const manager = new ViewManager(createCardAPI(), factory);
  await manager.setViewByParametersWithExistingQuery();

  expect(manager.getView()?.view).toBe('live');
  expect(manager.getView()?.camera).toBe('camera');
});

describe('should handle exceptions', () => {
  it('non-async', () => {
    const factory = mock<ViewFactory>();
    const error = new Error();
    factory.getViewDefault.mockImplementation(() => {
      throw error;
    });

    const api = createCardAPI();
    const manager = new ViewManager(api, factory);
    manager.setViewDefault();

    expect(manager.hasView()).toBeFalsy();
    expect(api.getMessageManager().setErrorIfHigherPriority).toBeCalledWith(error);
  });

  it('async', async () => {
    const factory = mock<ViewFactory>();
    const error = new Error();
    factory.getViewByParametersWithNewQuery.mockRejectedValue(error);

    const api = createCardAPI();
    const manager = new ViewManager(api, factory);
    await manager.setViewByParametersWithNewQuery();

    expect(manager.hasView()).toBeFalsy();
    expect(api.getMessageManager().setErrorIfHigherPriority).toBeCalledWith(error);
  });
});

describe('isViewSupportedByCamera', () => {
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

describe('hasMajorMediaChange', () => {
  it('should consider undefined views as major', () => {
    const manager = new ViewManager(createCardAPI());

    expect(manager.hasMajorMediaChange(undefined)).toBeFalsy();
    expect(manager.hasMajorMediaChange(createView())).toBeTruthy();
    expect(manager.hasMajorMediaChange()).toBeFalsy();
  });

  it('should consider view change as major', () => {
    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(createView({ view: 'live' }));

    const manager = new ViewManager(createCardAPI(), factory);
    manager.setViewDefault();

    expect(manager.hasMajorMediaChange(createView({ view: 'clips' }))).toBeTruthy();
  });

  it('should consider camera change as major', () => {
    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(createView({ camera: 'camera-1' }));

    const manager = new ViewManager(createCardAPI(), factory);
    manager.setViewDefault();

    expect(manager.hasMajorMediaChange(createView({ camera: 'camera-2' }))).toBeTruthy();
  });

  it('should consider live substream change as major in live view', () => {
    const overrides_1: Map<string, string> = new Map();
    overrides_1.set('camera', 'camera-2');

    const overrides_2: Map<string, string> = new Map();
    overrides_2.set('camera', 'camera-3');

    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(
      createView({ context: { live: { overrides: overrides_1 } } }),
    );

    const manager = new ViewManager(createCardAPI(), factory);
    manager.setViewDefault();

    expect(
      manager.hasMajorMediaChange(
        createView({ context: { live: { overrides: overrides_2 } } }),
      ),
    ).toBeTruthy();
  });

  it('should not consider live substream change as major in other view', () => {
    const overrides_1: Map<string, string> = new Map();
    overrides_1.set('camera', 'camera-2');

    const overrides_2: Map<string, string> = new Map();
    overrides_2.set('camera', 'camera-3');

    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(
      createView({ view: 'clips', context: { live: { overrides: overrides_1 } } }),
    );

    const manager = new ViewManager(createCardAPI(), factory);
    manager.setViewDefault();

    expect(
      manager.hasMajorMediaChange(
        createView({ view: 'clips', context: { live: { overrides: overrides_2 } } }),
      ),
    ).toBeFalsy();
  });

  it('should consider result change as major in other view', () => {
    const media = [new ViewMedia('clip', 'camera-1'), new ViewMedia('clip', 'camera-2')];
    const queryResults_1 = new MediaQueriesResults({ results: media, selectedIndex: 0 });
    const queryResults_2 = new MediaQueriesResults({ results: media, selectedIndex: 1 });

    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(
      createView({ view: 'media', queryResults: queryResults_1 }),
    );

    const manager = new ViewManager(createCardAPI(), factory);
    manager.setViewDefault();

    expect(
      manager.hasMajorMediaChange(
        createView({ view: 'media', queryResults: queryResults_2 }),
      ),
    ).toBeTruthy();
  });

  it('should not consider selected result change as major in live view', () => {
    const media = [new ViewMedia('clip', 'camera-1'), new ViewMedia('clip', 'camera-2')];
    const queryResults_1 = new MediaQueriesResults({ results: media, selectedIndex: 0 });
    const queryResults_2 = new MediaQueriesResults({ results: media, selectedIndex: 1 });

    const factory = mock<ViewFactory>();
    factory.getViewDefault.mockReturnValue(createView({ queryResults: queryResults_1 }));

    const manager = new ViewManager(createCardAPI(), factory);
    manager.setViewDefault();

    expect(
      manager.hasMajorMediaChange(createView({ queryResults: queryResults_2 })),
    ).toBeFalsy();
  });

  describe('should initialize', () => {
    it('without querystring', async () => {
      const api = createCardAPI();
      const factory = mock<ViewFactory>();
      const manager = new ViewManager(api, factory);

      const view = createView({
        view: 'live',
        camera: 'camera',
      });
      factory.getViewDefaultWithNewQuery.mockResolvedValue(view);

      expect(await manager.initialize()).toBeTruthy();

      expect(manager.getView()).toBe(view);
    });

    it('with querystring', async () => {
      const api = createCardAPI();
      const factory = mock<ViewFactory>();
      const manager = new ViewManager(api, factory);
      vi.mocked(api.getQueryStringManager().hasViewRelatedActionsToRun).mockReturnValue(
        true,
      );

      expect(await manager.initialize()).toBeTruthy();

      expect(manager.hasView()).toBeFalsy();
    });
  });
});
