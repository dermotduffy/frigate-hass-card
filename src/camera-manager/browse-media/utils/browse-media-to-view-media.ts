import {
  RichBrowseMedia,
  MEDIA_CLASS_VIDEO,
  MEDIA_CLASS_IMAGE,
} from '../../../utils/ha/browse-media/types';
import { ViewMedia } from '../../../view/media';
import { BrowseMediaViewMediaFactory } from '../media';
import { BrowseMediaMetadata } from '../types';

export const getViewMediaFromBrowseMediaArray = (
  browseMedia: RichBrowseMedia<BrowseMediaMetadata>[],
): ViewMedia[] | null => {
  const lookup: Map<string, ViewMedia> = new Map();
  for (const browseMediaItem of browseMedia) {
    const cameraID = browseMediaItem._metadata?.cameraID;
    if (!cameraID) {
      continue;
    }

    const mediaType =
      browseMediaItem.media_class === MEDIA_CLASS_VIDEO
        ? 'clip'
        : browseMediaItem.media_class === MEDIA_CLASS_IMAGE
          ? 'snapshot'
          : null;

    if (!mediaType) {
      continue;
    }
    const media = BrowseMediaViewMediaFactory.createEventViewMedia(
      mediaType,
      browseMediaItem,
      cameraID,
    );

    const id = media.getID();
    const existing = lookup.get(id);

    // De-duplicate events with precisely the same ID (same
    // hour/minute/second) choosing clip > snapshot.
    if (
      !existing ||
      (existing.getMediaType() === 'snapshot' && media.getMediaType() === 'clip')
    ) {
      lookup.set(id, media);
    }
  }
  return [...lookup.values()];
};
