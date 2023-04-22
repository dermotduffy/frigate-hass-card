import { CreateOptionsType } from 'embla-carousel/components/Options';
import { CreatePluginType } from 'embla-carousel/components/Plugins';
import EmblaCarousel, { EmblaCarouselType, EmblaEventType } from 'embla-carousel';
import { LazyUnloadCondition } from '../../types';

type OptionsType = CreateOptionsType<{
  // Number of slides to lazyload left/right of selected (0 == only selected
  // slide).
  lazyLoadCount?: number;
  lazyUnloadCondition?: LazyUnloadCondition;

  lazyLoadCallback?: (index: number, slide: HTMLElement) => void;
  lazyUnloadCallback?: (index: number, slide: HTMLElement) => void;
}>;

const defaultOptions: OptionsType = {
  active: true,
  breakpoints: {},
  lazyLoadCount: 0,
};

type LazyloadOptionsType = Partial<OptionsType>;

type LazyloadType = CreatePluginType<
  {
    hasLazyloaded(index: number): boolean;
  },
  LazyloadOptionsType
>;

declare module 'embla-carousel/components/Plugins' {
  interface EmblaPluginsType {
    lazyload?: LazyloadType;
  }
}

export function Lazyload(userOptions?: LazyloadOptionsType): LazyloadType {
  const optionsHandler = EmblaCarousel.optionsHandler();
  const optionsBase = optionsHandler.merge(defaultOptions, Lazyload.globalOptions);
  let options: LazyloadType['options'];

  let carousel: EmblaCarouselType;
  let slides: HTMLElement[];
  const lazyLoadedSlides: Set<number> = new Set();

  const loadEvents: EmblaEventType[] = ['init', 'select', 'resize'];
  const unloadEvents: EmblaEventType[] = ['select'];

  /**
   * Initialize the plugin.
   */
  function init(embla: EmblaCarouselType): void {
    carousel = embla;
    options = optionsHandler.atMedia(self.options);
    slides = carousel.slideNodes();

    if (options.lazyLoadCallback) {
      loadEvents.forEach((evt) => carousel.on(evt, lazyLoadHandler));
    }
    if (
      options.lazyUnloadCallback &&
      options.lazyUnloadCondition &&
      ['all', 'unselected'].includes(options.lazyUnloadCondition)
    ) {
      unloadEvents.forEach((evt) => carousel.on(evt, lazyUnloadPreviousHandler));
    }
    document.addEventListener('visibilitychange', visibilityHandler);
  }

  /**
   * Destroy the plugin.
   */
  function destroy(): void {
    if (options.lazyLoadCallback) {
      loadEvents.forEach((evt) => carousel.off(evt, lazyLoadHandler));
    }
    if (options.lazyUnloadCallback) {
      unloadEvents.forEach((evt) => carousel.off(evt, lazyUnloadPreviousHandler));
    }
    document.removeEventListener('visibilitychange', visibilityHandler);
  }

  /**
   * Handle document visibility changes.
   */
  function visibilityHandler(): void {
    if (
      document.visibilityState === 'hidden' &&
      options.lazyUnloadCallback &&
      options.lazyUnloadCondition &&
      ['all', 'hidden'].includes(options.lazyUnloadCondition)
    ) {
      lazyUnloadAllHandler();
    } else if (document.visibilityState === 'visible' && options.lazyLoadCallback) {
      lazyLoadHandler();
    }
  }

  /**
   * Determine if a slide index has been lazily loaded.
   * @param index Slide index.
   * @returns `true` if the slide has been lazily loaded.
   */
  function hasLazyloaded(index: number): boolean {
    return lazyLoadedSlides.has(index);
  }

  /**
   * Lazily load media in the carousel.
   */
  function lazyLoadHandler(): void {
    const lazyLoadCount = options.lazyLoadCount ?? 0;
    const currentIndex = carousel.selectedScrollSnap();
    const slidesToLoad = new Set<number>();

    // Lazily load 'count' slides on either side of the slides in view.
    for (let i = 1; i <= lazyLoadCount && currentIndex - i >= 0; i++) {
      slidesToLoad.add(currentIndex - i);
    }
    slidesToLoad.add(currentIndex);
    for (let i = 1; i <= lazyLoadCount && currentIndex + i < slides.length; i++) {
      slidesToLoad.add(currentIndex + i);
    }

    slidesToLoad.forEach((index) => {
      if (!hasLazyloaded(index) && options.lazyLoadCallback) {
        lazyLoadedSlides.add(index);
        options.lazyLoadCallback(index, slides[index]);
      }
    });
  }

  /**
   * Lazily unload all media in the carousel.
   */
  function lazyUnloadAllHandler(): void {
    lazyLoadedSlides.forEach((index) => {
      if (options.lazyUnloadCallback) {
        options.lazyUnloadCallback(index, slides[index]);
        lazyLoadedSlides.delete(index);
      }
    });
  }

  /**
   * Lazily unload the previously selected media in the carousel.
   */
  function lazyUnloadPreviousHandler(): void {
    const index = carousel.previousScrollSnap();

    if (hasLazyloaded(index) && options.lazyUnloadCallback) {
      options.lazyUnloadCallback(index, slides[index]);
      lazyLoadedSlides.delete(index);
    }
  }

  const self: LazyloadType = {
    name: 'lazyload',
    options: optionsHandler.merge(optionsBase, userOptions),
    init,
    destroy,
    hasLazyloaded,
  };
  return self;
}

Lazyload.globalOptions = <LazyloadOptionsType | undefined>undefined;
