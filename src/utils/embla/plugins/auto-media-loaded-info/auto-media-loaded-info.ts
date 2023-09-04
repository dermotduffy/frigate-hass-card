import { EmblaCarouselType } from 'embla-carousel';
import { CreatePluginType, LoosePluginType } from 'embla-carousel/components/Plugins';
import { MediaLoadedInfo } from '../../../../types';
import {
  dispatchExistingMediaLoadedInfoAsEvent,
  FrigateMediaLoadedEventTarget,
} from '../../../media-info';
import { LooseOptionsType } from 'embla-carousel/components/Options';

declare module 'embla-carousel/components/Plugins' {
  interface EmblaPluginsType {
    autoMediaLoadedInfo?: AutoMediaLoadedInfoType;
  }
}

type AutoMediaLoadedInfoType = CreatePluginType<LoosePluginType, LooseOptionsType>;

function AutoMediaLoadedInfo(): AutoMediaLoadedInfoType {
  let emblaApi: EmblaCarouselType;
  let slides: (HTMLElement & FrigateMediaLoadedEventTarget)[] = [];
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

    for (const [index, slide] of slides.entries()) {
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
        emblaApi.containerNode(),
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
