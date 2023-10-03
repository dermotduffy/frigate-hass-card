import { EmblaCarouselType } from 'embla-carousel';
import { CreateOptionsType } from 'embla-carousel/components/Options.js';
import { OptionsHandlerType } from 'embla-carousel/components/OptionsHandler.js';
import { CreatePluginType, LoosePluginType } from 'embla-carousel/components/Plugins.js';
import {
  AutoMuteCondition,
  AutoPauseCondition,
  AutoPlayCondition,
  AutoUnmuteCondition,
} from '../../../../config/types.js';
import { FrigateCardMediaPlayer } from '../../../../types.js';

declare module 'embla-carousel/components/Plugins' {
  interface EmblaPluginsType {
    autoMediaActions?: AutoMediaActionsType;
  }
}

type OptionsType = CreateOptionsType<{
  playerSelector?: string;

  autoPlayCondition?: AutoPlayCondition;
  autoUnmuteCondition?: AutoUnmuteCondition;
  autoPauseCondition?: AutoPauseCondition;
  autoMuteCondition?: AutoMuteCondition;
}>;
export type AutoMediaActionsOptionsType = Partial<OptionsType>;

const defaultOptions: OptionsType = {
  active: true,
  breakpoints: {},
};

export type AutoMediaActionsType = CreatePluginType<
  LoosePluginType,
  AutoMediaActionsOptionsType
>;

export function AutoMediaActions(
  userOptions: AutoMediaActionsOptionsType = {},
): AutoMediaActionsType {
  let options: OptionsType;
  let emblaApi: EmblaCarouselType;
  let slides: HTMLElement[];
  let hadInitialIntersectionCall: boolean | null = false;

  const intersectionObserver: IntersectionObserver = new IntersectionObserver(
    intersectionHandler,
  );

  function init(
    emblaApiInstance: EmblaCarouselType,
    optionsHandler: OptionsHandlerType,
  ): void {
    emblaApi = emblaApiInstance;

    const { mergeOptions, optionsAtMedia } = optionsHandler;
    options = optionsAtMedia(mergeOptions(defaultOptions, userOptions));

    slides = emblaApi.slideNodes();

    if (
      options.autoPlayCondition &&
      ['all', 'selected'].includes(options.autoPlayCondition)
    ) {
      // Auto play when the media loads not necessarily when the slide is
      // selected (to allow for lazyloading).
      emblaApi.containerNode().addEventListener('frigate-card:media:loaded', play);
    }

    if (
      options.autoUnmuteCondition &&
      ['all', 'selected'].includes(options.autoUnmuteCondition)
    ) {
      // Auto unmute when the media loads not necessarily when the slide is
      // selected (to allow for lazyloading).
      emblaApi.containerNode().addEventListener('frigate-card:media:loaded', unmute);
    }

    if (
      options.autoPauseCondition &&
      ['all', 'unselected'].includes(options.autoPauseCondition)
    ) {
      emblaApi.on('select', pausePrevious);
    }

    if (
      options.autoMuteCondition &&
      ['all', 'unselected'].includes(options.autoMuteCondition)
    ) {
      emblaApi.on('select', mutePrevious);
    }

    emblaApi.on('destroy', pause);
    emblaApi.on('destroy', mute);

    document.addEventListener('visibilitychange', visibilityHandler);
    intersectionObserver.observe(emblaApi.containerNode());
  }

  function destroy(): void {
    if (
      options.autoPlayCondition &&
      ['all', 'selected'].includes(options.autoPlayCondition)
    ) {
      emblaApi.containerNode().removeEventListener('frigate-card:media:loaded', play);
    }

    if (
      options.autoUnmuteCondition &&
      ['all', 'selected'].includes(options.autoUnmuteCondition)
    ) {
      emblaApi.containerNode().removeEventListener('frigate-card:media:loaded', unmute);
    }

    if (
      options.autoPauseCondition &&
      ['all', 'unselected'].includes(options.autoPauseCondition)
    ) {
      emblaApi.off('select', pausePrevious);
    }

    if (
      options.autoMuteCondition &&
      ['all', 'unselected'].includes(options.autoMuteCondition)
    ) {
      emblaApi.off('select', mutePrevious);
    }

    emblaApi.off('destroy', pause);
    emblaApi.off('destroy', mute);

    document.removeEventListener('visibilitychange', visibilityHandler);
    intersectionObserver.disconnect();
  }

  function actOnVisibilityChange(visible: boolean): void {
    if (visible) {
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
    } else {
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
    }
  }

  function visibilityHandler(): void {
    actOnVisibilityChange(document.visibilityState === 'visible');
  }

  function intersectionHandler(entries: IntersectionObserverEntry[]): void {
    if (!hadInitialIntersectionCall) {
      hadInitialIntersectionCall = true;
      return;
    }

    // If the live view is preloaded (i.e. in the background) we may need to
    // take media actions, e.g. muting a live stream that is now running in the
    // background.
    actOnVisibilityChange(entries.some((entry) => entry.isIntersecting));
  }

  function getPlayer(slide: HTMLElement | undefined): FrigateCardMediaPlayer | null {
    return options.playerSelector
      ? (slide?.querySelector(options.playerSelector) as FrigateCardMediaPlayer | null)
      : null;
  }

  function play(): void {
    getPlayer(slides[emblaApi.selectedScrollSnap()])?.play();
  }

  function pause(): void {
    getPlayer(slides[emblaApi.selectedScrollSnap()])?.pause();
  }

  function pausePrevious(): void {
    getPlayer(slides[emblaApi.previousScrollSnap()])?.pause();
  }

  function pauseAll(): void {
    for (const slide of slides) {
      getPlayer(slide)?.pause();
    }
  }

  function unmute(): void {
    getPlayer(slides[emblaApi.selectedScrollSnap()])?.unmute();
  }

  function mute(): void {
    getPlayer(slides[emblaApi.selectedScrollSnap()])?.mute();
  }

  function mutePrevious(): void {
    getPlayer(slides[emblaApi.previousScrollSnap()])?.mute();
  }

  function muteAll(): void {
    for (const slide of slides) {
      getPlayer(slide)?.mute();
    }
  }

  const self: AutoMediaActionsType = {
    name: 'autoMediaActions',
    options: userOptions,
    init,
    destroy,
  };
  return self;
}
