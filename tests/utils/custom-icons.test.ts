import { describe, expect, it } from 'vitest';
import frigateSVG from '../../src/camera-manager/frigate/assets/frigate.svg';
import motioneyeSVG from '../../src/camera-manager/motioneye/assets/motioneye.svg';
import { getCustomIconURL } from '../../src/utils/custom-icons';

describe('getCustomIconURL', () => {
  it('should return frigate SVG for frigate icon', () => {
    expect(getCustomIconURL('frigate')).toBe(frigateSVG);
  });

  it('should return motioneye SVG for motioneye icon', () => {
    expect(getCustomIconURL('motioneye')).toBe(motioneyeSVG);
  });

  it('should return null for mdi icon', () => {
    expect(getCustomIconURL('mdi:car')).toBeNull();
  });

  it('should return null for undefined icon', () => {
    expect(getCustomIconURL()).toBeNull();
  });
});
