import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { homeAssistantWSRequest } from '../..';
import { DeviceList, deviceListSchema } from './types';

/**
 * Get a list of all entities from the entity registry. May throw.
 * @param hass The Home Assistant object.
 * @returns An entity list object.
 */
export const getAllDevices = async (hass: HomeAssistant): Promise<DeviceList> => {
  return await homeAssistantWSRequest<DeviceList>(hass, deviceListSchema, {
    type: 'config/device_registry/list',
  });
};
