import { z } from 'zod';

export const entitySchema = z.object({
  config_entry_id: z.string().nullable(),
  disabled_by: z.string().nullable(),
  entity_id: z.string(),
  hidden_by: z.string().nullable(),
  platform: z.string(),
  translation_key: z.string().nullable(),
  unique_id: z.string().optional(),
});
export type Entity = z.infer<typeof entitySchema>;

export const entityListSchema = entitySchema.array();
export type EntityList = z.infer<typeof entityListSchema>;
