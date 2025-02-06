import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveController } from '../../../src/components-lib/live/live-controller';
import { dispatchExistingMediaLoadedInfoAsEvent } from '../../../src/utils/media-info';
import {
  IntersectionObserverMock,
  callIntersectionHandler,
  createLitElement,
  createMediaLoadedInfo,
  createMediaLoadedInfoEvent,
  createParent,
} from '../../test-utils';

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
    parent.addEventListener('advanced-camera-card:media:loaded', eventListener);

    const controller = new LiveController(host);
    expect(host.addController).toBeCalled();

    controller.hostConnected();

    callIntersectionHandler(false);

    dispatchExistingMediaLoadedInfoAsEvent(host, createMediaLoadedInfo());

    expect(eventListener).toBeCalledTimes(0);

    controller.hostDisconnected();
    dispatchExistingMediaLoadedInfoAsEvent(host, createMediaLoadedInfo());

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
      parent.addEventListener('advanced-camera-card:media:loaded', eventListener);

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
    });
  });
});
