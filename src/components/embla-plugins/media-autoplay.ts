import { EmblaCarouselType, EmblaPluginType } from 'embla-carousel';
import { FrigateCardMediaPlayer } from '../../types';

export type MediaAutoplayOptionsType = {
  autoplay?: boolean;
  autopause?: boolean;
  playerSelector: string;
};

export const defaultOptions: Partial<MediaAutoplayOptionsType> = {
  autoplay: true,
  autopause: true,
};

export type MediaAutoplayType = EmblaPluginType<MediaAutoplayOptionsType>;

export function MediaAutoplay(
  userOptions?: MediaAutoplayOptionsType,
): MediaAutoplayType {
  const options = Object.assign({}, defaultOptions, userOptions);

  let carousel: EmblaCarouselType;
  let slides: HTMLElement[];

  /**
   * Initialize the plugin.
   */
  function init(embla: EmblaCarouselType): void {
    carousel = embla;
    slides = carousel.slideNodes();

    if (options.autopause) {
      carousel.on('destroy', pauseAllHandler);
      carousel.on('select', autopausePreviousHandler);
    }

    if (options.autoplay) {
      carousel.on('select', autoplayCurrentHandler);
      carousel.on('init', autoplayCurrentHandler);
    }
  }

  /**
   * Destroy the plugin.
   */
  function destroy(): void {
    if (options.autopause) {
      carousel.off('destroy', pauseAllHandler);
      carousel.off('select', autopausePreviousHandler);
    }

    if (options.autoplay) {
      carousel.off('select', autoplayCurrentHandler);
      carousel.off('init', autoplayCurrentHandler);
    }
  }

  /**
   * Get the media player from a slide.
   * @param slide
   * @returns A FrigateCardMediaPlayer object or `null`.
   */
  function getPlayer(slide: HTMLElement): FrigateCardMediaPlayer | null {
    return slide.querySelector(options.playerSelector) as FrigateCardMediaPlayer | null;
  }

  /**
   * Pause all clips.
   */
  function pauseAllHandler(): void {
    slides.forEach((slide) => getPlayer(slide)?.pause());
  }

  /**
   * Autoplay the current slide.
   */
  function autoplayCurrentHandler(): void {
    getPlayer(slides[carousel.selectedScrollSnap()])?.play();
  }

  /**
   * Autopause the previous slide.
   */
  function autopausePreviousHandler(): void {
    getPlayer(slides[carousel.previousScrollSnap()])?.pause();
  }

  const self: MediaAutoplayType = {
    name: 'MediaAutoplay',
    options,
    init,
    destroy,
  };
  return self;
}
