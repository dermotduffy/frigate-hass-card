import { EmblaCarouselType, EmblaPluginType } from 'embla-carousel';
import {
  AutoMuteCondition,
  AutoPauseCondition,
  AutoPlayCondition,
  AutoUnmuteCondition,
  FrigateCardMediaPlayer,
} from '../../types.js';

export type AutoMediaPluginOptionsType = {
  playerSelector: string;

  // Note: Neither play nor unmute will activate on selection. The caller is
  // expected to call the methods manually when the media is actually loaded
  // (not just the slide shown).
  autoPlayCondition?: AutoPlayCondition;
  autoUnmuteCondition?: AutoUnmuteCondition;
  autoPauseCondition?: AutoPauseCondition;
  autoMuteCondition?: AutoMuteCondition;
};

export const defaultOptions: Partial<AutoMediaPluginOptionsType> = {};

export type AutoMediaPluginType = EmblaPluginType<AutoMediaPluginOptionsType> & {
  play: () => void;
  pause: () => void;
  mute: () => void;
  unmute: () => void;
};

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
    if (
      options.autoPauseCondition &&
      ['all', 'unselected'].includes(options.autoPauseCondition)
    ) {
      carousel.on('select', pausePrevious);
    }
    carousel.on('destroy', mute);
    if (
      options.autoMuteCondition &&
      ['all', 'unselected'].includes(options.autoMuteCondition)
    ) {
      carousel.on('select', mutePrevious);
    }

    document.addEventListener('visibilitychange', visibilityHandler);
  }

  /**
   * Destroy the plugin.
   */
  function destroy(): void {
    carousel.off('destroy', pause);
    if (
      options.autoPauseCondition &&
      ['all', 'unselected'].includes(options.autoPauseCondition)
    ) {
      carousel.off('select', pausePrevious);
    }
    carousel.off('destroy', mute);
    if (
      options.autoMuteCondition &&
      ['all', 'unselected'].includes(options.autoMuteCondition)
    ) {
      carousel.off('select', mutePrevious);
    }

    document.removeEventListener('visibilitychange', visibilityHandler);
  }

  /**
   * Handle document visibility changes.
   */
  function visibilityHandler(): void {
    if (document.visibilityState == 'hidden') {
      if (
        options.autoPauseCondition &&
        ['all', 'hidden'].includes(options.autoPauseCondition)
      ) {
        pauseAll();
      }
      if (
        options.autoMuteCondition &&
        ['all', 'hidden'].includes(options.autoMuteCondition)
      ) {
        muteAll();
      }
    } else if (document.visibilityState == 'visible') {
      if (
        options.autoPlayCondition &&
        ['all', 'visible'].includes(options.autoPlayCondition)
      ) {
        play();
      }
      if (
        options.autoUnmuteCondition &&
        ['all', 'visible'].includes(options.autoUnmuteCondition)
      ) {
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
   * Pause all slides.
   */
  function pauseAll(): void {
    for (const slide of slides) {
      getPlayer(slide)?.pause();
    }
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

  /**
   * Mute all slides.
   */
  function muteAll(): void {
    for (const slide of slides) {
      getPlayer(slide)?.mute();
    }
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
