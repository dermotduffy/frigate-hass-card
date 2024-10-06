import { z } from 'zod';

const deviceSchema = z.object({
  id: z.string(),
  model: z.string().nullable(),
  config_entries: z.string().array(),
  manufacturer: z.string().nullable(),
});
export type Device = z.infer<typeof deviceSchema>;

export const deviceListSchema = deviceSchema.array();
export type DeviceList = z.infer<typeof deviceListSchema>;
