import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getEntityIcon,
  hasHAConnectionStateChanged,
  parseStateChangeTrigger,
  subscribeToTrigger,
} from '../../../src/utils/ha/index.js';
import { createHASS, createStateEntity } from '../../test-utils.js';

const createConnected = (connected: boolean): HomeAssistant => {
  const hass = createHASS();
  hass.connected = connected;
  return hass;
};

describe('hasHAConnectionStateChanged', () => {
  it('initially connected', () => {
    expect(hasHAConnectionStateChanged(null, createConnected(true))).toBeTruthy();
  });
  it('initially disconnected', () => {
    expect(hasHAConnectionStateChanged(null, createConnected(false))).toBeTruthy();
  });
  it('disconnected', () => {
    expect(
      hasHAConnectionStateChanged(createConnected(true), createConnected(false)),
    ).toBeTruthy();
  });
  it('disconnected via absence', () => {
    expect(hasHAConnectionStateChanged(createConnected(true), null)).toBeTruthy();
  });
  it('connected', () => {
    expect(
      hasHAConnectionStateChanged(createConnected(false), createConnected(true)),
    ).toBeTruthy();
  });
  it('still disconnected', () => {
    expect(
      hasHAConnectionStateChanged(createConnected(false), createConnected(false)),
    ).toBeFalsy();
  });
  it('still connected', () => {
    expect(
      hasHAConnectionStateChanged(createConnected(true), createConnected(true)),
    ).toBeFalsy();
  });
  it('still absent', () => {
    expect(hasHAConnectionStateChanged(null, null)).toBeFalsy();
  });
});

describe('getEntityIcon', () => {
  it('should get icon from attributes', () => {
    expect(
      getEntityIcon(
        createHASS({
          'camera.test': createStateEntity({
            attributes: {
              icon: 'mdi:cow',
            },
          }),
        }),
        'camera.test',
      ),
    ).toBe('mdi:cow');
  });

  it('should get icon from domain', () => {
    expect(getEntityIcon(createHASS(), 'camera.test')).toBe('mdi:video');
  });
});

describe('should subscribe to trigger', () => {
  it('mqtt', async () => {
    const hass = createHASS();
    const callback = vi.fn();

    await subscribeToTrigger(hass, callback, {
      platform: 'mqtt',
      topic: 'topic',
      payload: 'payload',
      valueTemplate: 'value_template',
    });

    expect(hass.connection.subscribeMessage).toBeCalledWith(callback, {
      type: 'subscribe_trigger',
      trigger: {
        platform: 'mqtt',
        topic: 'topic',
        payload: 'payload',
        value_template: 'value_template',
      },
    });
  });

  it('state and attributes', async () => {
    const hass = createHASS();
    const callback = vi.fn();

    await subscribeToTrigger(hass, callback, {
      platform: 'state',
      entityID: 'camera.foo',
    });

    expect(hass.connection.subscribeMessage).toBeCalledWith(callback, {
      type: 'subscribe_trigger',
      trigger: {
        platform: 'state',
        entity_id: 'camera.foo',
      },
    });
  });

  it('state only', async () => {
    const hass = createHASS();
    const callback = vi.fn();

    await subscribeToTrigger(hass, callback, {
      platform: 'state',
      entityID: 'camera.foo',
      stateOnly: true,
    });

    expect(hass.connection.subscribeMessage).toBeCalledWith(callback, {
      type: 'subscribe_trigger',
      trigger: {
        platform: 'state',
        entity_id: 'camera.foo',
        from: null,
        to: null,
      },
    });
  });
});

describe('should parse state change response', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('malformed response', async () => {
    const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

    expect(parseStateChangeTrigger('INVALID')).toBeNull();

    expect(consoleSpy).toBeCalledWith('Ignoring unparseable HA state change', 'INVALID');
  });

  it('valid response', async () => {
    const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

    const stateChange = {
      from_state: {
        entity_id: 'camera.foo',
        state: 'off',
      },
      to_state: {
        entity_id: 'camera.foo',
        state: 'on',
      },
    };

    expect(
      parseStateChangeTrigger({
        variables: {
          trigger: stateChange,
        },
      }),
    ).toEqual(stateChange);

    expect(consoleSpy).not.toBeCalled();
  });
});
