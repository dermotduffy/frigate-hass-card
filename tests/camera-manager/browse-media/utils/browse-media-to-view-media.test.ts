import { describe, expect, it } from 'vitest';
import { BrowseMediaMetadata } from '../../../../src/camera-manager/browse-media/types';
import { getViewMediaFromBrowseMediaArray } from '../../../../src/camera-manager/browse-media/utils/browse-media-to-view-media';
import {
  MEDIA_CLASS_IMAGE,
  MEDIA_CLASS_VIDEO,
  RichBrowseMedia,
} from '../../../../src/utils/ha/browse-media/types';
import { createBrowseMedia } from './test-utils';

const createBrowseMediaChildren = (
  overrides: Partial<RichBrowseMedia<BrowseMediaMetadata>>[],
) => {
  return overrides.map((override) => createBrowseMedia(override));
};

describe('getViewMediaFromBrowseMediaArray', () => {
  it('should ignore absent metadata', () => {
    const children = createBrowseMediaChildren([{ _metadata: undefined }]);
    expect(getViewMediaFromBrowseMediaArray(children)).toEqual([]);
  });

  it('should ignore unknown media class', () => {
    const children = createBrowseMediaChildren([{ media_class: 'UNKNOWN' }]);
    expect(getViewMediaFromBrowseMediaArray(children)).toEqual([]);
  });

  it('should generate clip view media', () => {
    const children = createBrowseMediaChildren([{ media_class: MEDIA_CLASS_VIDEO }]);
    const viewMedia = getViewMediaFromBrowseMediaArray(children);
    expect(viewMedia).toHaveLength(1);
    expect(viewMedia?.[0].getMediaType()).toBe('clip');
    expect(viewMedia?.[0].getID()).toBe('camera.test/2024-11-19 07:23:00');
  });

  it('should generate snapshot view media', () => {
    const children = createBrowseMediaChildren([{ media_class: MEDIA_CLASS_IMAGE }]);
    const viewMedia = getViewMediaFromBrowseMediaArray(children);
    expect(viewMedia).toHaveLength(1);
    expect(viewMedia?.[0].getMediaType()).toBe('snapshot');
    expect(viewMedia?.[0].getID()).toBe('camera.test/2024-11-19 07:23:00');
  });

  it('should de-duplicate snapshot/clip duplicates', () => {
    const children = createBrowseMediaChildren([
      { media_class: MEDIA_CLASS_IMAGE },
      { media_class: MEDIA_CLASS_IMAGE },
      { media_class: MEDIA_CLASS_VIDEO },
    ]);
    const viewMedia = getViewMediaFromBrowseMediaArray(children);
    expect(viewMedia).toHaveLength(1);
    expect(viewMedia?.[0].getMediaType()).toBe('clip');
    expect(viewMedia?.[0].getID()).toBe('camera.test/2024-11-19 07:23:00');
  });
});
