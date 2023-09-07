import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { FrigateCardMediaPlayer } from '../../../../../src/types';
import {
  AutoMediaActions,
  AutoMediaActionsOptionsType,
  AutoMediaActionsType,
} from '../../../../../src/utils/embla/plugins/auto-media-actions/auto-media-actions';
import { dispatchExistingMediaLoadedInfoAsEvent } from '../../../../../src/utils/media-info';
import {
  IntersectionObserverMock,
  createMediaLoadedInfo,
  createParent,
} from '../../../../test-utils';
import {
  callEmblaHandler,
  callIntersectionHandler,
  callVisibilityHandler,
  createEmblaApiInstance,
  createTestEmblaOptionHandler,
  createTestSlideNodes,
} from '../../test-utils';

const getPlayer = (
  element: HTMLElement,
  selector: string,
): (HTMLElement & FrigateCardMediaPlayer) | null => {
  return element.querySelector(selector);
};

const createPlayerSlideNodes = (n = 10): HTMLElement[] => {
  const slides = createTestSlideNodes({ n: n });
  for (const slide of slides) {
    const player = document.createElement('video');

    player['play'] = vi.fn();
    player['pause'] = vi.fn();
    player['mute'] = vi.fn();
    player['unmute'] = vi.fn();
    player['isMuted'] = vi.fn().mockReturnValue(true);
    player['seek'] = vi.fn();
    player['getScreenshotURL'] = vi.fn();
    player['setControls'] = vi.fn();
    player['isPaused'] = vi.fn();

    slide.appendChild(player);
  }
  return slides;
};

const createPlugin = (options?: AutoMediaActionsOptionsType): AutoMediaActionsType => {
  return AutoMediaActions({
    playerSelector: 'video',
    autoPlayCondition: 'all',
    autoUnmuteCondition: 'all',
    autoPauseCondition: 'all',
    autoMuteCondition: 'all',
    ...options,
  });
};

