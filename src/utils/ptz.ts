import { CameraManagerCameraCapabilities } from '../camera-manager/types';
import { FrigateCardPTZConfig, PTZ_CONTROL_ACTIONS } from '../config/types';

export const hasUsablePTZ = (
  capabilities: CameraManagerCameraCapabilities | null,
  config: FrigateCardPTZConfig,
): boolean => {
  for (const actionName of PTZ_CONTROL_ACTIONS) {
    if ('actions_' + actionName in config) {
      return true;
    }
  }
  return !!capabilities?.ptz;
};
