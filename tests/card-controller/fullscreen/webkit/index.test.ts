import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
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

const createPlayer = (element: HTMLElement): AdvancedCameraCardMediaPlayer => {
  const player = mock<AdvancedCameraCardMediaPlayer>();
  player.getFullscreenElement.mockReturnValue(element);
  return player;
};

// @vitest-environment jsdom
describe('WebkitFullScreenProvider', () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
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

      const player = createPlayer(element);
      vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
        createMediaLoadedInfo({
          player: player,
        }),
      );

      expect(provider.isInFullscreen()).toBe(fullscreen);
    });
  });

  describe('should return if supported', () => {
    it.each([[true], [false]])('%s', async (supported: boolean) => {
      const api = createCardAPI();
      const provider = new WebkitFullScreenProvider(api, vi.fn());

      const element = createWebkitVideoElement();
      element.webkitSupportsFullscreen = supported;

      const player = createPlayer(element);
      vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
        createMediaLoadedInfo({
          player: player,
        }),
      );

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

      const player = createPlayer(element);
      vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
        createMediaLoadedInfo({
          player: player,
        }),
      );

      provider.setFullscreen(true);

      expect(element.webkitEnterFullscreen).toBeCalled();
    });

    it('should exit fullscreen if fullscreen is true', () => {
      const api = createCardAPI();
      const provider = new WebkitFullScreenProvider(api, vi.fn());

      const element = createWebkitVideoElement();
      element.webkitExitFullscreen = vi.fn();
      element.webkitSupportsFullscreen = true;

      const player = createPlayer(element);
      vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
        createMediaLoadedInfo({
          player: player,
        }),
      );

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

      const player = createPlayer(element);
      vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
        createMediaLoadedInfo({
          player: player,
        }),
      );

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

      const player = createPlayer(element);
      vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
        createMediaLoadedInfo({
          player: player,
        }),
      );

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
    const handler = vi.fn();
    const api = createCardAPI();
    const stateManager = new ConditionStateManager();
    vi.mocked(api.getConditionStateManager).mockReturnValue(stateManager);

    const provider = new WebkitFullScreenProvider(api, handler);

    provider.connect();

    const element = createWebkitVideoElement();
    element.play = vi.fn();

    const player = createPlayer(element);
    vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
      createMediaLoadedInfo({
        player: player,
      }),
    );

    const mediaLoadedInfo = createMediaLoadedInfo({ player });

    stateManager.setState({ mediaLoadedInfo });

    element.dispatchEvent(new Event('webkitendfullscreen'));

    expect(element.play).not.toBeCalled();

    vi.runOnlyPendingTimers();

    expect(element.play).toBeCalled();
  });
});
