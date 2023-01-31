// The number of seconds to hide the video controls for after loading (in order
// to give a cleaner UI appearance, see:
// https://github.com/dermotduffy/frigate-hass-card/issues/856
export const MEDIA_LOAD_CONTROLS_HIDE_SECONDS = 2;
const MEDIA_SEEK_CONTROLS_HIDE_SECONDS = 1;

/**
 * Temporarily hide media controls.
 * @param element Any HTMLElement that has a controls property (e.g.
 * HTMLVideoElement, FrigateCardHaHlsPlayer)
 * @param seconds The number of seconds to hide the controls for.
 */
export const hideMediaControlsTemporarily = (
  element: HTMLElement & {
    controls: boolean;
    _controlsHideTimeoutID?: number;
  },
  seconds = MEDIA_SEEK_CONTROLS_HIDE_SECONDS,
): void => {
  element.controls = false;

  if (element._controlsHideTimeoutID) {
    window.clearTimeout(element._controlsHideTimeoutID);
  }
  element._controlsHideTimeoutID = window.setTimeout(() => {
    element.controls = true;
    delete element._controlsHideTimeoutID;
  }, seconds * 1000);
};
