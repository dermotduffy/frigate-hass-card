import { describe, expect, it } from 'vitest';
import { sortMedia } from '../../../src/camera-manager/utils/sort-media.js';
import { TestViewMedia } from '../../test-utils.js';

describe('sortMedia', () => {
  const media_1 = new TestViewMedia({
    id: 'id-1',
    startTime: new Date('2023-04-29T14:25'),
    cameraID: 'camera-1',
  });
  const media_2 = new TestViewMedia({
    id: 'id-2',
    startTime: new Date('2023-04-29T14:26'),
    cameraID: 'camera-1',
  });
  const media_3_dup_id = new TestViewMedia({
    id: 'id-2',
    startTime: new Date('2023-04-29T14:26'),
    cameraID: 'camera-1',
  });
  const media_4_no_id = new TestViewMedia({
    id: null,
    startTime: new Date('2023-04-29T14:27'),
    cameraID: 'camera-1',
  });

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
  it('should sort by id when time not available', () => {
    expect(
      sortMedia([
        new TestViewMedia({ id: 'snake' }),
        new TestViewMedia({ id: 'zebra' }),
        new TestViewMedia({ id: 'aardvark' }),
      ]),
    ).toEqual([
      new TestViewMedia({ id: 'aardvark' }),
      new TestViewMedia({ id: 'snake' }),
      new TestViewMedia({ id: 'zebra' }),
    ]);
  });
  it('should remove de-duplicate by object if no id', () => {
    expect(sortMedia([media_1, media_2, media_4_no_id, media_4_no_id])).toEqual([
      media_1,
      media_2,
      media_4_no_id,
    ]);
  });
});
