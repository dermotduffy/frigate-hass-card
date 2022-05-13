import { z } from 'zod';

/**
 * Recursively remove defaults from a zod schema.
 *
 * See: https://github.com/colinhacks/zod/discussions/845#discussioncomment-1936943
 *
 * @param schema The Zod schema.
 * @returns A new Zod schema.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepRemoveDefaults<T extends z.ZodTypeAny>(schema: T): any {
  if (schema instanceof z.ZodDefault) {
    return deepRemoveDefaults(schema.removeDefault());
  }

  if (schema instanceof z.ZodObject) {
    const newShape = {};

    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = z.ZodOptional.create(deepRemoveDefaults(fieldSchema));
    }
    return new z.ZodObject({
      ...schema._def,
      shape: () => newShape,
    });
  }

  if (schema instanceof z.ZodArray) {
    return z.ZodArray.create(deepRemoveDefaults(schema.element));
  }

  if (schema instanceof z.ZodOptional) {
    return z.ZodOptional.create(deepRemoveDefaults(schema.unwrap()));
  }

  if (schema instanceof z.ZodNullable) {
    return z.ZodNullable.create(deepRemoveDefaults(schema.unwrap()));
  }

  if (schema instanceof z.ZodTuple) {
    return z.ZodTuple.create(
      schema.items.map((item: z.ZodTypeAny) => deepRemoveDefaults(item)),
    );
  }
  return schema;
}

/**
 * Get the keys that didn't parse from a ZodError.
 * @param error The zoderror to extract the keys from.
 * @returns An array of error keys.
 */
export function getParseErrorKeys<T>(error: z.ZodError<T>): string[] {
  const errors = error.format();
  return Object.keys(errors).filter((v) => !v.startsWith('_'));
}
