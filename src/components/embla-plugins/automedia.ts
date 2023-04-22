import EmblaCarousel, { EmblaCarouselType } from 'embla-carousel';
import { CreateOptionsType } from 'embla-carousel/components/Options.js';
import { CreatePluginType } from 'embla-carousel/components/Plugins.js';
import {
  AutoMuteCondition,
  AutoPauseCondition,
  AutoPlayCondition,
  AutoUnmuteCondition,
  FrigateCardMediaPlayer,
} from '../../types.js';

type OptionsType = CreateOptionsType<{
  playerSelector?: string;

  // Note: Neither play nor unmute will activate on selection. The caller is
  // expected to call the `play()` or `unmute()` methods manually when the media
  // is actually loaded (and not just when the slide is visible -- the browser
  // cannot play media that is not actually loaded yet, e.g. lazy loading).
  autoPlayCondition?: AutoPlayCondition;
  autoUnmuteCondition?: AutoUnmuteCondition;
  autoPauseCondition?: AutoPauseCondition;
  autoMuteCondition?: AutoMuteCondition;
}>;

const defaultOptions: OptionsType = {
  active: true,
  breakpoints: {},
};

type AutoMediaOptionsType = Partial<OptionsType>

export type AutoMediaType = CreatePluginType<
  {
    play: () => void;
    pause: () => void;
    mute: () => void;
    unmute: () => void;
  },
  AutoMediaOptionsType
>;

declare module 'embla-carousel/components/Plugins' {
  interface EmblaPluginsType {
    autoMedia?: AutoMediaType
  }
}

/**
 * An Embla plugin to take automated actions on media (e.g. pause, unmute, etc).
 * @param userOptions
 * @returns
 */
export function AutoMediaPlugin(
  userOptions?: AutoMediaOptionsType,
): AutoMediaType {
  const optionsHandler = EmblaCarousel.optionsHandler();
  const optionsBase = optionsHandler.merge(
    defaultOptions,
    AutoMediaPlugin.globalOptions,
  );

  let options: AutoMediaType['options'];
  let carousel: EmblaCarouselType;
  let slides: HTMLElement[];

  /**
   * Initialize the plugin.
   */
  function init(embla: EmblaCarouselType): void {
    carousel = embla;
    options = optionsHandler.atMedia(self.options);
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
    if (document.visibilityState === 'hidden') {
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
    } else if (document.visibilityState === 'visible') {
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
    return options.playerSelector
      ? (slide?.querySelector(options.playerSelector) as FrigateCardMediaPlayer | null)
      : null;
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

  const self: AutoMediaType = {
    name: 'autoMedia',
    options: optionsHandler.merge(optionsBase, userOptions),
    init,
    destroy,
    play,
    pause,
    mute,
    unmute,
  };
  return self;
}

AutoMediaPlugin.globalOptions = <AutoMediaOptionsType | undefined>undefined;
