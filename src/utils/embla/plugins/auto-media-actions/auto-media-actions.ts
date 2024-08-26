import { EmblaCarouselType } from 'embla-carousel';
import { CreateOptionsType } from 'embla-carousel/components/Options.js';
import { OptionsHandlerType } from 'embla-carousel/components/OptionsHandler.js';
import { CreatePluginType, LoosePluginType } from 'embla-carousel/components/Plugins.js';
import {
  MicrophoneManagerListenerChange,
  ReadonlyMicrophoneManager,
} from '../../../../card-controller/microphone-manager.js';
import {
  AutoMuteCondition,
  AutoPauseCondition,
  AutoPlayCondition,
  AutoUnmuteCondition,
} from '../../../../config/types.js';
import { FrigateCardMediaPlayer } from '../../../../types.js';
import { Timer } from '../../../timer.js';

declare module 'embla-carousel/components/Plugins' {
  interface EmblaPluginsType {
    autoMediaActions?: AutoMediaActionsType;
  }
}

type OptionsType = CreateOptionsType<{
  playerSelector?: string;

  autoPlayConditions?: readonly AutoPlayCondition[];
  autoUnmuteConditions?: readonly AutoUnmuteCondition[];
  autoPauseConditions?: readonly AutoPauseCondition[];
  autoMuteConditions?: readonly AutoMuteCondition[];

  microphoneManager?: ReadonlyMicrophoneManager;
  microphoneMuteSeconds?: number;
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
  let viewportIntersecting: boolean | null = null;
  const microphoneMuteTimer = new Timer();

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

    if (options.autoPlayConditions?.includes('selected')) {
      // Auto play when the media loads not necessarily when the slide is
      // selected (to allow for lazyloading).
      emblaApi.containerNode().addEventListener('frigate-card:media:loaded', play);
    }

    if (options.autoUnmuteConditions?.includes('selected')) {
      // Auto unmute when the media loads not necessarily when the slide is
      // selected (to allow for lazyloading).
      emblaApi.containerNode().addEventListener('frigate-card:media:loaded', unmute);
    }

    if (options.autoPauseConditions?.includes('unselected')) {
      emblaApi.on('select', pausePrevious);
    }

    if (options.autoMuteConditions?.includes('unselected')) {
      emblaApi.on('select', mutePrevious);
    }

    emblaApi.on('destroy', pause);
    emblaApi.on('destroy', mute);

    document.addEventListener('visibilitychange', visibilityHandler);
    intersectionObserver.observe(emblaApi.rootNode());

    if (
      options.autoUnmuteConditions?.includes('microphone') ||
      options.autoMuteConditions?.includes('microphone')
    ) {
      // For some reason mergeOptions() appears to break mock objects passed in,
      // so unittesting doesn't work when using options (vs userOptions where it
      // does).
      userOptions.microphoneManager?.addListener(microphoneChangeHandler);

      // Stop the microphone mute timer if the media changes.
      emblaApi
        .containerNode()
        .addEventListener('frigate-card:media:loaded', stopMicrophoneTimer);
    }
  }

  function stopMicrophoneTimer(): void {
    microphoneMuteTimer.stop();
  }

  function microphoneChangeHandler(change: MicrophoneManagerListenerChange): void {
    if (change === 'unmuted' && options.autoUnmuteConditions?.includes('microphone')) {
      unmute();
    } else if (
      change === 'muted' &&
      options.autoMuteConditions?.includes('microphone')
    ) {
      microphoneMuteTimer.start(options.microphoneMuteSeconds ?? 60, () => {
        mute();
      });
    }
  }

  function destroy(): void {
    if (options.autoPlayConditions?.includes('selected')) {
      emblaApi.containerNode().removeEventListener('frigate-card:media:loaded', play);
    }

    if (options.autoUnmuteConditions?.includes('selected')) {
      emblaApi.containerNode().removeEventListener('frigate-card:media:loaded', unmute);
    }

    if (options.autoPauseConditions?.includes('unselected')) {
      emblaApi.off('select', pausePrevious);
    }

    if (options.autoMuteConditions?.includes('unselected')) {
      emblaApi.off('select', mutePrevious);
    }

    emblaApi.off('destroy', pause);
    emblaApi.off('destroy', mute);

    document.removeEventListener('visibilitychange', visibilityHandler);
    intersectionObserver.disconnect();

    if (
      options.autoUnmuteConditions?.includes('microphone') ||
      options.autoMuteConditions?.includes('microphone')
    ) {
      userOptions.microphoneManager?.removeListener(microphoneChangeHandler);
      emblaApi
        .containerNode()
        .removeEventListener('frigate-card:media:loaded', stopMicrophoneTimer);
    }
  }

  function actOnVisibilityChange(visible: boolean): void {
    if (visible) {
      if (options.autoPlayConditions?.includes('visible')) {
        play();
      }
      if (options.autoUnmuteConditions?.includes('visible')) {
        unmute();
      }
    } else {
      if (options.autoPauseConditions?.includes('hidden')) {
        pauseAll();
      }
      if (options.autoMuteConditions?.includes('hidden')) {
        muteAll();
      }
    }
  }

  function visibilityHandler(): void {
    actOnVisibilityChange(document.visibilityState === 'visible');
  }

  function intersectionHandler(entries: IntersectionObserverEntry[]): void {
    const wasIntersecting = viewportIntersecting;
    viewportIntersecting = entries.some((entry) => entry.isIntersecting);

    if (wasIntersecting !== null && wasIntersecting !== viewportIntersecting) {
      // If the live view is preloaded (i.e. in the background) we may need to
      // take media actions, e.g. muting a live stream that is now running in
      // the background, so we act even if the new state is hidden.
      actOnVisibilityChange(viewportIntersecting);
    }
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
