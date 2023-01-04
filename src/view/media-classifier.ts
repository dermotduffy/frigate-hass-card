import { ModifyInterface } from '../utils/basic.js';
import { ViewMedia, FrigateEventViewMedia, FrigateRecordingViewMedia } from './media';

export class ViewMediaClassifier {
  public static isFrigateMedia(
    media: ViewMedia,
  ): media is FrigateEventViewMedia | FrigateRecordingViewMedia {
    return this.isFrigateEvent(media) || this.isFrigateRecording(media);
  }
  public static isFrigateEvent(media: ViewMedia): media is FrigateEventViewMedia {
    return media instanceof FrigateEventViewMedia;
  }
  public static isFrigateRecording(
    media: ViewMedia,
  ): media is FrigateRecordingViewMedia {
    return media instanceof FrigateRecordingViewMedia;
  }

  // Typescript conveniences.
  public static isMediaWithStartEndTime(media: ViewMedia): media is ModifyInterface<
    ViewMedia,
    {
      getStartTime(): Date;
      getEndTime(): Date;
    }
  > {
    return !!media.getStartTime() && !!media.getEndTime();
  }
  public static isMediaWithStartTime(media: ViewMedia): media is ModifyInterface<
    ViewMedia,
    {
      getStartTime(): Date;
    }
  > {
    return !!media.getStartTime();
  }
  public static isMediaWithEndTime(media: ViewMedia): media is ModifyInterface<
    ViewMedia,
    {
      getEndTime(): Date;
    }
  > {
    return !!media.getEndTime();
  }
  public static isMediaWithID(media: ViewMedia): media is ModifyInterface<
    ViewMedia,
    {
      getID(): string;
    }
  > {
    return !!media.getID();
  }
}
