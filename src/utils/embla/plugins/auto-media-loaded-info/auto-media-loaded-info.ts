import { EmblaCarouselType } from 'embla-carousel';
import { LooseOptionsType } from 'embla-carousel/components/Options';
import { CreatePluginType, LoosePluginType } from 'embla-carousel/components/Plugins';
import { MediaLoadedInfo } from '../../../../types';
import {
  FrigateCardMediaLoadedEventTarget,
  dispatchExistingMediaLoadedInfoAsEvent,
} from '../../../media-info';

declare module 'embla-carousel/components/Plugins' {
  interface EmblaPluginsType {
    autoMediaLoadedInfo?: AutoMediaLoadedInfoType;
  }
}

type AutoMediaLoadedInfoType = CreatePluginType<LoosePluginType, LooseOptionsType>;

function AutoMediaLoadedInfo(): AutoMediaLoadedInfoType {
  let emblaApi: EmblaCarouselType;
  let slides: (HTMLElement & FrigateCardMediaLoadedEventTarget)[] = [];
  const mediaLoadedInfo: MediaLoadedInfo[] = [];

  function init(emblaApiInstance: EmblaCarouselType): void {
    emblaApi = emblaApiInstance;
    slides = emblaApi.slideNodes();

    for (const slide of slides) {
      slide.addEventListener('frigate-card:media:loaded', mediaLoadedInfoHandler);
      slide.addEventListener('frigate-card:media:unloaded', mediaUnloadedInfoHandler);
    }

    emblaApi.on('init', slideSelectHandler);
    emblaApi.on('select', slideSelectHandler);
  }

  function destroy(): void {
    for (const slide of slides) {
      slide.removeEventListener('frigate-card:media:loaded', mediaLoadedInfoHandler);
      slide.removeEventListener('frigate-card:media:unloaded', mediaUnloadedInfoHandler);
    }

    emblaApi.off('init', slideSelectHandler);
    emblaApi.off('select', slideSelectHandler);
  }

  function mediaLoadedInfoHandler(ev: CustomEvent<MediaLoadedInfo>): void {
    const eventPath = ev.composedPath();

    // As an optimization, the most recent slide is the one at the end. That's
    // where most users are spending time, so start the search there.
    for (const [index, slide] of [...slides.entries()].reverse()) {
      if (eventPath.includes(slide)) {
        mediaLoadedInfo[index] = ev.detail;
        if (index !== emblaApi.selectedScrollSnap()) {
          ev.stopPropagation();
        }
        break;
      }
    }
  }

  function mediaUnloadedInfoHandler(ev: CustomEvent): void {
    const eventPath = ev.composedPath();

    for (const [index, slide] of slides.entries()) {
      if (eventPath.includes(slide)) {
        delete mediaLoadedInfo[index];
        if (index !== emblaApi.selectedScrollSnap()) {
          ev.stopPropagation();
        }
        break;
      }
    }
  }

  function slideSelectHandler(): void {
    const index = emblaApi.selectedScrollSnap();
    const savedMediaLoadedInfo: MediaLoadedInfo | undefined = mediaLoadedInfo[index];
    if (savedMediaLoadedInfo) {
      dispatchExistingMediaLoadedInfoAsEvent(
        // Event is redispatched from source element.
        slides[index],
        savedMediaLoadedInfo,
      );
    }
  }

  const self: AutoMediaLoadedInfoType = {
    name: 'autoMediaLoadedInfo',
    options: {},
    init,
    destroy,
  };
  return self;
}

export default AutoMediaLoadedInfo;
