import { afterEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CardController } from '../../../../src/card-controller/controller';
import { WebkitFullScreenProvider } from '../../../../src/card-controller/fullscreen/webkit';
import { ConditionStateManager } from '../../../../src/conditions/state-manager';
import {
  AdvancedCameraCardMediaPlayer,
  WebkitHTMLVideoElement,
} from '../../../../src/types';
import { createCardAPI, createMediaLoadedInfo } from '../../../test-utils';

const createWebkitVideoElement = (): HTMLVideoElement &
  Partial<WebkitHTMLVideoElement> => {
  return document.createElement('video');
};

const setElement = (api: CardController, element: HTMLElement): void => {
  const player = mock<AdvancedCameraCardMediaPlayer>();
  player.getFullscreenElement.mockReturnValue(element);

  vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
    createMediaLoadedInfo({
      player: player,
    }),
  );
};

// @vitest-environment jsdom
describe('WebkitFullScreenProvider', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should connect', () => {
    const api = createCardAPI();
    const provider = new WebkitFullScreenProvider(api, vi.fn());

    provider.connect();

    expect(api.getConditionStateManager().addListener).toBeCalledWith(expect.anything());
  });

  it('should disconnect', () => {
    const api = createCardAPI();
    const provider = new WebkitFullScreenProvider(api, vi.fn());

    provider.disconnect();

    expect(api.getConditionStateManager().removeListener).toBeCalledWith(
      expect.anything(),
    );
  });

  describe('should return if in fullscreen', () => {
    it.each([[true], [false]])('%s', async (fullscreen: boolean) => {
      const api = createCardAPI();
      const provider = new WebkitFullScreenProvider(api, vi.fn());

      const element = createWebkitVideoElement();
      element.webkitDisplayingFullscreen = fullscreen;

      setElement(api, element);

      expect(provider.isInFullscreen()).toBe(fullscreen);
    });
  });

  describe('should return if supported', () => {
    it.each([[true], [false]])('%s', async (supported: boolean) => {
      const api = createCardAPI();
      const provider = new WebkitFullScreenProvider(api, vi.fn());

      const element = createWebkitVideoElement();
      element.webkitSupportsFullscreen = supported;

      setElement(api, element);

      expect(provider.isSupported()).toBe(supported);
    });
  });

  describe('should set fullscreen', () => {
    it('should request fullscreen if fullscreen is true', () => {
      const api = createCardAPI();
      const provider = new WebkitFullScreenProvider(api, vi.fn());

      const element = createWebkitVideoElement();
      element.webkitEnterFullscreen = vi.fn();
      element.webkitSupportsFullscreen = true;

      setElement(api, element);

      provider.setFullscreen(true);

      expect(element.webkitEnterFullscreen).toBeCalled();
    });

    it('should exit fullscreen if fullscreen is true', () => {
      const api = createCardAPI();
      const provider = new WebkitFullScreenProvider(api, vi.fn());

      const element = createWebkitVideoElement();
      element.webkitExitFullscreen = vi.fn();
      element.webkitSupportsFullscreen = true;

      setElement(api, element);

      provider.setFullscreen(false);

      expect(element.webkitExitFullscreen).toBeCalled();
    });

    it('should take no action if not supported', () => {
      const api = createCardAPI();
      const provider = new WebkitFullScreenProvider(api, vi.fn());

      const element = createWebkitVideoElement();
      element.webkitEnterFullscreen = vi.fn();
      element.webkitExitFullscreen = vi.fn();
      element.webkitSupportsFullscreen = false;

      setElement(api, element);

      provider.setFullscreen(true);
      provider.setFullscreen(false);

      expect(element.webkitEnterFullscreen).not.toBeCalled();
      expect(element.webkitExitFullscreen).not.toBeCalled();
    });

    it('should take no action if element is not a video', () => {
      const api = createCardAPI();
      const provider = new WebkitFullScreenProvider(api, vi.fn());

      const element = document.createElement('img') as HTMLImageElement &
        Partial<WebkitHTMLVideoElement>;
      element.webkitEnterFullscreen = vi.fn();
      element.webkitExitFullscreen = vi.fn();

      setElement(api, element);

      provider.setFullscreen(true);
      provider.setFullscreen(false);

      expect(element.webkitEnterFullscreen).not.toBeCalled();
      expect(element.webkitExitFullscreen).not.toBeCalled();
    });
  });

  describe('should handle state changes', () => {
    describe('should call handler when fullscreen state changes', () => {
      it.each([['webkitbeginfullscreen'], ['webkitendfullscreen']])(
        '%s',
        (event: string) => {
          const handler = vi.fn();
          const api = createCardAPI();
          const stateManager = new ConditionStateManager();
          vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

          const provider = new WebkitFullScreenProvider(api, handler);

          provider.connect();

          const element_1 = createWebkitVideoElement();
          const player_1 = mock<AdvancedCameraCardMediaPlayer>();
          player_1.getFullscreenElement.mockReturnValue(element_1);
          const mediaLoadedInfo_1 = createMediaLoadedInfo({ player: player_1 });

          stateManager.setState({ mediaLoadedInfo: mediaLoadedInfo_1 });

          element_1.dispatchEvent(new Event(event));

          expect(handler).toBeCalledTimes(1);

          const element_2 = createWebkitVideoElement();
          const player_2 = mock<AdvancedCameraCardMediaPlayer>();
          player_2.getFullscreenElement.mockReturnValue(element_2);
          const mediaLoadedInfo_2 = createMediaLoadedInfo({ player: player_2 });

          stateManager.setState({ mediaLoadedInfo: mediaLoadedInfo_2 });

          element_2.dispatchEvent(new Event(event));

          expect(handler).toBeCalledTimes(2);

          // Events on the old element should be ignored.
          element_1.dispatchEvent(new Event(event));

          expect(handler).toBeCalledTimes(2);

          // Test the media loaded info changing, but the player not changing.
          stateManager.setState({
            mediaLoadedInfo: { ...mediaLoadedInfo_2, width: 101 },
          });

          // Events on the new element should still be handled.
          element_2.dispatchEvent(new Event(event));

          expect(handler).toBeCalledTimes(3);
        },
      );
    });
  });

  it('should play the video after fullscreen ends', () => {
    vi.useFakeTimers();

    const handler = vi.fn();
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const provider = new WebkitFullScreenProvider(api, handler);

    provider.connect();

    const element = createWebkitVideoElement();
    element.play = vi.fn();

    setElement(api, element);

    const player = mock<AdvancedCameraCardMediaPlayer>();
    player.getFullscreenElement.mockReturnValue(element);
    const mediaLoadedInfo = createMediaLoadedInfo({ player });

    stateManager.setState({ mediaLoadedInfo });

    element.dispatchEvent(new Event('webkitendfullscreen'));

    expect(element.play).not.toBeCalled();

    vi.runOnlyPendingTimers();

    expect(element.play).toBeCalled();
  });
});
