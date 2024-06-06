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
    return z.ZodArray.create(deepRemoveDefaults(schema.element))
      .min(schema._def.minLength?.value, schema._def.minLength?.message)
      .max(schema._def.maxLength?.value, schema._def.maxLength?.message)
      .length(schema._def.exactLength?.value, schema._def.exactLength?.message);
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

/**
 * Get configuration parse errors.
 * @param error The ZodError object from parsing.
 * @returns An array of string error paths.
 */
export const getParseErrorPaths = <T>(error: z.ZodError<T>): Set<string> => {
  /* Zod errors involving unions are complex, as Zod may not be able to tell
   * where the 'real' error is vs simply a union option not matching. This
   * function finds all ZodError "issues" that don't have an error with 'type'
   * in that object ('type' is the union discriminator for picture elements,
   * the major union in the schema). An array of user-readable error
   * locations is returned, or an empty list if none is available. None being
   * available suggests the configuration has an error, but we can't tell
   * exactly why (or rather Zod simply says it doesn't match any of the
   * available unions). This usually suggests the user specified an incorrect
   * type name entirely. */
  const contenders = new Set<string>();
  if (error.issues.length) {
    for (const issue of error.issues) {
      if (issue.code === 'invalid_union') {
        const unionErrors = (issue as z.ZodInvalidUnionIssue).unionErrors;
        for (const unionError of unionErrors) {
          getParseErrorPaths(unionError).forEach(contenders.add, contenders);
        }
      } else {
        contenders.add(getParseErrorPathString(issue.path));
      }
    }
  }
  return contenders;
};

/**
 * Convert an array of strings and indices into a more user readable string,
 * e.g. [a, 1, b, 2] => 'a[1] -> b[2]'
 * @param path An array of strings and numbers.
 * @returns A single string.
 */
const getParseErrorPathString = (path: (string | number)[]): string => {
  let out = '';
  for (let i = 0; i < path.length; i++) {
    const item = path[i];
    if (typeof item == 'number') {
      out += '[' + item + ']';
    } else if (out) {
      out += ' -> ' + item;
    } else {
      out = item;
    }
  }
  return out;
};
