import { FrigateCardMediaPlayer } from '../types';
import { Timer } from './timer';

// The number of seconds to hide the video controls for after loading (in order
// to give a cleaner UI appearance, see:
// https://github.com/dermotduffy/frigate-hass-card/issues/856
export const MEDIA_LOAD_CONTROLS_HIDE_SECONDS = 2;
const MEDIA_SEEK_CONTROLS_HIDE_SECONDS = 1;

export type FrigateCardHTMLVideoElement = HTMLVideoElement & {
  _controlsHideTimer?: Timer;
};

/**
 * Sets the controls on a video and removes a timer that may have been added by
 * hideMediaControlsTemporarily.
 * @param video
 * @param value
 */
export const setControlsOnVideo = (
  video: FrigateCardHTMLVideoElement,
  value: boolean,
): void => {
  if (video._controlsHideTimer) {
    video._controlsHideTimer.stop();
    delete video._controlsHideTimer;
  }
  video.controls = value;
};

/**
 * Temporarily hide media controls.
 * @param element Any HTMLElement that has a controls property (e.g.
 * HTMLVideoElement, FrigateCardHaHlsPlayer)
 * @param seconds The number of seconds to hide the controls for.
 */
export const hideMediaControlsTemporarily = (
  video: FrigateCardHTMLVideoElement,
  seconds = MEDIA_SEEK_CONTROLS_HIDE_SECONDS,
): void => {
  const oldValue = video.controls;
  setControlsOnVideo(video, false);
  video._controlsHideTimer ??= new Timer();
  video._controlsHideTimer.start(seconds, () => {
    setControlsOnVideo(video, oldValue);
  });
};

/**
 * @param player The Frigate Card Media Player object.
 * @param video An underlying video or media player upon which to call play.
 */
export const playMediaMutingIfNecessary = async (
  player: FrigateCardMediaPlayer,
  video?: HTMLVideoElement | FrigateCardMediaPlayer,
): Promise<void> => {
  // If the play call fails, and the media is not already muted, mute it first
  // and then try again. This works around some browsers that prevent
  // auto-play unless the video is muted.
  if (video?.play) {
    try {
      await video.play();
    } catch (err: unknown) {
      if ((err as Error).name === 'NotAllowedError' && !player.isMuted()) {
        await player.mute();
        try {
          await video.play();
        } catch (_) {
          // Pass.
        }
      }
    }
  }
};
