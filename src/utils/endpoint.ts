import { CameraEndpoint } from '../camera-manager/types';
import { dispatchErrorMessageEvent } from '../components/message';
import { localize } from '../localize/localize';
import { ExtendedHomeAssistant } from '../types';
import { errorToConsole } from './basic';
import { homeAssistantSignPath } from './ha';

export const getEndpointAddressOrDispatchError = async (
  element: HTMLElement,
  hass: ExtendedHomeAssistant,
  endpoint: CameraEndpoint,
  expires?: number,
): Promise<string | null> => {
  let address: string | null;
  if (!endpoint.sign) {
    address = endpoint.endpoint;
  } else {
    let response: string | null | undefined;
    try {
      response = await homeAssistantSignPath(hass, endpoint.endpoint, expires);
    } catch (e) {
      errorToConsole(e as Error);
      return null;
    }
    address = response ? response.replace(/^http/i, 'ws') : null;
  }

  if (!address) {
    dispatchErrorMessageEvent(element, localize('error.failed_sign'));
    return null;
  }
  return address;
};
