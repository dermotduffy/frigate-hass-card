import {
  MicrophoneManagerListenerChange,
  ReadonlyMicrophoneManager,
} from '../card-controller/microphone-manager.js';
import {
  AutoMuteCondition,
  AutoPauseCondition,
  AutoPlayCondition,
  AutoUnmuteCondition,
} from '../config/types.js';
import { FrigateCardMediaPlayer } from '../types.js';
import { FrigateCardMediaLoadedEventTarget } from '../utils/media-info.js';
import { Timer } from '../utils/timer.js';

export interface MediaActionsControllerOptions {
  playerSelector: string;

  autoPlayConditions?: readonly AutoPlayCondition[];
  autoUnmuteConditions?: readonly AutoUnmuteCondition[];
  autoPauseConditions?: readonly AutoPauseCondition[];
  autoMuteConditions?: readonly AutoMuteCondition[];

  microphoneManager?: ReadonlyMicrophoneManager;
  microphoneMuteSeconds?: number;
}

type RenderRoot = HTMLElement & FrigateCardMediaLoadedEventTarget;
type PlayerElement = HTMLElement & FrigateCardMediaPlayer;

/**
 * General note: Always unmute before playing, since Chrome may pause a piece of
 * media if the page hasn't been interacted with first, after unmute. By unmuting
 * first, even if the unmute call fails a subsequent call to play will still
 * start the video.
 */

export class MediaActionsController {
  protected _options: MediaActionsControllerOptions | null = null;
  protected _viewportIntersecting: boolean | null = null;
  protected _microphoneMuteTimer = new Timer();
  protected _root: RenderRoot | null = null;

  protected _eventListeners = new Map<HTMLElement, () => void>();
  protected _children: PlayerElement[] = [];
  protected _selected: number | null = null;
  protected _mutationObserver = new MutationObserver(this._mutationHandler.bind(this));
  protected _intersectionObserver = new IntersectionObserver(
    this._intersectionHandler.bind(this),
  );

  public setOptions(options: MediaActionsControllerOptions): void {
    this._options = options;

    if (this._options?.microphoneManager) {
      this._options.microphoneManager.removeListener(this._microphoneChangeHandler);
      this._options.microphoneManager.addListener(this._microphoneChangeHandler);
    }
  }

  public hasRoot(): boolean {
    return !!this._root;
  }

  public destroy(): void {
    this._viewportIntersecting = null;
    this._microphoneMuteTimer.stop();
    this._root = null;
    this._removeChildHandlers();
    this._children = [];
    this._selected = null;
    this._mutationObserver.disconnect();
    this._intersectionObserver.disconnect();
    this._options?.microphoneManager?.removeListener(this._microphoneChangeHandler);
    document.removeEventListener('visibilitychange', this._visibilityHandler);
  }

  public async select(index: number): Promise<void> {
    if (this._selected === index) {
      return;
    }
    if (this._selected !== null) {
      await this.unselect();
    }
    this._selected = index;
    await this._unmuteSelectedIfConfigured('selected');
    await this._playSelectedIfConfigured('selected');
  }

  public async unselect(): Promise<void> {
    await this._pauseSelectedIfConfigured('unselected');
    await this._muteSelectedIfConfigured('unselected');
    this._microphoneMuteTimer.stop();
    this._selected = null;
  }

  public async unselectAll(): Promise<void> {
    this._selected = null;
    await this._pauseAllIfConfigured('unselected');
    await this._muteAllIfConfigured('unselected');
  }

  protected async _playSelectedIfConfigured(
    condition: AutoPlayCondition,
  ): Promise<void> {
    if (
      this._selected !== null &&
      this._options?.autoPlayConditions?.includes(condition)
    ) {
      await this._play(this._selected);
    }
  }
  protected async _play(index: number): Promise<void> {
    await this._children[index]?.play();
  }
  protected async _unmuteSelectedIfConfigured(
    condition: AutoUnmuteCondition,
  ): Promise<void> {
    if (
      this._selected !== null &&
      this._options?.autoUnmuteConditions?.includes(condition)
    ) {
      await this._unmute(this._selected);
    }
  }
  protected async _unmute(index: number): Promise<void> {
    await this._children[index]?.unmute();
  }