// @vitest-environment jsdom
describe('AutoMediaActions', () => {
  beforeAll(() => {
    vi.stubGlobal('IntersectionObserver', IntersectionObserverMock);
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should construct', () => {
    const plugin = AutoMediaActions();
    expect(plugin.name).toBe('autoMediaActions');
  });

  it('should init without any conditions', () => {
    const plugin = AutoMediaActions();

    const parent = createParent();
    const addEventListener = vi.fn();
    parent.addEventListener = addEventListener;
    const emblaApi = createEmblaApiInstance({ containerNode: parent });

    plugin.init(emblaApi, createTestEmblaOptionHandler());

    expect(emblaApi.on).toBeCalledWith('destroy', expect.anything());
    expect(emblaApi.on).not.toBeCalledWith('select', expect.anything());
    expect(addEventListener).not.toBeCalled();
  });

  it('should destroy', () => {
    const plugin = createPlugin();
    const parent = createParent();
    const removeEventListener = vi.fn();
    parent.removeEventListener = removeEventListener;
    const emblaApi = createEmblaApiInstance({ containerNode: parent });

    plugin.init(emblaApi, createTestEmblaOptionHandler());

    plugin.destroy();

    expect(emblaApi.off).toBeCalledWith('destroy', expect.anything());
    expect(emblaApi.off).toBeCalledWith('select', expect.anything());
    expect(removeEventListener).toBeCalled();
  });

  it('should destroy without any conditions', () => {
    const plugin = AutoMediaActions();
    const parent = createParent();
    const removeEventListener = vi.fn();
    parent.removeEventListener = removeEventListener;
    const emblaApi = createEmblaApiInstance({ containerNode: parent });

    plugin.init(emblaApi, createTestEmblaOptionHandler());

    plugin.destroy();

    expect(emblaApi.off).toBeCalledWith('destroy', expect.anything());
    expect(emblaApi.off).not.toBeCalledWith('select', expect.anything());
    expect(removeEventListener).not.toBeCalled();
  });

  it('should mute and pause on destroy', () => {
    const plugin = createPlugin();
    const children = createPlayerSlideNodes();
    const parent = createParent({ children: children });
    const emblaApi = createEmblaApiInstance({
      slideNodes: children,
      containerNode: parent,
      selectedScrollSnap: 5,
    });

    plugin.init(emblaApi, createTestEmblaOptionHandler());
    callEmblaHandler(emblaApi, 'destroy');

    expect(getPlayer(children[5], 'video')?.pause).toBeCalled();
    expect(getPlayer(children[5], 'video')?.mute).toBeCalled();
  });

  it('should play and unmute on media load', () => {
    const plugin = createPlugin();
    const children = createPlayerSlideNodes();
    const parent = createParent({ children: children });
    const emblaApi = createEmblaApiInstance({
      slideNodes: children,
      containerNode: parent,
      selectedScrollSnap: 5,
    });

    plugin.init(emblaApi, createTestEmblaOptionHandler());
    dispatchExistingMediaLoadedInfoAsEvent(parent, createMediaLoadedInfo());

    expect(getPlayer(children[5], 'video')?.play).toBeCalled();
    expect(getPlayer(children[5], 'video')?.unmute).toBeCalled();
  });

  it('should not play or unmute on media load when player selecter not provided', () => {
    const plugin = createPlugin({ playerSelector: undefined });
    const children = createPlayerSlideNodes();
    const parent = createParent({ children: children });
    const emblaApi = createEmblaApiInstance({
      slideNodes: children,
      containerNode: parent,
      selectedScrollSnap: 5,
    });

    plugin.init(emblaApi, createTestEmblaOptionHandler());
    dispatchExistingMediaLoadedInfoAsEvent(parent, createMediaLoadedInfo());

    expect(getPlayer(children[5], 'video')?.play).not.toBeCalled();
    expect(getPlayer(children[5], 'video')?.unmute).not.toBeCalled();
  });

  it('should pause and mute previous on select', () => {
    const plugin = createPlugin();
    const children = createPlayerSlideNodes();
    const emblaApi = createEmblaApiInstance({
      slideNodes: children,
      previousScrollSnap: 4,
    });

    plugin.init(emblaApi, createTestEmblaOptionHandler());
    callEmblaHandler(emblaApi, 'select');

    expect(getPlayer(children[4], 'video')?.pause).toBeCalled();
    expect(getPlayer(children[4], 'video')?.mute).toBeCalled();
  });

  it('should play and unmute on visibility change to visible', () => {
    vi.spyOn(global.document, 'addEventListener');

    const plugin = createPlugin();
    const children = createPlayerSlideNodes();
    const emblaApi = createEmblaApiInstance({
      slideNodes: children,
      selectedScrollSnap: 5,
    });

    plugin.init(emblaApi, createTestEmblaOptionHandler());

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
    });
    callVisibilityHandler();

    expect(getPlayer(children[5], 'video')?.play).toBeCalled();
    expect(getPlayer(children[5], 'video')?.unmute).toBeCalled();
  });

  it('should pause and unmute on visibility change to hidden', () => {
    vi.spyOn(global.document, 'addEventListener');

    const plugin = createPlugin();
    const children = createPlayerSlideNodes();
    const emblaApi = createEmblaApiInstance({
      slideNodes: children,
    });

    plugin.init(emblaApi, createTestEmblaOptionHandler());

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
    });
    callVisibilityHandler();

    for (const child of children) {
      expect(getPlayer(child, 'video')?.pause).toBeCalled();
      expect(getPlayer(child, 'video')?.mute).toBeCalled();
    }
  });

  describe('should take no action on visibility change without callbacks', () => {
    it.each([['visible' as const], ['hidden' as const]])(
      '%s',
      (visibilityState: 'visible' | 'hidden') => {
        vi.spyOn(global.document, 'addEventListener');

        const plugin = AutoMediaActions();
        const children = createPlayerSlideNodes();
        const emblaApi = createEmblaApiInstance({
          slideNodes: children,
        });

        plugin.init(emblaApi, createTestEmblaOptionHandler());

        Object.defineProperty(document, 'visibilityState', {
          value: visibilityState,
          writable: true,
        });
        callVisibilityHandler();

        for (const child of children) {
          expect(getPlayer(child, 'video')?.play).not.toBeCalled();
          expect(getPlayer(child, 'video')?.pause).not.toBeCalled();
          expect(getPlayer(child, 'video')?.mute).not.toBeCalled();
          expect(getPlayer(child, 'video')?.unmute).not.toBeCalled();
        }
      },
    );
  });

  it('should play and unmute on intersection', () => {
    const plugin = createPlugin();
    const children = createPlayerSlideNodes();
    const emblaApi = createEmblaApiInstance({
      slideNodes: children,
      selectedScrollSnap: 5,
    });

    plugin.init(emblaApi, createTestEmblaOptionHandler());

    // Intersection observer always calls handler on creation (and we ignore
    // these first calls).
    callIntersectionHandler(true);
    callIntersectionHandler(true);

    expect(getPlayer(children[5], 'video')?.play).toBeCalled();
    expect(getPlayer(children[5], 'video')?.unmute).toBeCalled();
  });

  it('should pause and mute on intersection', () => {
    vi.spyOn(global.document, 'addEventListener');

    const plugin = createPlugin();
    const children = createPlayerSlideNodes();
    const emblaApi = createEmblaApiInstance({
      slideNodes: children,
    });

    plugin.init(emblaApi, createTestEmblaOptionHandler());

    // Intersection observer always calls handler on creation (and we ignore
    // these first calls).
    callIntersectionHandler(true);
    callIntersectionHandler(false);

    for (const child of children) {
      expect(getPlayer(child, 'video')?.pause).toBeCalled();
      expect(getPlayer(child, 'video')?.mute).toBeCalled();
    }
  });
});
