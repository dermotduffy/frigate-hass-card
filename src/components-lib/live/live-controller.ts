import { LitElement, ReactiveController } from 'lit';
import { FrigateCardMessageEventTarget } from '../../components/message.js';
import { MediaLoadedInfo, Message } from '../../types.js';
import {
  FrigateCardMediaLoadedEventTarget,
  dispatchExistingMediaLoadedInfoAsEvent,
} from '../../utils/media-info.js';

interface LiveViewContext {
  // A cameraID override (used for dependencies/substreams to force a different
  // camera to be live rather than the camera selected in the view).
  overrides?: Map<string, string>;
}

declare module 'view' {
  interface ViewContext {
    live?: LiveViewContext;
  }
}

interface LastMediaLoadedInfo {
  mediaLoadedInfo: MediaLoadedInfo;
  source: EventTarget;
}

type LiveControllerHost = LitElement &
  FrigateCardMediaLoadedEventTarget &
  FrigateCardMessageEventTarget;

export class LiveController implements ReactiveController {
  protected _host: LiveControllerHost;

  // Whether or not the live view is currently in the background (i.e. preloaded
  // but not visible).
  protected _inBackground = false;

  // Intersection handler is used to detect when the live view flips between
  // foreground and background (in preload mode).
  protected _intersectionObserver: IntersectionObserver;

  // Whether or not to allow updates.
  protected _messageReceived = false;

  // MediaLoadedInfo object and target from the underlying live media. In the
  // case of pre-loading these may be propagated later (from the original
  // source).
  protected _lastMediaLoadedInfo: LastMediaLoadedInfo | null = null;

  protected _renderEpoch = 0;

  constructor(host: LiveControllerHost) {
    this._host = host;

    host.addController(this);

    this._intersectionObserver = new IntersectionObserver(
      this._intersectionHandler.bind(this),
    );
  }

  public shouldUpdate(): boolean {
    // Don't process updates if it's in the background and a message was
    // received (otherwise an error message thrown by the background live
    // component may continually be re-spammed hitting performance).
    return !(this._inBackground && this._messageReceived);
  }

  public hostConnected(): void {
    this._intersectionObserver.observe(this._host);

    this._host.addEventListener('frigate-card:media:loaded', this._handleMediaLoaded);
    this._host.addEventListener('frigate-card:message', this._handleMessage);
  }

  public hostDisconnected(): void {
    this._intersectionObserver.disconnect();

    this._host.removeEventListener('frigate-card:media:loaded', this._handleMediaLoaded);
    this._host.removeEventListener('frigate-card:message', this._handleMessage);
  }

  public clearMessageReceived(): void {
    this._messageReceived = false;
  }

  public isInBackground(): boolean {
    return this._inBackground;
  }

  public getRenderEpoch(): number {
    return this._renderEpoch;
  }

  protected _handleMessage = (ev: CustomEvent<Message>): void => {
    this._messageReceived = true;

    if (this._inBackground) {
      ev.stopPropagation();

      // Force the whole DOM to re-render next time.
      this._renderEpoch++;
    }
  };

  protected _handleMediaLoaded = (ev: CustomEvent<MediaLoadedInfo>): void => {
    this._lastMediaLoadedInfo = {
      source: ev.composedPath()[0],
      mediaLoadedInfo: ev.detail,
    };

    if (this._inBackground) {
      ev.stopPropagation();
    }
  };

  protected _intersectionHandler(entries: IntersectionObserverEntry[]): void {
    const wasInBackground = this._inBackground;
    this._inBackground = !entries.some((entry) => entry.isIntersecting);

    if (!this._inBackground && !this._messageReceived && this._lastMediaLoadedInfo) {
      // If this isn't being rendered in the background, the last render did not
      // generate a message and there's a saved MediaInfo, dispatch it upwards.
      dispatchExistingMediaLoadedInfoAsEvent(
        // Specifically dispatch the event "where it came from", as otherwise
        // the intermediate layers (e.g. media-carousel which controls the title
        // popups) will not re-receive the events.
        this._lastMediaLoadedInfo.source,
        this._lastMediaLoadedInfo.mediaLoadedInfo,
      );
    }

    if (wasInBackground !== this._inBackground) {
      this._host.requestUpdate();
    }
  }
}
