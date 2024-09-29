import { describe, expect, it } from 'vitest';
import { RegistryCache } from '../../../../src/utils/ha/registry/cache';

interface TestCacheValue {
  id: string;
  val?: number;
}

describe('RegistryCache', () => {
  describe('has', () => {
    it('positive', () => {
      const cache = new RegistryCache<TestCacheValue>((arg) => arg.id);
      cache.add({ id: 'test' });
      expect(cache.has('test')).toBeTruthy();
    });

    it('negative', () => {
      const cache = new RegistryCache<TestCacheValue>((arg) => arg.id);
      cache.add({ id: 'test' });
      expect(cache.has('absent')).toBeFalsy();
    });
  });

  it('getMatches', () => {
    const cache = new RegistryCache<TestCacheValue>((arg) => arg.id);
    cache.add([
      { id: 'test-1', val: 1 },
      { id: 'test-5', val: 5 },
      { id: 'test-8', val: 8 },
    ]);
    expect(cache.getMatches((obj) => !!obj.val && obj.val >= 5)).toEqual([
      { id: 'test-5', val: 5 },
      { id: 'test-8', val: 8 },
    ]);
  });

  describe('get', () => {
    it('positive', () => {
      const cache = new RegistryCache<TestCacheValue>((arg) => arg.id);
      cache.add({ id: 'test', val: 42 });
      expect(cache.get('test')).toEqual({ id: 'test', val: 42 });
    });

    it('negative', () => {
      const cache = new RegistryCache<TestCacheValue>((arg) => arg.id);
      expect(cache.get('test')).toBeNull();
    });
  });
});
