import { CameraEndpoint } from '../camera-manager/types';
import { ExtendedHomeAssistant } from '../types';
import { errorToConsole } from './basic';
import { homeAssistantSignPath } from './ha';

export const convertEndpointAddressToSignedWebsocket = async (
  hass: ExtendedHomeAssistant,
  endpoint: CameraEndpoint,
  expires?: number,
): Promise<string | null> => {
  if (!endpoint.sign) {
    return endpoint.endpoint;
  }

  let response: string | null | undefined;
  try {
    response = await homeAssistantSignPath(hass, endpoint.endpoint, expires);
  } catch (e) {
    errorToConsole(e as Error);
  }

  return response ? response.replace(/^http/i, 'ws') : null;
};
