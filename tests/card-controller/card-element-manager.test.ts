import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  CardElementManager,
  CardHTMLElement,
} from '../../src/card-controller/card-element-manager';
import { createCardAPI } from '../test-utils';
import { mock } from 'vitest-mock-extended';

const createElement = (): CardHTMLElement => {
  const element = document.createElement('div') as unknown as CardHTMLElement;
  element.requestUpdate = vi.fn();
  return element as CardHTMLElement;
};

// @vitest-environment jsdom
describe('CardElementManager', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    global.window.location = mock<Location>();
  });

  it('should get element', () => {
    const element = createElement();
    const manager = new CardElementManager(
      createCardAPI(),
      element,
      () => undefined,
      () => undefined,
    );

    expect(manager.getElement()).toBe(element);
  });

  it('should reset scroll', () => {
    const callback = vi.fn();
    const manager = new CardElementManager(
      createCardAPI(),
      createElement(),
      callback,
      () => undefined,
    );

    manager.scrollReset();

    expect(callback).toBeCalled();
  });

  it('should toggle menu', () => {
    const callback = vi.fn();
    const manager = new CardElementManager(
      createCardAPI(),
      createElement(),
      () => undefined,
      callback,
    );

    manager.toggleMenu();

    expect(callback).toBeCalled();
  });

  it('should update', () => {
    const element = createElement();
    const manager = new CardElementManager(
      createCardAPI(),
      element,
      () => undefined,
      () => undefined,
    );

    manager.update();
    expect(element.requestUpdate).toBeCalled();
  });

  it('should get hasUpdated', () => {
    const element = createElement();
    element.hasUpdated = true;
    const manager = new CardElementManager(
      createCardAPI(),
      element,
      () => undefined,
      () => undefined,
    );

    expect(manager.hasUpdated()).toBeTruthy();
  });

  it('should get height', () => {
    const element = createElement();
    element.getBoundingClientRect = vi.fn().mockReturnValue({
      width: 200,
      height: 800,
    });

    const manager = new CardElementManager(
      createCardAPI(),
      element,
      () => undefined,
      () => undefined,
    );

    expect(manager.getCardHeight()).toBe(800);
  });

  it('should connect', () => {
    const windowAddEventListener = vi.spyOn(global.window, 'addEventListener');

    const addEventListener = vi.fn();
    const element = createElement();
    element.addEventListener = addEventListener;

    const api = createCardAPI();
    const manager = new CardElementManager(
      api,
      element,
      () => undefined,
      () => undefined,
    );

    manager.elementConnected();

    expect(element.getAttribute('panel')).toBeNull();
    expect(api.getFullscreenManager().connect).toBeCalled();

    expect(addEventListener).toBeCalledWith(
      'mousemove',
      api.getInteractionManager().reportInteraction,
    );
    expect(addEventListener).toBeCalledWith(
      'll-custom',
      api.getActionsManager().handleActionEvent,
    );
    expect(addEventListener).toBeCalledWith(
      '@action',
      api.getInteractionManager().reportInteraction,
    );
    expect(windowAddEventListener).toBeCalledWith('location-changed', expect.anything());
    expect(windowAddEventListener).toBeCalledWith('popstate', expect.anything());
  });

  it('should disconnect', () => {
    const windowRemoveEventListener = vi.spyOn(global.window, 'removeEventListener');

    const element = createElement();
    element.setAttribute('panel', '');

    const removeEventListener = vi.fn();
    element.removeEventListener = removeEventListener;

    const api = createCardAPI();
    const manager = new CardElementManager(
      api,
      element,
      () => undefined,
      () => undefined,
    );

    manager.elementDisconnected();

    expect(element.getAttribute('panel')).toBeNull();
    expect(api.getMediaLoadedInfoManager().clear).toBeCalled();
    expect(api.getFullscreenManager().disconnect).toBeCalled();

    expect(removeEventListener).toBeCalledWith(
      'mousemove',
      api.getInteractionManager().reportInteraction,
    );
    expect(removeEventListener).toBeCalledWith(
      'll-custom',
      api.getActionsManager().handleActionEvent,
    );
    expect(removeEventListener).toBeCalledWith(
      '@action',
      api.getInteractionManager().reportInteraction,
    );
    expect(windowRemoveEventListener).toBeCalledWith(
      'location-changed',
      expect.anything(),
    );
    expect(windowRemoveEventListener).toBeCalledWith('popstate', expect.anything());
  });
});
