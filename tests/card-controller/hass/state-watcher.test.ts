import { describe, expect, it, vi } from 'vitest';
import { StateWatcher } from '../../../src/card-controller/hass/state-watcher';
import { createHASS, createStateEntity } from '../../test-utils';

describe('StateWatcher', () => {
  it('should not subscribe with no entities', () => {
    const stateWatcher = new StateWatcher();
    const callback = vi.fn();
    expect(stateWatcher.subscribe(callback, [])).toBeFalsy();
  });

  it('should call back with state change', () => {
    const stateWatcher = new StateWatcher();
    const callback = vi.fn();
    expect(stateWatcher.subscribe(callback, ['binary_sensor.foo'])).toBeTruthy();
    expect(stateWatcher.subscribe(callback, ['binary_sensor.bar'])).toBeTruthy();

    stateWatcher.setHASS(
      null,
      createHASS({
        'binary_sensor.foo': createStateEntity({ state: 'on' }),
        'binary_sensor.bar': createStateEntity({ state: 'off' }),
      }),
    );

    expect(callback).not.toBeCalled();

    stateWatcher.setHASS(
      createHASS({
        'binary_sensor.foo': createStateEntity({ state: 'on' }),
        'binary_sensor.bar': createStateEntity({ state: 'off' }),
      }),
      createHASS({
        'binary_sensor.foo': createStateEntity({ state: 'on' }),
        'binary_sensor.bar': createStateEntity({ state: 'on' }),
      }),
    );

    expect(callback).toBeCalledTimes(1);
    expect(callback).toBeCalledWith(
      expect.objectContaining({
        entityID: 'binary_sensor.bar',
        oldState: createStateEntity({ state: 'off' }),
        newState: createStateEntity({ state: 'on' }),
      }),
    );
  });

  it('should not call back without state change', () => {
    const stateWatcher = new StateWatcher();
    const callback = vi.fn();
    expect(stateWatcher.subscribe(callback, ['binary_sensor.foo'])).toBeTruthy();

    stateWatcher.setHASS(
      null,
      createHASS({
        'binary_sensor.foo': createStateEntity({ state: 'on' }),
      }),
    );

    expect(callback).not.toBeCalled();

    stateWatcher.setHASS(
      createHASS({
        'binary_sensor.foo': createStateEntity({ state: 'on' }),
      }),
      createHASS({
        'binary_sensor.foo': createStateEntity({ state: 'on' }),
      }),
    );

    expect(callback).not.toBeCalled();
  });

  it('should not call back when unsubscribed', () => {
    const stateWatcher = new StateWatcher();
    const callback = vi.fn();
    expect(stateWatcher.subscribe(callback, ['binary_sensor.foo'])).toBeTruthy();
    expect(stateWatcher.unsubscribe(callback));

    stateWatcher.setHASS(
      null,
      createHASS({
        'binary_sensor.foo': createStateEntity({ state: 'on' }),
      }),
    );

    expect(callback).not.toBeCalled();

    stateWatcher.setHASS(
      createHASS({
        'binary_sensor.foo': createStateEntity({ state: 'on' }),
      }),
      createHASS({
        'binary_sensor.foo': createStateEntity({ state: 'off' }),
      }),
    );

    expect(callback).not.toBeCalled();
  });
});
