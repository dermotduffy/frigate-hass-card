import { HomeAssistant } from 'custom-card-helpers';
import { z } from 'zod';
import { homeAssistantWSRequest } from '.';

const deviceSchema = z.object({
  model: z.string().nullable(),
  config_entries: z.string().array(),
  manufacturer: z.string().nullable(),
})
const deviceListSchema = deviceSchema.array();
export type DeviceList = z.infer<typeof deviceListSchema>;

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
