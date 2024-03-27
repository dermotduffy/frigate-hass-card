import { Capabilities } from '../camera-manager/capabilities';
import { FrigateCardPTZConfig, PTZ_CONTROL_ACTIONS } from '../config/types';

export const hasUsablePTZ = (
  capabilities: Capabilities | null,
  config: FrigateCardPTZConfig,
): boolean => {
  for (const actionName of PTZ_CONTROL_ACTIONS) {
    if ('actions_' + actionName in config) {
      return true;
    }
  }
  const ptzCapabilities = capabilities?.getPTZCapabilities();
  return (
    !!ptzCapabilities?.panTilt?.length ||
    !!ptzCapabilities?.zoom?.length ||
    !!ptzCapabilities?.presets?.length
  );
};
