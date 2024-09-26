import { beforeEach, describe, expect, it, vi } from 'vitest';
import AutoMediaLoadedInfo from '../../../../../src/utils/embla/plugins/auto-media-loaded-info/auto-media-loaded-info';
import {
  dispatchExistingMediaLoadedInfoAsEvent,
  dispatchMediaUnloadedEvent,
} from '../../../../../src/utils/media-info';
import { createMediaLoadedInfo, createParent } from '../../../../test-utils';
import {
  createEmblaApiInstance,
  createTestEmblaOptionHandler,
  createTestSlideNodes,
} from '../../test-utils';

// @vitest-environment jsdom
describe('AutoMediaLoadedInfo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should construct', () => {
    const plugin = AutoMediaLoadedInfo();
    expect(plugin.name).toBe('autoMediaLoadedInfo');
  });

  it('should destroy', () => {
    const plugin = AutoMediaLoadedInfo();
    const emblaApi = createEmblaApiInstance();
    plugin.init(emblaApi, createTestEmblaOptionHandler());
    plugin.destroy();

    expect(emblaApi.off).toBeCalledWith('init', expect.anything());
  });

  describe('should correctly propogate media load/unload depending on whether media is currently selected', () => {
    it.each([
      ['loaded' as const, true],
      ['unloaded' as const, true],
      ['loaded' as const, false],
      ['unloaded' as const, false],
    ])('%s', (type: string, selected: boolean) => {
      const plugin = AutoMediaLoadedInfo();
      const children = createTestSlideNodes();
      const parent = createParent({ children: children });

      const emblaApi = createEmblaApiInstance({
        containerNode: parent,
        slideNodes: children,
        selectedScrollSnap: selected ? 5 : 4,
      });
      plugin.init(emblaApi, createTestEmblaOptionHandler());

      const mediaLoadedHandler = vi.fn();
      parent.addEventListener('frigate-card:media:' + type, mediaLoadedHandler);
      if (type === 'loaded') {
        dispatchExistingMediaLoadedInfoAsEvent(children[5], createMediaLoadedInfo());
      } else if (type === 'unloaded') {
        dispatchMediaUnloadedEvent(children[5]);
      }

      if (selected) {
        expect(mediaLoadedHandler).toBeCalled();
      } else {
        expect(mediaLoadedHandler).not.toBeCalled();
      }
    });
  });

  it('selecting a slide should dispatch a previously saved media loaded info if present', () => {
    const plugin = AutoMediaLoadedInfo();
    const children = createTestSlideNodes();
    const parent = createParent({ children: children });
    const emblaApi = createEmblaApiInstance({
      containerNode: parent,
      slideNodes: children,
    });
    plugin.init(emblaApi, createTestEmblaOptionHandler());

    const mediaLoadedHandler = vi.fn();
    parent.addEventListener('frigate-card:media:loaded', mediaLoadedHandler);
    dispatchExistingMediaLoadedInfoAsEvent(children[5], createMediaLoadedInfo());

    vi.mocked(emblaApi.selectedScrollSnap).mockReturnValue(4);
    emblaApi
      .containerNode()
      .dispatchEvent(new Event('frigate-card:carousel:force-select'));
    expect(mediaLoadedHandler).not.toBeCalled();

    vi.mocked(emblaApi.selectedScrollSnap).mockReturnValue(5);
    emblaApi
      .containerNode()
      .dispatchEvent(new Event('frigate-card:carousel:force-select'));
    expect(mediaLoadedHandler).toBeCalled();
  });
});
