import { describe, expect, it, vi } from 'vitest';
import {
  capEndDate,
  convertRangeToCacheFriendlyTimes,
  getCameraEntityFromConfig,
  sortMedia,
} from '../../src/camera-manager/util.js';
import { CameraConfig, cameraConfigSchema } from '../../src/types.js';
import { ViewMedia, ViewMediaType } from '../../src/view/media.js';
import { TestViewMedia } from '../test-utils.js';

describe('convertRangeToCacheFriendlyTimes', () => {
  it('should return cache friendly within hour range', () => {
    expect(
      convertRangeToCacheFriendlyTimes({
        start: new Date('2023-04-29T14:01:02'),
        end: new Date('2023-04-29T14:11:03'),
      }),
    ).toEqual({
      start: new Date('2023-04-29T14:00:00'),
      end: new Date('2023-04-29T14:59:59.999'),
    });
  });

  it('should return cache friendly within day range', () => {
    expect(
      convertRangeToCacheFriendlyTimes({
        start: new Date('2023-04-29T14:01:02'),
        end: new Date('2023-04-29T15:11:03'),
      }),
    ).toEqual({
      start: new Date('2023-04-29T00:00:00'),
      end: new Date('2023-04-29T23:59:59.999'),
    });
  });

  it('should cap end date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-04-29T14:25'));
    expect(
      convertRangeToCacheFriendlyTimes(
        {
          start: new Date('2023-04-29T14:01:02'),
          end: new Date('2023-04-29T14:11:03'),
        },
        { endCap: true },
      ),
    ).toEqual({
      start: new Date('2023-04-29T14:00:00'),
      end: new Date('2023-04-29T14:25:59.999'),
    });
    vi.useRealTimers();
  });
});

describe('capEndDate', () => {
  it('should cap end date', () => {
    const fakeNow = new Date('2023-04-29T14:25');
    vi.useFakeTimers();
    vi.setSystemTime(fakeNow);

    expect(capEndDate(new Date('2023-04-29T15:02'))).toEqual(fakeNow);

    vi.useRealTimers();
  });

  it('should not cap end date', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2023-04-29T14:25'));

    const testDate = new Date('2023-04-29T14:24');
    expect(capEndDate(testDate)).toEqual(testDate);

    vi.useRealTimers();
  });
});

describe('sortMedia', () => {
  const media_1 = new TestViewMedia(
    'id-1',
    new Date('2023-04-29T14:25'),
    'clip',
    'camera-1',
  );
  const media_2 = new TestViewMedia(
    'id-2',
    new Date('2023-04-29T14:26'),
    'clip',
    'camera-1',
  );
  const media_3_dup_id = new TestViewMedia(
    'id-2',
    new Date('2023-04-29T14:26'),
    'clip',
    'camera-1',
  );
  const media_4_no_id = new TestViewMedia(
    null,
    new Date('2023-04-29T14:27'),
    'clip',
    'camera-1',
  );

  it('should sort sorted media', () => {
    const media = [media_1, media_2];
    expect(sortMedia(media)).toEqual(media);
  });
  it('should sort unsorted media', () => {
    expect(sortMedia([media_2, media_1])).toEqual([media_1, media_2]);
  });
  it('should remove duplicate id', () => {
    expect(sortMedia([media_1, media_2, media_3_dup_id])).toEqual([media_1, media_2]);
  });
  it('should remove de-duplicate by object if no id', () => {
    expect(sortMedia([media_1, media_2, media_4_no_id, media_4_no_id])).toEqual([
      media_1,
      media_2,
      media_4_no_id,
    ]);
  });
});

describe('getCameraEntityFromConfig', () => {
  const createCameraConfig = (config: Partial<CameraConfig>): CameraConfig => {
    return cameraConfigSchema.parse(config);
  };

  it('should get camera_entity', () => {
    expect(getCameraEntityFromConfig(createCameraConfig({ camera_entity: 'foo' }))).toBe(
      'foo',
    );
  });
  it('should get camera_entity from webrtc_card config', () => {
    expect(
      getCameraEntityFromConfig(createCameraConfig({ webrtc_card: { entity: 'bar' } })),
    ).toBe('bar');
  });
  it('should get no camera_entity', () => {
    expect(getCameraEntityFromConfig(createCameraConfig({}))).toBeNull();
  });
});
