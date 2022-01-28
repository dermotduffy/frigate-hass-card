import { EmblaCarouselType, EmblaEventType, EmblaPluginType } from 'embla-carousel';

export type LazyloadOptionsType = {
  // Number of slides to lazyload left/right of selected (0 == only selected slide).
  lazyloadCount?: number;

  lazyloadCallback?: (index: number, slide: HTMLElement) => void;
  lazyunloadCallback?: (index: number, slide: HTMLElement) => void;
};

export const defaultOptions: Partial<LazyloadOptionsType> = {
  lazyloadCount: 0,
};

export type LazyloadType = EmblaPluginType<LazyloadOptionsType> & {
  hasLazyloaded: (index: number) => boolean;
};

export function Lazyload(userOptions?: LazyloadOptionsType): LazyloadType {
  const options = Object.assign({}, defaultOptions, userOptions);

  let carousel: EmblaCarouselType;
  let slides: HTMLElement[];
  const isSlideLazyloaded: Record<number, boolean> = {};

  const loadEvents: EmblaEventType[] = ['init', 'select', 'resize'];
  const unloadEvents: EmblaEventType[] = ['select'];

  /**
   * Initialize the plugin.
   */
  function init(embla: EmblaCarouselType): void {
    carousel = embla;
    slides = carousel.slideNodes();

    if (options.lazyloadCallback) {
      loadEvents.forEach((evt) => carousel.on(evt, lazyloadHandler));
    }
    if (options.lazyunloadCallback) {
      unloadEvents.forEach((evt) => carousel.on(evt, lazyunloadHandler));
    }
    document.addEventListener('visibilitychange', visibilityHandler);
  }

  /**
   * Destroy the plugin.
   */
  function destroy(): void {
    if (options.lazyloadCallback) {
      loadEvents.forEach((evt) => carousel.off(evt, lazyloadHandler));
    }
    if (options.lazyunloadCallback) {
      unloadEvents.forEach((evt) => carousel.off(evt, lazyunloadHandler));
    }
    document.removeEventListener('visibilitychange', visibilityHandler);
  }

  /**
   * Handle document visibility changes.
   */
  function visibilityHandler(): void {
    if (document.visibilityState == 'hidden' && lazyunloadHandler)  {
      lazyunloadHandler();
    } else if (document.visibilityState == 'visible' && lazyloadHandler)  {
      lazyloadHandler();
    }
  }

  /**
   * Determine if a slide index has been lazily loaded.
   * @param index Slide index.
   * @returns `true` if the slide has been lazily loaded.
   */
  function hasLazyloaded(index: number): boolean {
    return !!isSlideLazyloaded[index];
  }

  /**
   * Lazily load media in the carousel.
   */
  function lazyloadHandler(): void {
    const lazyLoadCount = options.lazyloadCount ?? 0;
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
      // Only lazy load slides that are not already loaded.
      if (isSlideLazyloaded[index]) {
        return;
      }
      if (options.lazyloadCallback) {
        isSlideLazyloaded[index] = true;
        options.lazyloadCallback(index, slides[index]);
      }
    });
  }

  /**
   * Lazily unload media in the carousel.
   */
   function lazyunloadHandler(): void {
    const index = carousel.previousScrollSnap();

    // Only lazy unload slides that are loaded.
    if (!isSlideLazyloaded[index]) {
      return;
    }
    if (options.lazyunloadCallback) {
      options.lazyunloadCallback(index, slides[index]);
      isSlideLazyloaded[index] = false;
    }
  }
  
  const self: LazyloadType = {
    name: 'Lazyload',
    options,
    init,
    destroy,
    hasLazyloaded,
  };
  return self;
}