  protected async _pauseAllIfConfigured(condition: AutoPauseCondition): Promise<void> {
    if (this._options?.autoPauseConditions?.includes(condition)) {
      for (const index of this._children.keys()) {
        await this._pause(index);
      }
    }
  }
  protected async _pauseSelectedIfConfigured(
    condition: AutoPauseCondition,
  ): Promise<void> {
    if (
      this._selected !== null &&
      this._options?.autoPauseConditions?.includes(condition)
    ) {
      await this._pause(this._selected);
    }
  }
  protected async _pause(index: number): Promise<void> {
    await this._children[index]?.pause();
  }

  protected async _muteAllIfConfigured(condition: AutoMuteCondition): Promise<void> {
    if (this._options?.autoMuteConditions?.includes(condition)) {
      for (const index of this._children.keys()) {
        await this._mute(index);
      }
    }
  }
  protected async _muteSelectedIfConfigured(
    condition: AutoMuteCondition,
  ): Promise<void> {
    if (
      this._selected !== null &&
      this._options?.autoMuteConditions?.includes(condition)
    ) {
      await this._mute(this._selected);
    }
  }
  protected async _mute(index: number): Promise<void> {
    await this._children[index]?.mute();
  }

  protected _mutationHandler(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _mutations: MutationRecord[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _observer: MutationObserver,
  ): void {
    this._initializeRoot();
  }

  protected _mediaLoadedHandler = async (index: number): Promise<void> => {
    if (this._selected !== index) {
      return;
    }
    await this._unmuteSelectedIfConfigured('selected');
    await this._playSelectedIfConfigured('selected');
  };

  protected _removeChildHandlers(): void {
    for (const [child, callback] of this._eventListeners.entries()) {
      child.removeEventListener('frigate-card:media:loaded', callback);
    }
    this._eventListeners.clear();
  }

  public initialize(root: RenderRoot): void {
    this._root = root;
    this._initializeRoot();

    document.addEventListener('visibilitychange', this._visibilityHandler);

    this._intersectionObserver.disconnect();
    this._intersectionObserver.observe(root);

    this._mutationObserver.disconnect();
    this._mutationObserver.observe(this._root, { childList: true, subtree: true });
  }

  protected _initializeRoot(): void {
    if (!this._options || !this._root) {
      return;
    }

    this._removeChildHandlers();

    this._children = [
      ...this._root.querySelectorAll<PlayerElement>(this._options.playerSelector),
    ];

    for (const [index, child] of this._children.entries()) {
      const eventListener = () => this._mediaLoadedHandler(index);
      this._eventListeners.set(child, eventListener);
      child.addEventListener('frigate-card:media:loaded', eventListener);
    }
  }
  protected async _intersectionHandler(
    entries: IntersectionObserverEntry[],
  ): Promise<void> {
    const wasIntersecting = this._viewportIntersecting;
    this._viewportIntersecting = entries.some((entry) => entry.isIntersecting);

    if (wasIntersecting !== null && wasIntersecting !== this._viewportIntersecting) {
      // If the live view is preloaded (i.e. in the background) we may need to
      // take media actions, e.g. muting a live stream that is now running in
      // the background, so we act even if the new state is hidden.
      await this._changeVisibility(this._viewportIntersecting);
    }
  }

  protected _visibilityHandler = async (): Promise<void> => {
    await this._changeVisibility(document.visibilityState === 'visible');
  };

  protected _changeVisibility = async (visible: boolean): Promise<void> => {
    if (visible) {
      await this._unmuteSelectedIfConfigured('visible');
      await this._playSelectedIfConfigured('visible');
    } else {
      await this._pauseAllIfConfigured('hidden');
      await this._muteAllIfConfigured('hidden');
    }
  };
  protected _microphoneChangeHandler = async (
    change: MicrophoneManagerListenerChange,
  ): Promise<void> => {
    if (change === 'unmuted') {
      await this._unmuteSelectedIfConfigured('microphone');
    } else if (
      change === 'muted' &&
      this._options?.autoMuteConditions?.includes('microphone')
    ) {
      this._microphoneMuteTimer.start(
        this._options.microphoneMuteSeconds ?? 60,
        async () => {
          await this._muteSelectedIfConfigured('microphone');
        },
      );
    }
  };
}
