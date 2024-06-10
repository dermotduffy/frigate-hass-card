import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { HassEntity } from 'home-assistant-js-websocket';
import { CameraConfig } from '../config/types.js';
import { dispatchErrorMessageEvent } from '../components/message.js';
import { localize } from '../localize/localize.js';

/**
 * Get the state object or dispatch an error. Used in `ha` and `image` live
 * providers.
 * @param element HTMLElement to dispatch errors from.
 * @param hass Home Assistant object.
 * @param cameraConfig Camera configuration.
 * @returns
 */
export const getStateObjOrDispatchError = (
  element: HTMLElement,
  hass: HomeAssistant,
  cameraConfig?: CameraConfig,
): HassEntity | null => {
  if (!cameraConfig?.camera_entity) {
    dispatchErrorMessageEvent(element, localize('error.no_live_camera'), {
      context: cameraConfig,
    });
    return null;
  }

  const stateObj = hass.states[cameraConfig.camera_entity];
  if (!stateObj) {
    dispatchErrorMessageEvent(element, localize('error.live_camera_not_found'), {
      context: cameraConfig,
    });
    return null;
  }

  return stateObj;
};
