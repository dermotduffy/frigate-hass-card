import { describe, expect, it } from 'vitest';
import { z, ZodError } from 'zod';
import {
  deepRemoveDefaults,
  getParseErrorKeys,
  getParseErrorPaths,
} from '../../src/utils/zod';

describe('deepRemoveDefaults', () => {
  it('should remove string defaults', () => {
    const schema = z.object({
      string: z.string().default('foo'),
    });
    const result = deepRemoveDefaults(schema).parse({});
    expect(result.string).toBeUndefined();
  });
  it('should remove array defaults', () => {
    const schema = z.object({
      array: z.string().array().default(['foo']),
    });
    const result = deepRemoveDefaults(schema).parse({});
    expect(result.array).toBeUndefined();
  });
  it('should remove optional defaults', () => {
    const schema = z.object({
      string: z.string().default('foo').optional(),
    });
    const result = deepRemoveDefaults(schema).parse({});
    expect(result.string).toBeUndefined();
  });
  it('should remove null defaults', () => {
    const schema = z.object({
      null: z.string().default('foo').nullable(),
    });
    const result = deepRemoveDefaults(schema).parse({});
    expect(result.null).toBeUndefined();
  });
  it('should remove null defaults', () => {
    const schema = z.object({
      tuple: z.tuple([z.string()]).default(['foo']),
    });
    const result = deepRemoveDefaults(schema).parse({});
    expect(result.tuple).toBeUndefined();
  });
  it('should not interfere with parsing', () => {
    const schema = z.object({
      string: z.string().default('foo'),
    });
    const result = deepRemoveDefaults(schema).parse({ string: 'moo' });
    expect(result.string).toBe('moo');
  });
  describe('should still enforce array length', () => {
    it('min', () => {
      const schema = z.number().array().min(1);
      const result = deepRemoveDefaults(schema).safeParse([]);
      expect(result.success).toBeFalsy();
    });
    it('max', () => {
      const schema = z.number().array().max(1);
      const result = deepRemoveDefaults(schema).safeParse([1, 2]);
      expect(result.success).toBeFalsy();
    });
    it('exact', () => {
      const schema = z.number().array().length(1);
      const result = deepRemoveDefaults(schema).safeParse([]);
      expect(result.success).toBeFalsy();
    });
  });
});

describe('getParseErrorKeys', () => {
  it('should get error keys', () => {
    const result = z.object({ required: z.string() }).safeParse({});
    expect(result.success).toBeFalsy();
    if (result.success) {
      return;
    }
    expect(getParseErrorKeys(result.error)).toEqual(['required']);
  });
});

describe('getParseErrorPaths', () => {
  it('should get simple error paths', () => {
    const result = z.object({ required: z.string() }).safeParse({});
    expect(result.success).toBeFalsy();
    if (result.success) {
      return;
    }
    expect(getParseErrorPaths(result.error)).toEqual(new Set(['required']));
  });
  it('should get union error paths', () => {
    const type_one = z.object({ type: z.string(), data: z.string() });
    const type_two = z.object({ type: z.literal('two'), data: z.string() });

    const schema = z.object({
      array: type_one.or(type_two).array(),
    });

    const result = schema.safeParse({ array: [{}] });
    expect(result.success).toBeFalsy();
    if (result.success) {
      return;
    }
    expect(getParseErrorPaths(result.error)).toEqual(
      new Set(['array[0] -> type', 'array[0] -> data']),
    );
  });
  it('should get no paths for empty error', () => {
    expect(getParseErrorPaths(new ZodError([]))).toEqual(new Set());
  });
});
