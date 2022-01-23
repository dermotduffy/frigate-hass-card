import { EmblaCarouselType, EmblaPluginType } from 'embla-carousel';

export type LazyloadOptionsType = {
  count?: number;
  lazyloadCallback: (index: number, slide: HTMLElement) => void;
};

export const defaultOptions: Partial<LazyloadOptionsType> = {
  count: 0,
};

export type LazyloadType = EmblaPluginType<LazyloadOptionsType> & {
  hasLazyloaded: (index: number) => boolean;
};

export function Lazyload(userOptions?: LazyloadOptionsType): LazyloadType {
  const options = Object.assign({}, defaultOptions, userOptions);

  let carousel: EmblaCarouselType;
  let slides: HTMLElement[];
  const isSlideLazyloaded: Record<number, boolean> = {};

  /**
   * Initialize the plugin.
   */
  function init(embla: EmblaCarouselType): void {
    carousel = embla;
    slides = carousel.slideNodes();

    carousel.on('init', lazyLoadHandler);
    carousel.on('select', lazyLoadHandler);
    carousel.on('resize', lazyLoadHandler);
  }

  /**
   * Destroy the plugin.
   */
  function destroy(): void {
    carousel.off('init', lazyLoadHandler);
    carousel.off('select', lazyLoadHandler);
    carousel.off('resize', lazyLoadHandler);
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
  function lazyLoadHandler(): void {
    const lazyLoadCount = options.count ?? 0;
    const slidesInView = carousel.slidesInView(true);
    const slidesToLoad = new Set<number>();

    const minSlide = Math.min(...slidesInView);
    const maxSlide = Math.max(...slidesInView);

    // Lazily load 'count' slides on either side of the slides in view.
    for (let i = 1; i <= lazyLoadCount && minSlide - i >= 0; i++) {
      slidesToLoad.add(minSlide - i);
    }
    slidesInView.forEach((index) => slidesToLoad.add(index));
    for (let i = 1; i <= lazyLoadCount && maxSlide + i < slides.length; i++) {
      slidesToLoad.add(maxSlide + i);
    }

    slidesToLoad.forEach((index) => {
      // Only lazy load slides that are not already loaded.
      if (isSlideLazyloaded[index]) {
        return;
      }
      isSlideLazyloaded[index] = true;
      options.lazyloadCallback(index, slides[index]);
    });
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
