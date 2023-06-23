import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { FrigateCardMediaPlayer } from '../../src/types.js';
import {
  FrigateCardHTMLVideoElement,
  hideMediaControlsTemporarily,
  playMediaMutingIfNecessary,
  setControlsOnVideo,
} from '../../src/utils/media.js';

// @vitest-environment jsdom
describe('setControlsOnVideo', () => {
  it('should set controls', () => {
    const video = document.createElement('video');

    setControlsOnVideo(video, false);
    expect(video.controls).toBeFalsy();
  });

  it('should stop timer', () => {
    const video: FrigateCardHTMLVideoElement = document.createElement('video');
    hideMediaControlsTemporarily(video);

    expect(video._controlsHideTimer).toBeTruthy();
    expect(video._controlsHideTimer?.isRunning()).toBeTruthy();

    setControlsOnVideo(video, false);
    expect(video.controls).toBeFalsy();
    expect(video._controlsHideTimer).toBeFalsy();
  });
});

describe('hideMediaControlsTemporarily', () => {
  beforeAll(() => {
    vi.useFakeTimers();
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('should set controls', () => {
    const video: FrigateCardHTMLVideoElement = document.createElement('video');
    video.controls = true;
    hideMediaControlsTemporarily(video);

    expect(video.controls).toBeFalsy();
    vi.runOnlyPendingTimers();

    expect(video.controls).toBeTruthy();
    expect(video._controlsHideTimer).toBeFalsy();
  });
});

class NotAllowedError extends Error {
  name = 'NotAllowedError';
}

describe('playMediaMutingIfNecessary', () => {
  it('should play', async () => {
    const player = mock<FrigateCardMediaPlayer>();
    const video = mock<HTMLVideoElement>();
    video.play.mockResolvedValue();
    await playMediaMutingIfNecessary(player, video);
    expect(video.play).toBeCalled();
  });

  it('should mute if not allowed to play and unmuted', async () => {
    const player = mock<FrigateCardMediaPlayer>();
    player.isMuted.mockReturnValue(false);
    player.mute.mockResolvedValue();

    const video = mock<HTMLVideoElement>();
    video.play.mockRejectedValueOnce(new NotAllowedError()).mockResolvedValueOnce();

    await playMediaMutingIfNecessary(player, video);

    expect(video.play).toBeCalledTimes(2);
    expect(player.isMuted).toBeCalled();
    expect(player.mute).toBeCalled();
  });

  it('should not mute if not allowed to play and already unmuted', async () => {
    const player = mock<FrigateCardMediaPlayer>();
    player.isMuted.mockReturnValue(true);

    const video = mock<HTMLVideoElement>();
    video.play.mockRejectedValueOnce(new NotAllowedError());

    await playMediaMutingIfNecessary(player, video);

    expect(video.play).toBeCalledTimes(1);
    expect(player.isMuted).toBeCalled();
    expect(player.mute).not.toBeCalled();
  });

  it('should ignore exception if subsequent play call throws', async () => {
    const player = mock<FrigateCardMediaPlayer>();
    player.isMuted.mockReturnValue(false);

    const video = mock<HTMLVideoElement>();
    video.play.mockRejectedValue(new NotAllowedError());

    await playMediaMutingIfNecessary(player, video);

    expect(video.play).toBeCalledTimes(2);
    expect(player.isMuted).toBeCalled();
    expect(player.mute).toBeCalled();
  });
});
