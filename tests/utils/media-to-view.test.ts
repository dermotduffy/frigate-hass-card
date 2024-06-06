import { add, sub } from 'date-fns';
import { beforeEach, describe, expect, it, Mock, MockedFunction, vi } from 'vitest';
import { QueryType } from '../../src/camera-manager/types';
import {
  changeViewToRecentEventsForCameraAndDependents,
  changeViewToRecentRecordingForCameraAndDependents,
  executeMediaQueryForView,
  executeMediaQueryForViewWithErrorDispatching,
  findBestMediaIndex,
} from '../../src/utils/media-to-view';
import { ViewMedia } from '../../src/view/media';
import { EventMediaQueries } from '../../src/view/media-queries';
import {
  createCameraManager,
  createCapabilities,
  createPerformanceConfig,
  createStore,
  createView,
  TestViewMedia,
} from '../test-utils';

const createElementListenForView = (): {
  element: HTMLElement;
  viewHandler: EventListener;
  messageHandler: EventListener;
} => {
  const element = document.createElement('div');

  const viewHandler = vi.fn();
  element.addEventListener('frigate-card:view:change', viewHandler);

  const messageHandler = vi.fn();
  element.addEventListener('frigate-card:message', messageHandler);

  return {
    element: element,
    viewHandler: viewHandler,
    messageHandler: messageHandler,
  };
};

const getMediaFromHandlerCall = (handler: Mock<any, any>): ViewMedia[] | null => {
  return handler.mock.calls[0][0].detail.queryResults.getResults();
};

const generateViewMedia = (
  index: number,
  base: Date,
  durationSeconds: number,
  cameraID?: string,
): ViewMedia => {
  return new TestViewMedia({
    id: `id-${index}`,
    startTime: base,
    endTime: add(base, { seconds: durationSeconds }),
    ...(cameraID && { cameraID: cameraID }),
  });
};

// @vitest-environment jsdom
describe('changeViewToRecentEventsForCameraAndDependents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should do nothing without camera config for selected camera', async () => {
    const elementHandler = createElementListenForView();

    await changeViewToRecentEventsForCameraAndDependents(
      elementHandler.element,
      createCameraManager(),
      {},
      createView(),
    );
    expect(elementHandler.viewHandler).not.toBeCalled();
  });

  it('should do nothing without camera configs for all cameras', async () => {
    const elementHandler = createElementListenForView();

    await changeViewToRecentEventsForCameraAndDependents(
      elementHandler.element,
      createCameraManager(),
      {},
      createView(),
      {
        allCameras: true,
      },
    );
    expect(elementHandler.viewHandler).not.toBeCalled();
  });

  it('should do nothing unless queries can be created', async () => {
    const elementHandler = createElementListenForView();
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.generateDefaultEventQueries).mockReturnValue(null);

    await changeViewToRecentEventsForCameraAndDependents(
      elementHandler.element,
      cameraManager,
      {},
      createView(),
      {
        eventsMediaType: 'clips',
      },
    );
    expect(elementHandler.viewHandler).not.toBeCalled();
  });

  it('should dispatch new view on success', async () => {
    const elementHandler = createElementListenForView();
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera',
          capabilities: createCapabilities({ clips: true }),
        },
      ]),
    );
    vi.mocked(cameraManager.generateDefaultEventQueries).mockReturnValue([
      {
        type: QueryType.Event,
        cameraIDs: new Set(['camera']),
      },
    ]);

    const mediaArray = [new ViewMedia('clip', 'camera')];
    vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue(mediaArray);

    await changeViewToRecentEventsForCameraAndDependents(
      elementHandler.element,
      cameraManager,
      {},
      createView(),
      {
        targetView: 'clips',
        select: 'latest',
      },
    );
    expect(elementHandler.viewHandler).toBeCalled();
    expect(getMediaFromHandlerCall(vi.mocked(elementHandler.viewHandler))).toBe(
      mediaArray,
    );
  });

  it('should dispatch error message on fail', async () => {
    vi.spyOn(global.console, 'warn').mockImplementation(() => true);

    const elementHandler = createElementListenForView();
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera',
          capabilities: createCapabilities({ clips: true }),
        },
      ]),
    );
    vi.mocked(cameraManager.generateDefaultEventQueries).mockReturnValue([
      {
        type: QueryType.Event,
        cameraIDs: new Set(['camera']),
      },
    ]);
    vi.mocked(cameraManager.executeMediaQueries).mockRejectedValue(new Error());

    await changeViewToRecentEventsForCameraAndDependents(
      elementHandler.element,
      cameraManager,
      {},
      createView(),
    );
    expect(elementHandler.viewHandler).not.toBeCalled();
    expect(elementHandler.messageHandler).toBeCalled();
  });

  it('should respect media chunk size', async () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera',
          capabilities: createCapabilities({ clips: true }),
        },
      ]),
    );

    await changeViewToRecentEventsForCameraAndDependents(
      createElementListenForView().element,
      cameraManager,
      {
        performance: createPerformanceConfig({
          features: {
            media_chunk_size: 1000,
          },
        }),
      },
      createView(),
    );

    expect(cameraManager.generateDefaultEventQueries).toBeCalledWith(
      expect.anything(),
      expect.objectContaining({
        limit: 1000,
      }),
    );
  });

  it('should respect useCache', async () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera',
          capabilities: createCapabilities({ clips: true }),
        },
      ]),
    );
    vi.mocked(cameraManager.generateDefaultEventQueries).mockReturnValue([
      {
        type: QueryType.Event,
        cameraIDs: new Set(['camera']),
      },
    ]);

    await changeViewToRecentEventsForCameraAndDependents(
      createElementListenForView().element,
      cameraManager,
      {},
      createView(),
      {
        useCache: false,
      },
    );

    expect(vi.mocked(cameraManager.executeMediaQueries)).toBeCalledWith(
      expect.anything(),
      expect.objectContaining({
        useCache: false,
      }),
    );
  });

  describe('should respect request for media type', () => {
    it.each([
      ['snapshots' as const, 'hasSnapshot'],
      ['clips' as const, 'hasClip'],
    ])('%s', async (mediaType, queryParameter) => {
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(
        createStore([
          {
            cameraID: 'camera',
            capabilities: createCapabilities({ [mediaType]: true }),
          },
        ]),
      );

      await changeViewToRecentEventsForCameraAndDependents(
        createElementListenForView().element,
        cameraManager,
        {},
        createView(),
        {
          eventsMediaType: mediaType,
        },
      );

      expect(cameraManager.generateDefaultEventQueries).toBeCalledWith(
        expect.anything(),
        expect.objectContaining({
          [queryParameter]: true,
        }),
      );
    });
  });
});

