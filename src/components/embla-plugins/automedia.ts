import { EmblaCarouselType, EmblaPluginType } from 'embla-carousel';
import { FrigateCardMediaPlayer } from '../../types.js';

export type AutoMediaPluginOptionsType = {
  playerSelector: string;
  autoPlayWhenVisible?: boolean;
  autoUnmuteWhenVisible?: boolean;
};

export const defaultOptions: Partial<AutoMediaPluginOptionsType> = {
  autoPlayWhenVisible: true,
  autoUnmuteWhenVisible: true,
};

export type AutoMediaPluginType = EmblaPluginType<AutoMediaPluginOptionsType> & {
  play: () => void;
  pause: () => void;
  mute: () => void;
  unmute: () => void;
}

/**
 * An Embla plugin to take automated actions on media (e.g. pause, unmute, etc).
 * @param userOptions 
 * @returns 
 */
export function AutoMediaPlugin(
  userOptions?: AutoMediaPluginOptionsType,
): AutoMediaPluginType {
  const options = Object.assign({}, defaultOptions, userOptions);

  let carousel: EmblaCarouselType;
  let slides: HTMLElement[];

  /**
   * Initialize the plugin.
   */
  function init(embla: EmblaCarouselType): void {
    carousel = embla;
    slides = carousel.slideNodes();

    // Frigate card media autoplays when the media loads not necessarily when the
    // slide is selected, so only pause (and not play/unmute) based on carousel
    // events.
    carousel.on('destroy', pause);
    carousel.on('select', pausePrevious);
    carousel.on('destroy', mute);
    carousel.on('select', mutePrevious);

    document.addEventListener('visibilitychange', visibilityHandler);
  }

  /**
   * Destroy the plugin.
   */
  function destroy(): void {
    carousel.off('destroy', pause);
    carousel.off('select', pausePrevious);
    carousel.off('destroy', mute);
    carousel.off('select', mutePrevious);

    document.removeEventListener('visibilitychange', visibilityHandler);
  }

  /**
   * Handle document visibility changes.
   */
   function visibilityHandler(): void {
    if (document.visibilityState == 'hidden') {
      pause();
      mute();
    } else if (document.visibilityState == 'visible') {
      if (options.autoPlayWhenVisible) {
        play();
      } 
      if (options.autoUnmuteWhenVisible) {
        unmute();
      }
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
   * Play the current slide.
   */
  function play(): void {
    getPlayer(slides[carousel.selectedScrollSnap()])?.play();
  }

  /**
   * Pause the current slide.
   */
  function pause(): void {
    getPlayer(slides[carousel.selectedScrollSnap()])?.pause();
  }

  /**
   * Pause the previous slide.
   */
  function pausePrevious(): void {
    getPlayer(slides[carousel.previousScrollSnap()])?.pause();
  }

  /**
   * Unmute the current slide.
   */
  function unmute(): void {
    getPlayer(slides[carousel.selectedScrollSnap()])?.unmute();
  }

  /**
   * Mute the current slide.
   */
  function mute(): void {
    getPlayer(slides[carousel.selectedScrollSnap()])?.mute();
  }

  /**
   * Mute the previous slide.
   */
   function mutePrevious(): void {
    getPlayer(slides[carousel.previousScrollSnap()])?.mute();
  }

  const self: AutoMediaPluginType = {
    name: 'AutoMediaPlugin',
    options,
    init,
    destroy,
    play,
    pause,
    mute,
    unmute,
  };
  return self;
}
