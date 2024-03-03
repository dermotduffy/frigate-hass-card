import { z } from 'zod';

export type SubscriptionUnsubscribe = () => Promise<void>;
export type SubscriptionCallback = (data: unknown) => void;

const haStateChangeSchema = z.object({
  entity_id: z.string(),
  state: z.string(),
});

const haStateChangeFromToSchema = z.object({
  from_state: haStateChangeSchema,
  to_state: haStateChangeSchema,
});
export type HAStateChangeFromTo = z.infer<typeof haStateChangeFromToSchema>;

export const haStateChangeTriggerResponseSchema = z.object({
  variables: z.object({
    trigger: haStateChangeFromToSchema,
  }),
});
