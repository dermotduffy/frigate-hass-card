import { errorToConsole } from '../utils/basic';
import { Timer } from '../utils/timer';
import { CardMicrophoneAPI } from './types';

export type MicrophoneManagerListenerChange = 'muted' | 'unmuted';
type MicrophoneManagerListener = (change: MicrophoneManagerListenerChange) => void;

export interface ReadonlyMicrophoneManager {
  getStream(): MediaStream | undefined;
  addListener(listener: MicrophoneManagerListener): void;
  removeListener(listener: MicrophoneManagerListener): void;
  isConnected(): boolean;
  isForbidden(): boolean;
  isMuted(): boolean;
}

export class MicrophoneManager implements ReadonlyMicrophoneManager {
  protected _api: CardMicrophoneAPI;
  protected _stream?: MediaStream | null;
  protected _timer = new Timer();
  protected _listeners: MicrophoneManagerListener[] = [];

  // We keep mute state separate from the stream state so that mute/unmute can
  // be expressed before the stream is created -- and when it's create it will
  // have the right mute status.
  protected _mute = true;

  constructor(api: CardMicrophoneAPI) {
    this._api = api;
  }

  public async connect(): Promise<boolean> {
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch (e: unknown) {
      errorToConsole(e as Error);

      this._stream = null;
      this._api.getCardElementManager().update();
      return false;
    }
    this._setMute();
    return true;
  }

  public async disconnect(): Promise<void> {
    this._stream?.getTracks().forEach((track) => track.stop());

    this._stream = undefined;
    this._api.getCardElementManager().update();
  }

  public getStream(): MediaStream | undefined {
    return this._stream ?? undefined;
  }

  public mute(): void {
    const wasMuted = this.isMuted();

    this._mute = true;
    this._setMute();

    if (!wasMuted) {
      this._callListeners('muted');
    }
  }

  public async unmute(): Promise<void> {
    const wasUnmuted = !this.isMuted();

    const unmute = (): void => {
      this._mute = false;
      this._setMute();
    };

    if (!this.isConnected() && !this.isForbidden()) {
      // The connect() call is async and make take an arbitrary amount of
      // time for the user to grant access to their microphone. With a
      // momentary microphone button the mute call (on mouse release) may
      // arrive before the connection is even granted, so we unmute first
      // before the connection is made, so the mute call on release will not
      // be 'overwritten' incorrectly.
      unmute();
      await this.connect();
    } else if (this.isConnected()) {
      unmute();
    }

    if (!wasUnmuted) {
      this._callListeners('unmuted');
    }
  }

  public isConnected(): boolean {
    return !!this._stream;
  }

  public isForbidden(): boolean {
    return this._stream === null;
  }

  public isMuted(): boolean {
    // For safety, this function always returns the stream mute status directly
    // (rather the internal state).
    return !this._stream || this._stream.getTracks().every((track) => !track.enabled);
  }

  public addListener(listener: MicrophoneManagerListener): void {
    this._listeners.push(listener);
  }

  public removeListener(listener: MicrophoneManagerListener): void {
    this._listeners = this._listeners.filter((l) => l !== listener);
  }

  protected _callListeners(change: MicrophoneManagerListenerChange): void {
    this._listeners.forEach((listener) => listener(change));
  }

  protected _setMute(): void {
    this._stream?.getTracks().forEach((track) => {
      track.enabled = !this._mute;
    });

    this._startTimer();
    this._api.getCardElementManager().update();
  }

  protected _startTimer(): void {
    const microphoneConfig = this._api.getConfigManager().getConfig()?.live.microphone;

    if (microphoneConfig?.always_connected) {
      return;
    }

    const disconnectSeconds = microphoneConfig?.disconnect_seconds ?? 0;

    if (disconnectSeconds) {
      this._timer.start(disconnectSeconds, () => {
        this.disconnect();
      });
    }
  }
}
