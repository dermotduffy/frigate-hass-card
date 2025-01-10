import { describe, expect, it } from 'vitest';
import { isCompanionApp } from '../../src/utils/companion';

describe('isCompanionApp', () => {
  it('should return true for userAgent starting with "Home Assistant/"', () => {
    expect(isCompanionApp('Home Assistant/1.0')).toBe(true);
  });

  it('should return true for userAgent starting with "HomeAssistant/"', () => {
    expect(isCompanionApp('HomeAssistant/1.0')).toBe(true);
  });

  it('should return false for userAgent not starting with "Home Assistant/" or "HomeAssistant/"', () => {
    expect(isCompanionApp('Mozilla/5.0')).toBe(false);
  });

  it('should return false for an empty userAgent', () => {
    expect(isCompanionApp('')).toBe(false);
  });
});
