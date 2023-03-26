import isEqual from 'lodash-es/isEqual';
import { formatDateAndTime } from '../../utils/basic';
import { MEDIA_CLASS_VIDEO, RichBrowseMedia } from '../../utils/ha/browse-media/types';
import {
  ViewMedia,
  EventViewMedia,
  ViewMediaType,
  VideoContentType,
} from '../../view/media';
import { BrowseMediaMetadata } from '../browse-media/types';

class BrowseMediaEventViewMedia extends ViewMedia implements EventViewMedia {
  protected _browseMedia: RichBrowseMedia<BrowseMediaMetadata>;

  constructor(
    mediaType: ViewMediaType,
    cameraID: string,
    browseMedia: RichBrowseMedia<BrowseMediaMetadata>,
  ) {
    super(mediaType, cameraID);
    this._browseMedia = browseMedia;
  }

  public hasClip(): boolean {
    return this._browseMedia.media_class === MEDIA_CLASS_VIDEO;
  }
  public getStartTime(): Date | null {
    return this._browseMedia._metadata?.startDate ?? null;
  }
  public getEndTime(): Date | null {
    return null;
  }
  public getVideoContentType(): VideoContentType | null {
    return VideoContentType.MP4;
  }
  public getID(): string {
    return this.getContentID();
  }
  public getContentID(): string {
    return this._browseMedia.media_content_id;
  }
  public getTitle(): string | null {
    const startTime = this.getStartTime();
    return startTime ? formatDateAndTime(startTime) : this._browseMedia.title;
  }
  public getThumbnail(): string | null {
    return this._browseMedia.thumbnail;
  }
  public getWhat(): string[] | null {
    return null;
  }
  public getScore(): number | null {
    return null;
  }
  public getTags(): string[] | null {
    return null;
  }
  public isGroupableWith(that: EventViewMedia): boolean {
    return (
      this.getMediaType() === that.getMediaType() &&
      isEqual(this.getWhere(), that.getWhere()) &&
      isEqual(this.getWhat(), that.getWhat())
    );
  }
}

export class BrowseMediaViewMediaFactory {
  static createEventViewMedia(
    mediaType: 'clip' | 'snapshot',
    browseMedia: RichBrowseMedia<BrowseMediaMetadata>,
    cameraID: string,
  ): BrowseMediaEventViewMedia | null {
    return new BrowseMediaEventViewMedia(mediaType, cameraID, browseMedia);
  }
}
