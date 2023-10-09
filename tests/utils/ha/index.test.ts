import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { describe, expect, it } from 'vitest';
import {
  getEntityIcon,
  hasHAConnectionStateChanged,
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
