import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveController } from '../../../src/components-lib/live/live-controller';
import { dispatchMessageEvent } from '../../../src/components/message';
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
    parent.addEventListener('frigate-card:message', eventListener);

    const controller = new LiveController(host);
    expect(host.addController).toBeCalled();

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
});
