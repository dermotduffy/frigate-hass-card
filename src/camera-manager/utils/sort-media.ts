import orderBy from 'lodash-es/orderBy';
import uniqBy from 'lodash-es/uniqBy';
import { ViewMedia } from '../../view/media';

export const sortMedia = (mediaArray: ViewMedia[]): ViewMedia[] => {
  return orderBy(
    // Ensure uniqueness by the ID (if specified), otherwise all elements
    // are assumed to be unique.
    uniqBy(mediaArray, (media) => media.getID() ?? media),

    // Sort all items leading oldest -> youngest (so media is loaded in this
    // order in the viewer which matches the left-to-right timeline order).
    (media) => media.getStartTime() ?? media.getID(),
    'asc',
  );
};
