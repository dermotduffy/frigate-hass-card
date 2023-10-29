import { describe, expect, it } from 'vitest';
import { FrigateCardPTZConfig, frigateCardPTZSchema } from '../../src/config/types';
import { hasUsablePTZ } from '../../src/utils/ptz';
import { createCameraCapabilities } from '../test-utils';

const createPTZConfig = (
  config?: Partial<FrigateCardPTZConfig>,
): FrigateCardPTZConfig => {
  return frigateCardPTZSchema.parse(config ?? {});
};

describe('hasUsablePTZ', () => {
  it('should return true with manual actions', () => {
    expect(
      hasUsablePTZ(
        createCameraCapabilities(),
        createPTZConfig({
          actions_left: {},
        }),
      ),
    ).toBeTruthy();
  });
  it('should return true with capabilities', () => {
    expect(
      hasUsablePTZ(
        createCameraCapabilities({
          ptz: {},
        }),
        createPTZConfig(),
      ),
    ).toBeTruthy();
  });
  it('should return false with manual actions or capabilities', () => {
    expect(hasUsablePTZ(createCameraCapabilities(), createPTZConfig())).toBeFalsy();
  });
});