// @vitest-environment jsdom
describe('executeMediaQueryForView', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should not execute empty queries', async () => {
    expect(
      await executeMediaQueryForView(
        createCameraManager(),
        createView(),
        new EventMediaQueries(),
      ),
    ).toBeNull();
  });

  it('should throw on failure', async () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.executeMediaQueries).mockRejectedValue(new Error());

    await expect(
      executeMediaQueryForView(
        cameraManager,
        createView(),
        new EventMediaQueries([
          {
            type: QueryType.Event,
            cameraIDs: new Set('camera'),
          },
        ]),
      ),
    ).rejects.toThrowError();
  });

  it('should select time-based result', async () => {
    const cameraManager = createCameraManager();

    const now = new Date();
    const mediaArray = [
      generateViewMedia(0, now, 60),
      generateViewMedia(1, now, 120),
      generateViewMedia(2, now, 10),
    ];
    vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue(mediaArray);

    const view = await executeMediaQueryForView(
      cameraManager,
      createView(),
      new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: new Set('camera'),
        },
      ]),
      {
        select: 'time',
        targetTime: add(now, { seconds: 30 }),
      },
    );

    // Should select the longest event.
    expect(view?.queryResults?.getSelectedIndex()).toBe(1);
    expect(view?.queryResults?.getResults()).toBe(mediaArray);
  });

  it('should select nothing when time-based selection does not match', async () => {
    const cameraManager = createCameraManager();

    const now = new Date();
    const mediaArray = [
      generateViewMedia(0, now, 60),
      generateViewMedia(1, now, 120),
      generateViewMedia(2, now, 10),
    ];

    vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue(mediaArray);

    const view = await executeMediaQueryForView(
      cameraManager,
      createView(),
      new EventMediaQueries([
        {
          type: QueryType.Event,
          cameraIDs: new Set('camera'),
        },
      ]),
      {
        select: 'time',
        targetTime: sub(now, { seconds: 30 }),
      },
    );

    // Should leave selection untouched (last item will remain selected).
    expect(view?.queryResults?.getSelectedIndex()).toBe(2);
    expect(view?.queryResults?.getResults()).toBe(mediaArray);
  });

  it('should select nothing when query returns null', async () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue(null);

    expect(
      await executeMediaQueryForView(
        cameraManager,
        createView(),
        new EventMediaQueries([
          {
            type: QueryType.Event,
            cameraIDs: new Set('camera'),
          },
        ]),
      ),
    ).toBeNull();
  });
});

