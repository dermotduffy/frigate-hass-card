import { EmblaCarouselType, EmblaPluginType } from 'embla-carousel';
import { FrigateCardMediaPlayer } from '../../types.js';

export type MediaAutoPlayPauseOptionsType = {
  autoplay?: boolean;
  autopause?: boolean;
  playerSelector: string;
};

export const defaultOptions: Partial<MediaAutoPlayPauseOptionsType> = {
  // Frigate card media autoplays when the media loads, not necessarily when the
  // slide is selected.
  autoplay: false,
  autopause: true,
};

export type MediaAutoPlayPauseType = EmblaPluginType<MediaAutoPlayPauseOptionsType> & {
  play: () => void;
}

export function MediaAutoPlayPause(
  userOptions?: MediaAutoPlayPauseOptionsType,
): MediaAutoPlayPauseType {
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
      carousel.on('select', pausePrevious);
    }

    if (options.autoplay) {
      carousel.on('select', play);
      carousel.on('init', play);
    }
  }

  /**
   * Destroy the plugin.
   */
  function destroy(): void {
    if (options.autopause) {
      carousel.off('destroy', pauseAllHandler);
      carousel.off('select', pausePrevious);
    }

    if (options.autoplay) {
      carousel.off('select', play);
      carousel.off('init', play);
    }
  }

  /**
   * Get the media player from a slide.
   * @param slide
   * @returns A FrigateCardMediaPlayer object or `null`.
   */
  function getPlayer(slide: HTMLElement | undefined): FrigateCardMediaPlayer | null {
    return slide?.querySelector(options.playerSelector) as FrigateCardMediaPlayer | null;
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
  function play(): void {
    getPlayer(slides[carousel.selectedScrollSnap()])?.play();
  }

  /**
   * Autopause the previous slide.
   */
  function pausePrevious(): void {
    getPlayer(slides[carousel.previousScrollSnap()])?.pause();
  }

  const self: MediaAutoPlayPauseType = {
    name: 'MediaAutoPlayPause',
    options,
    init,
    destroy,
    play,
  };
  return self;
}
