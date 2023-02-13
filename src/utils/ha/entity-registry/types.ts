import { z } from 'zod';

const entitySchema = z.object({
  config_entry_id: z.string().nullable(),
  disabled_by: z.string().nullable(),
  entity_id: z.string(),
  hidden_by: z.string().nullable(),
  platform: z.string(),
});
export type Entity = z.infer<typeof entitySchema>;

export const extendedEntitySchema = entitySchema.extend({
  // Extended entity results.
  unique_id: z.string().optional(),
});
export type ExtendedEntity = z.infer<typeof extendedEntitySchema>;

export const entityListSchema = entitySchema.array();
export type EntityList = z.infer<typeof entityListSchema>;
