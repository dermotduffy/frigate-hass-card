import { BrowseMediaMetadata } from '../../../../src/camera-manager/browse-media/types';
import { RichBrowseMedia } from '../../../../src/utils/ha/browse-media/types';

export const createBrowseMedia = (
  media?: Partial<RichBrowseMedia<BrowseMediaMetadata>>,
): RichBrowseMedia<BrowseMediaMetadata> => {
  return {
    title: 'Test Media',
    media_class: 'video',
    media_content_type: 'video/mp4',
    media_content_id: 'test',
    can_play: true,
    can_expand: false,
    thumbnail: null,
    children: null,
    _metadata: {
      cameraID: 'camera.test',
      startDate: new Date('2024-11-19T07:23:00'),
      endDate: new Date('2025-11-19T07:24:00'),
    },
    ...media,
  };
};