// @vitest-environment jsdom
describe('changeViewToRecentRecordingForCameraAndDependents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should do nothing without camera config for selected camera', async () => {
    const elementHandler = createElementListenForView();

    await changeViewToRecentRecordingForCameraAndDependents(
      elementHandler.element,
      createCameraManager(),
      {},
      createView(),
    );
    expect(elementHandler.viewHandler).not.toBeCalled();
  });

  it('should do nothing without camera configs for all cameras', async () => {
    const elementHandler = createElementListenForView();

    await changeViewToRecentRecordingForCameraAndDependents(
      elementHandler.element,
      createCameraManager(),
      {},
      createView(),
      {
        allCameras: true,
      },
    );
    expect(elementHandler.viewHandler).not.toBeCalled();
  });

  it('should do nothing unless queries can be created', async () => {
    const elementHandler = createElementListenForView();
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.generateDefaultRecordingQueries).mockReturnValue(null);

    await changeViewToRecentRecordingForCameraAndDependents(
      elementHandler.element,
      cameraManager,
      {},
      createView(),
    );
    expect(elementHandler.viewHandler).not.toBeCalled();
  });

  it('should dispatch new view on success', async () => {
    const elementHandler = createElementListenForView();
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera',
          capabilities: createCapabilities({ recordings: true }),
        },
      ]),
    );

    const mediaArray = [new ViewMedia('recording', 'camera')];
    vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue(mediaArray);
    vi.mocked(cameraManager.generateDefaultRecordingQueries).mockReturnValue([
      {
        type: QueryType.Recording,
        cameraIDs: new Set(['camera']),
      },
    ]);

    await changeViewToRecentRecordingForCameraAndDependents(
      elementHandler.element,
      cameraManager,
      {},
      createView(),
      {
        targetView: 'recordings',
        select: 'latest',
      },
    );
    expect(elementHandler.viewHandler).toBeCalled();
    expect(getMediaFromHandlerCall(vi.mocked(elementHandler.viewHandler))).toBe(
      mediaArray,
    );
  });

  it('should respect media chunk size', async () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera',
          capabilities: createCapabilities({ recordings: true }),
        },
      ]),
    );

    await changeViewToRecentRecordingForCameraAndDependents(
      createElementListenForView().element,
      cameraManager,
      {
        performance: createPerformanceConfig({
          features: {
            media_chunk_size: 1000,
          },
        }),
      },
      createView(),
    );

    expect(cameraManager.generateDefaultRecordingQueries).toBeCalledWith(
      expect.anything(),
      expect.objectContaining({
        limit: 1000,
      }),
    );
  });

  it('should respect useCache', async () => {
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera',
          capabilities: createCapabilities({ recordings: true }),
        },
      ]),
    );
    vi.mocked(cameraManager.generateDefaultRecordingQueries).mockReturnValue([
      {
        type: QueryType.Recording,
        cameraIDs: new Set(['camera']),
      },
    ]);

    await changeViewToRecentRecordingForCameraAndDependents(
      createElementListenForView().element,
      cameraManager,
      {},
      createView(),
      {
        targetView: 'recordings',
        select: 'latest',
        useCache: false,
      },
    );

    expect(vi.mocked(cameraManager.executeMediaQueries)).toBeCalledWith(
      expect.anything(),
      expect.objectContaining({
        useCache: false,
      }),
    );
  });
});

// @vitest-environment jsdom
describe('executeMediaQueryForViewWithErrorDispatching', () => {
  it('should dispatch error message on fail', async () => {
    vi.spyOn(global.console, 'warn').mockImplementation(() => true);

    const elementHandler = createElementListenForView();
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.executeMediaQueries).mockRejectedValue(new Error());

    await executeMediaQueryForViewWithErrorDispatching(
      elementHandler.element,
      cameraManager,
      createView(),
      new EventMediaQueries([{ type: QueryType.Event, cameraIDs: new Set(['camera']) }]),
    );

    expect(elementHandler.viewHandler).not.toBeCalled();
    expect(elementHandler.messageHandler).toBeCalled();
  });
});

// @vitest-environment jsdom
describe('findBestMediaIndex', () => {
  it('should find best media index', async () => {
    const now = new Date();
    const mediaArray = [
      generateViewMedia(0, now, 60),
      generateViewMedia(1, now, 120),
      generateViewMedia(2, now, 10),
    ];

    expect(findBestMediaIndex(mediaArray, add(now, { seconds: 30 }))).toBe(1);
  });

  it('should find best media index respecting favored cameraID', async () => {
    const now = new Date();
    const mediaArray = [
      generateViewMedia(0, now, 60, 'less-good-camera'),
      generateViewMedia(1, now, 120, 'less-good-camera'),
      generateViewMedia(2, now, 10, 'favored-camera'),
      generateViewMedia(3, now, 35, 'favored-camera'),
      generateViewMedia(4, now, 40, 'favored-camera'),
      generateViewMedia(5, now, 30, 'favored-camera'),
      generateViewMedia(6, now, 300, 'less-good-camera'),
    ];

    expect(
      findBestMediaIndex(mediaArray, add(now, { seconds: 30 }), 'favored-camera'),
    ).toBe(4);
  });
});
