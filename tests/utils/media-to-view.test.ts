import add from 'date-fns/add';
import sub from 'date-fns/sub';
import { beforeEach, describe, expect, it, Mock, vi } from 'vitest';
import {
  CameraConfigs,
  PartialRecordingQuery,
  QueryType,
} from '../../src/camera-manager/types';
import { setify } from '../../src/utils/basic';
import {
  changeViewToRecentEventsForCameraAndDependents,
  changeViewToRecentRecordingForCameraAndDependents,
  createQueriesForRecordingsView,
  executeMediaQueryForView,
  findBestMediaIndex,
} from '../../src/utils/media-to-view';
import { ViewMedia } from '../../src/view/media';
import { EventMediaQueries } from '../../src/view/media-queries';
import {
  createCameraManager,
  createHASS,
  createPerformanceConfig,
  createView,
  TestViewMedia,
} from '../test-utils';

vi.mock('../../src/camera-manager/manager.js');

const createElementListenForView = (): {
  element: HTMLElement;
  viewHandler: Mock<any, any>;
  messageHandler: Mock<any, any>;
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
): ViewMedia => {
  return new TestViewMedia({
    id: `id-${index}`,
    startTime: base,
    endTime: add(base, { seconds: durationSeconds }),
  });
};

// @vitest-environment jsdom
describe('changeViewToRecentEventsForCameraAndDependents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should do nothing without camera config for selected camera', async () => {
    const elementHandler = createElementListenForView();
    const cameraManager = createCameraManager({ configs: new Map() });

    await changeViewToRecentEventsForCameraAndDependents(
      elementHandler.element,
      createHASS(),
      cameraManager,
      {},
      createView(),
    );
    expect(elementHandler.viewHandler).not.toBeCalled();
  });

  it('should do nothing without camera configs for all cameras', async () => {
    const elementHandler = createElementListenForView();
    const cameraManager = createCameraManager({ configs: new Map() });

    await changeViewToRecentEventsForCameraAndDependents(
      elementHandler.element,
      createHASS(),
      cameraManager,
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
      createHASS(),
      cameraManager,
      {},
      createView(),
      {
        mediaType: 'clips',
      },
    );
    expect(elementHandler.viewHandler).not.toBeCalled();
  });

  it('should dispatch new view on success', async () => {
    const elementHandler = createElementListenForView();
    const cameraManager = createCameraManager();

    const mediaArray = [new ViewMedia('clip', 'camera')];
    vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue(mediaArray);

    await changeViewToRecentEventsForCameraAndDependents(
      elementHandler.element,
      createHASS(),
      cameraManager,
      {},
      createView(),
      {
        targetView: 'clips',
        select: 'latest',
      },
    );
    expect(elementHandler.viewHandler).toBeCalled();
    expect(getMediaFromHandlerCall(elementHandler.viewHandler)).toBe(mediaArray);
  });

  it('should dispatch error message on fail', async () => {
    vi.spyOn(global.console, 'warn').mockImplementation(() => true);

    const elementHandler = createElementListenForView();
    const cameraManager = createCameraManager();
    vi.mocked(cameraManager.executeMediaQueries).mockRejectedValue(new Error());

    await changeViewToRecentEventsForCameraAndDependents(
      elementHandler.element,
      createHASS(),
      cameraManager,
      {},
      createView(),
    );
    expect(elementHandler.viewHandler).not.toBeCalled();
    expect(elementHandler.messageHandler).toBeCalled();
  });

  it('should respect media chunk size', async () => {
    const cameraManager = createCameraManager();

    await changeViewToRecentEventsForCameraAndDependents(
      createElementListenForView().element,
      createHASS(),
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

  describe('should respect request for media type', () => {
    it.each([
      ['snapshots' as const, 'hasSnapshot'],
      ['clips' as const, 'hasClip'],
    ])('%s', async (mediaType, queryParameter) => {
      const cameraManager = createCameraManager();

      await changeViewToRecentEventsForCameraAndDependents(
        createElementListenForView().element,
        createHASS(),
        cameraManager,
        {},
        createView(),
        {
          mediaType: mediaType,
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
    const elementHandler = createElementListenForView();
    const cameraConfigs: CameraConfigs = new Map();
    const cameraManager = createCameraManager({ configs: cameraConfigs });

    expect(
      await executeMediaQueryForView(
        elementHandler.element,
        createHASS(),
        cameraManager,
        createView(),
        new EventMediaQueries(),
      ),
    ).toBeNull();
  });

  it('should select time-based result', async () => {
    const elementHandler = createElementListenForView();
    const cameraConfigs: CameraConfigs = new Map();
    const cameraManager = createCameraManager({ configs: cameraConfigs });

    const now = new Date();
    const mediaArray = [
      generateViewMedia(0, now, 60),
      generateViewMedia(1, now, 120),
      generateViewMedia(2, now, 10),
    ];
    vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue(mediaArray);

    const view = await executeMediaQueryForView(
      elementHandler.element,
      createHASS(),
      cameraManager,
      createView(),
      new EventMediaQueries(
        cameraManager.generateDefaultEventQueries('camera') ?? undefined,
      ),
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
    const elementHandler = createElementListenForView();
    const cameraConfigs: CameraConfigs = new Map();
    const cameraManager = createCameraManager({ configs: cameraConfigs });

    const now = new Date();
    const mediaArray = [
      generateViewMedia(0, now, 60),
      generateViewMedia(1, now, 120),
      generateViewMedia(2, now, 10),
    ];

    vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue(mediaArray);

    const view = await executeMediaQueryForView(
      elementHandler.element,
      createHASS(),
      cameraManager,
      createView(),
      new EventMediaQueries(
        cameraManager.generateDefaultEventQueries('camera') ?? undefined,
      ),
      {
        select: 'time',
        targetTime: sub(now, { seconds: 30 }),
      },
    );

    // Should leave selection untouched (last item will remain selected).
    expect(view?.queryResults?.getSelectedIndex()).toBe(2);
    expect(view?.queryResults?.getResults()).toBe(mediaArray);
  });
});

// @vitest-environment jsdom
describe('changeViewToRecentRecordingForCameraAndDependents', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should do nothing without camera config for selected camera', async () => {
    const elementHandler = createElementListenForView();
    const cameraManager = createCameraManager({ configs: new Map() });

    await changeViewToRecentRecordingForCameraAndDependents(
      elementHandler.element,
      createHASS(),
      cameraManager,
      {},
      createView(),
    );
    expect(elementHandler.viewHandler).not.toBeCalled();
  });

  it('should do nothing without camera configs for all cameras', async () => {
    const elementHandler = createElementListenForView();
    const cameraManager = createCameraManager({ configs: new Map() });

    await changeViewToRecentRecordingForCameraAndDependents(
      elementHandler.element,
      createHASS(),
      cameraManager,
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
      createHASS(),
      cameraManager,
      {},
      createView(),
    );
    expect(elementHandler.viewHandler).not.toBeCalled();
  });

  it('should dispatch new view on success', async () => {
    const elementHandler = createElementListenForView();
    const cameraManager = createCameraManager();

    const mediaArray = [new ViewMedia('recording', 'camera')];
    vi.mocked(cameraManager.executeMediaQueries).mockResolvedValue(mediaArray);

    await changeViewToRecentRecordingForCameraAndDependents(
      elementHandler.element,
      createHASS(),
      cameraManager,
      {},
      createView(),
      {
        targetView: 'recordings',
        select: 'latest',
      },
    );
    expect(elementHandler.viewHandler).toBeCalled();
    expect(getMediaFromHandlerCall(elementHandler.viewHandler)).toBe(mediaArray);
  });

  it('should respect media chunk size', async () => {
    const cameraManager = createCameraManager();

    await changeViewToRecentRecordingForCameraAndDependents(
      createElementListenForView().element,
      createHASS(),
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
});

// @vitest-environment jsdom
describe('createQueriesForRecordingsView', () => {
  it('should respect start and end date in recording query', async () => {
    const cameraManager = createCameraManager({ configs: new Map() });

    vi.mocked(cameraManager.generateDefaultRecordingQueries).mockImplementation(
      (cameraIDs: string | Set<string>, partialQuery?: PartialRecordingQuery) => [
        {
          cameraIDs: setify(cameraIDs),
          type: QueryType.Recording,
          ...partialQuery,
        },
      ],
    );

    const start = new Date('2023-04-29T14:00:00');
    const end = new Date('2023-04-29T14:59:59');

    const queries = createQueriesForRecordingsView(
      cameraManager,
      {},
      new Set(['camera']),
      {
        start: start,
        end: end,
      },
    );

    expect(queries?.getQueries()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          start: start,
          end: end,
        }),
      ]),
    );
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
});
