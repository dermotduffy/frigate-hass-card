import { describe, expect, it } from 'vitest';
import { Initializer } from '../../src/utils/initializer/initializer';

describe('Initializer', () => {
  it('should initialize with initializer', async () => {
    const initializer = new Initializer();

    expect(initializer.isInitialized('foo')).toBeFalsy();
    expect(
      await initializer.initializeIfNecessary('foo', async () => true),
    ).toBeTruthy();
    expect(initializer.isInitialized('foo')).toBeTruthy();
  });

  it('should initialize without initializer', async () => {
    const initializer = new Initializer();

    expect(initializer.isInitialized('foo')).toBeFalsy();
    expect(
      await initializer.initializeIfNecessary('foo', async () => true),
    ).toBeTruthy();
    expect(initializer.isInitialized('foo')).toBeTruthy();
  });

  it('should initialize when already initialized', async () => {
    const initializer = new Initializer();

    expect(initializer.isInitialized('foo')).toBeFalsy();
    expect(
      await initializer.initializeIfNecessary('foo', async () => true),
    ).toBeTruthy();
    expect(
      await initializer.initializeIfNecessary('foo', async () => true),
    ).toBeTruthy();
    expect(initializer.isInitialized('foo')).toBeTruthy();
  });

  it('should not initialize with failed initializer', async () => {
    const initializer = new Initializer();

    expect(initializer.isInitialized('foo')).toBeFalsy();
    expect(
      await initializer.initializeIfNecessary('foo', async () => false),
    ).toBeFalsy();
    expect(initializer.isInitialized('foo')).toBeFalsy();
  });

  it('should initialize multiple', async () => {
    const initializer = new Initializer();

    expect(initializer.isInitializedMultiple(['foo', 'bar'])).toBeFalsy();
    expect(
      await initializer.initializeMultipleIfNecessary({
        foo: async () => true,
        bar: async () => false,
      }),
    ).toBeFalsy();

    expect(initializer.isInitializedMultiple(['foo', 'bar'])).toBeFalsy();

    expect(
      await initializer.initializeMultipleIfNecessary({
        bar: async () => true,
      }),
    ).toBeTruthy();

    expect(initializer.isInitializedMultiple(['foo', 'bar'])).toBeTruthy();
  });

  it('should uninitialize', async () => {
    const initializer = new Initializer();
    await initializer.initializeIfNecessary('foo');
    expect(initializer.isInitialized('foo')).toBeTruthy();

    initializer.uninitialize('foo');

    expect(initializer.isInitialized('foo')).toBeFalsy();
  });
});
