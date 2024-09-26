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

/**
 * On the relationship between carousel:select and carousel:force-select:
 *
 * There is a complex interplay here. `carousel:force-select` is an event
 * dispatched by the carousel when it is forced to select a particular slide
 * (i.e. the view has changed). `carousel:select` is dispatched for any
 * selection -- forced or human (e.g. the user dragging the carousel).
 *
 * The media info should only be dispatched _after_ the view object has been
 * updated (since the view will clear the loaded media info). The setting of the
 * view (trigged by `carousel:select`) may require async fetches and may take a
 * while -- and so if the card dispatched media on `carousel:selecte` then the
 * media info may be dispatched before the view is set (which could result in
 * the dispatched media immediately being cleared by the view).
 *
 * It is fine to have media info dispatched from the `carousel:init` event,
 * since the carousel will be initialized based on a particular view object. In
 * practice, the carousel will be initialized before the media is loaded, so
 * there may not be anything to dispatch at that point.
 *
 * When media is loaded, that media loaded info will always be allowed to
 * propogate upwards as long as it is selected.
 */

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
    emblaApi
      .containerNode()
      .addEventListener('frigate-card:carousel:force-select', slideSelectHandler);
  }

  function destroy(): void {
    for (const slide of slides) {
      slide.removeEventListener('frigate-card:media:loaded', mediaLoadedInfoHandler);
      slide.removeEventListener('frigate-card:media:unloaded', mediaUnloadedInfoHandler);
    }

    emblaApi.off('init', slideSelectHandler);
    emblaApi
      .containerNode()
      .removeEventListener('frigate-card:carousel:force-select', slideSelectHandler);
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
