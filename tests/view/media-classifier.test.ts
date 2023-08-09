import { describe, expect, it } from 'vitest';
import { ViewMediaType } from '../../src/view/media';
import { ViewMediaClassifier } from '../../src/view/media-classifier';
import { TestViewMedia } from '../test-utils';

describe('ViewMediaClassifier', () => {
  describe('isEvent', () => {
    it.each([
      ['clip' as const, true],
      ['snapshot' as const, true],
      ['recording' as const, false],
    ])('%s', (mediaType: ViewMediaType, expectedResult: boolean) => {
      expect(
        ViewMediaClassifier.isEvent(new TestViewMedia({ mediaType: mediaType })),
      ).toBe(expectedResult);
    });
  });

  describe('isRecording', () => {
    it.each([
      ['clip' as const, false],
      ['snapshot' as const, false],
      ['recording' as const, true],
    ])('%s', (mediaType: ViewMediaType, expectedResult: boolean) => {
      expect(
        ViewMediaClassifier.isRecording(new TestViewMedia({ mediaType: mediaType })),
      ).toBe(expectedResult);
    });
  });

  describe('isClip', () => {
    it.each([
      ['clip' as const, true],
      ['snapshot' as const, false],
      ['recording' as const, false],
    ])('%s', (mediaType: ViewMediaType, expectedResult: boolean) => {
      expect(
        ViewMediaClassifier.isClip(new TestViewMedia({ mediaType: mediaType })),
      ).toBe(expectedResult);
    });
  });

  describe('isSnapshot', () => {
    it.each([
      ['clip' as const, false],
      ['snapshot' as const, true],
      ['recording' as const, false],
    ])('%s', (mediaType: ViewMediaType, expectedResult: boolean) => {
      expect(
        ViewMediaClassifier.isSnapshot(new TestViewMedia({ mediaType: mediaType })),
      ).toBe(expectedResult);
    });
  });

  describe('isVideo', () => {
    it.each([
      ['clip' as const, true],
      ['snapshot' as const, false],
      ['recording' as const, true],
    ])('%s', (mediaType: ViewMediaType, expectedResult: boolean) => {
      expect(
        ViewMediaClassifier.isVideo(new TestViewMedia({ mediaType: mediaType })),
      ).toBe(expectedResult);
    });
  });
});
