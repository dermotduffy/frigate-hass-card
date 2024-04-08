import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveController } from '../../../src/components-lib/live/live-controller';
import { dispatchMessageEvent } from '../../../src/components/message';
import {
  changeViewToRecentEventsForCameraAndDependents,
  changeViewToRecentRecordingForCameraAndDependents,
} from '../../../src/utils/media-to-view';
import { EventMediaQueries } from '../../../src/view/media-queries';
import {
  IntersectionObserverMock,
  callIntersectionHandler,
  createCameraManager,
  createConfig,
  createLitElement,
  createMediaLoadedInfo,
  createMediaLoadedInfoEvent,
  createParent,
  createView,
  createViewChangeEvent,
} from '../../test-utils';

vi.mock('../../../src/utils/media-to-view');

// @vitest-environment jsdom
describe('LiveController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
  });

  it('should be constructable', () => {
    const controller = new LiveController(createLitElement());
    expect(controller).toBeTruthy();
  });

  it('should connect and disconnect', () => {
    const host = createLitElement();
    const parent = createParent({ children: [host] });
    const eventListener = vi.fn();
    parent.addEventListener('frigate-card:message', eventListener);

    const controller = new LiveController(host);

    controller.hostConnected();

    callIntersectionHandler(false);
    dispatchMessageEvent(host, 'message', 'info');

    expect(eventListener).toBeCalledTimes(0);

    controller.hostDisconnected();
    dispatchMessageEvent(host, 'message', 'info');

    expect(eventListener).toBeCalledTimes(1);
  });

  describe('should handle background / foreground', () => {
    it('should start in the foreground', () => {
      const controller = new LiveController(createLitElement());
      expect(controller.isInBackground()).toBeFalsy();
    });

    it('should handle changing to background', () => {
      const element = createLitElement();
      const controller = new LiveController(element);
      expect(controller.isInBackground()).toBeFalsy();
      expect(element.requestUpdate).toBeCalledTimes(0);

      callIntersectionHandler(true);
      expect(controller.isInBackground()).toBeFalsy();
      expect(element.requestUpdate).toBeCalledTimes(0);

      callIntersectionHandler(false);
      expect(controller.isInBackground()).toBeTruthy();
      expect(element.requestUpdate).toBeCalledTimes(1);
    });

    it('should dispatch media loaded on background change', () => {
      const host = createLitElement();
      const parent = createParent({ children: [host] });
      const eventListener = vi.fn();
      parent.addEventListener('frigate-card:media:loaded', eventListener);

      const controller = new LiveController(host);
      const mediaLoadedInfo = createMediaLoadedInfo();

      controller.hostConnected();

      callIntersectionHandler(false);
      expect(controller.isInBackground()).toBeTruthy();

      host.dispatchEvent(createMediaLoadedInfoEvent(mediaLoadedInfo));
      expect(eventListener).toBeCalledTimes(0);

      callIntersectionHandler(true);
      expect(eventListener).toBeCalledTimes(1);
      expect(eventListener).toHaveBeenLastCalledWith(
        expect.objectContaining({
          detail: mediaLoadedInfo,
        }),
      );

      host.dispatchEvent(createMediaLoadedInfoEvent(mediaLoadedInfo));
      expect(eventListener).toBeCalledTimes(2);

      callIntersectionHandler(false);
      dispatchMessageEvent(host, 'message', 'info');
      callIntersectionHandler(true);
      expect(eventListener).toBeCalledTimes(2);

      controller.clearMessageReceived();
      callIntersectionHandler(true);
      expect(eventListener).toBeCalledTimes(3);
    });
  });

  describe('should correctly allow updates', () => {
    it('when not in background', () => {
      const controller = new LiveController(createLitElement());
      expect(controller.shouldUpdate()).toBeTruthy();
    });

    it('when in background without message', () => {
      const host = createLitElement();
      const controller = new LiveController(host);
      controller.hostConnected();

      callIntersectionHandler(false);

      expect(controller.shouldUpdate()).toBeTruthy();
    });

    it('when in background with message', () => {
      const host = createLitElement();
      const controller = new LiveController(host);
      controller.hostConnected();

      callIntersectionHandler(false);
      dispatchMessageEvent(host, 'message', 'info');

      expect(controller.shouldUpdate()).toBeFalsy();
    });
  });

  it('should handle message', () => {
    const host = createLitElement();
    const parent = createParent({ children: [host] });
    const eventListener = vi.fn();
    parent.addEventListener('frigate-card:message', eventListener);

    const controller = new LiveController(host);
    controller.hostConnected();

    callIntersectionHandler(false);
    expect(controller.isInBackground()).toBeTruthy();

    const firstRenderEpoch = controller.getRenderEpoch();

    dispatchMessageEvent(host, 'message', 'info');
    expect(eventListener).toBeCalledTimes(0);

    const secondRenderEpoch = controller.getRenderEpoch();
    expect(secondRenderEpoch).not.toBe(firstRenderEpoch);

    callIntersectionHandler(true);

    dispatchMessageEvent(host, 'message', 'info');
    expect(eventListener).toBeCalledTimes(1);
    expect(controller.getRenderEpoch()).toBe(secondRenderEpoch);
  });

  it('should handle view change', () => {
    const host = createLitElement();
    const parent = createParent({ children: [host] });
    const eventListener = vi.fn();
    parent.addEventListener('frigate-card:view:change', eventListener);

    const controller = new LiveController(host);
    controller.hostConnected();
    const view = createView();

    callIntersectionHandler(false);
    expect(controller.isInBackground()).toBeTruthy();
    host.dispatchEvent(createViewChangeEvent(view));

    expect(eventListener).toBeCalledTimes(0);

    callIntersectionHandler(true);
    expect(controller.isInBackground()).toBeFalsy();

    host.dispatchEvent(createViewChangeEvent(view));

    expect(eventListener).toBeCalledTimes(1);
  });

  describe('should fetch media', () => {
    it('when in background', async () => {
      const controller = new LiveController(createLitElement());

      callIntersectionHandler(false);

      await controller.fetchMediaInBackgroundIfNecessary(
        createView(),
        createCameraManager(),
        {},
        createConfig().live,
      );

      expect(changeViewToRecentEventsForCameraAndDependents).not.toBeCalled();
      expect(changeViewToRecentRecordingForCameraAndDependents).not.toBeCalled();
    });

    it('when has existing query', async () => {
      const controller = new LiveController(createLitElement());

      await controller.fetchMediaInBackgroundIfNecessary(
        createView({ query: new EventMediaQueries() }),
        createCameraManager(),
        {},
        createConfig().live,
      );

      expect(changeViewToRecentEventsForCameraAndDependents).not.toBeCalled();
      expect(changeViewToRecentRecordingForCameraAndDependents).not.toBeCalled();
    });

    it('when has no thumbnails', async () => {
      const controller = new LiveController(createLitElement());

      await controller.fetchMediaInBackgroundIfNecessary(
        createView(),
        createCameraManager(),
        {},
        createConfig({
          live: {
            controls: {
              thumbnails: {
                mode: 'none',
              },
            },
          },
        }).live,
      );

      expect(changeViewToRecentEventsForCameraAndDependents).not.toBeCalled();
      expect(changeViewToRecentRecordingForCameraAndDependents).not.toBeCalled();
    });

    it('when fetch disabled in context', async () => {
      const controller = new LiveController(createLitElement());

      await controller.fetchMediaInBackgroundIfNecessary(
        createView({
          context: {
            live: {
              fetchThumbnails: false,
            },
          },
        }),
        createCameraManager(),
        {},
        createConfig().live,
      );

      expect(changeViewToRecentEventsForCameraAndDependents).not.toBeCalled();
      expect(changeViewToRecentRecordingForCameraAndDependents).not.toBeCalled();
    });

    describe('with fetch', () => {
      const now = new Date('2024-04-07T19:43');
      beforeAll(() => {
        vi.useFakeTimers();
        vi.setSystemTime(now);
      });

      afterAll(() => {
        vi.useRealTimers();
      });

      it('events', async () => {
        const host = createLitElement();
        const controller = new LiveController(host);
        const view = createView();
        const cameraManager = createCameraManager();
        const cardWideConfig = {};

        await controller.fetchMediaInBackgroundIfNecessary(
          view,
          cameraManager,
          cardWideConfig,
          createConfig({
            live: {
              controls: {
                thumbnails: {
                  media_type: 'events',
                  events_media_type: 'all',
                },
                timeline: {
                  window_seconds: 3600,
                },
              },
            },
          }).live,
        );

        expect(changeViewToRecentEventsForCameraAndDependents).toBeCalledWith(
          host,
          cameraManager,
          cardWideConfig,
          view,
          expect.objectContaining({
            allCameras: false,
            targetView: 'live',
            eventsMediaType: 'all',
            select: 'latest',
            viewContext: expect.objectContaining({
              timeline: {
                window: {
                  start: new Date('2024-04-07T18:43'),
                  end: now,
                },
              },
            }),
          }),
        );
        expect(changeViewToRecentRecordingForCameraAndDependents).not.toBeCalled();
      });

      it('recordings', async () => {
        const host = createLitElement();
        const controller = new LiveController(host);
        const view = createView();
        const cameraManager = createCameraManager();
        const cardWideConfig = {};

        await controller.fetchMediaInBackgroundIfNecessary(
          view,
          cameraManager,
          cardWideConfig,
          createConfig({
            live: {
              controls: {
                thumbnails: {
                  media_type: 'recordings',
                },
                timeline: {
                  window_seconds: 3600,
                },
              },
            },
          }).live,
        );

        expect(changeViewToRecentEventsForCameraAndDependents).not.toBeCalled();
        expect(changeViewToRecentRecordingForCameraAndDependents).toBeCalledWith(
          host,
          cameraManager,
          cardWideConfig,
          view,
          expect.objectContaining({
            allCameras: false,
            targetView: 'live',
            select: 'latest',
            viewContext: expect.objectContaining({
              timeline: {
                window: {
                  start: new Date('2024-04-07T18:43'),
                  end: now,
                },
              },
            }),
          }),
        );
      });
    });
  });
});
