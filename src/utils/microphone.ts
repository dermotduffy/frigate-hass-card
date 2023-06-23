import { errorToConsole } from './basic';
import { Timer } from './timer';

export class MicrophoneController {
  protected _stream?: MediaStream | null;
  protected _timer = new Timer();

  // We keep mute state separate from the stream state so that mute/unmute can
  // be expressed before the stream is created -- and when it's create it will
  // have the right mute status.
  protected _mute = true;

  protected _disconnectSeconds: number;

  constructor(disconnectSeconds?: number) {
    this._disconnectSeconds = disconnectSeconds ?? 0;
  }

  public async connect(): Promise<void> {
    try {
      this._stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
    } catch (e: unknown) {
      errorToConsole(e as Error);
      this._stream = null;
    }
    this._setMute();
  }

  public async disconnect(): Promise<void> {
    this._stream?.getTracks().forEach((track) => track.stop());
    this._stream = undefined;
  }

  public getStream(): MediaStream | undefined {
    return this._stream ?? undefined;
  }

  protected _setMute(): void {
    this._stream?.getTracks().forEach((track) => {
      track.enabled = !this._mute;
    });
    this._startTimer();
  }

  public mute(): void {
    this._mute = true;
    this._setMute();
  }

  public unmute(): void {
    this._mute = false;
    this._setMute();
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

  protected _startTimer(): void {
    if (this._disconnectSeconds) {
      this._timer.start(this._disconnectSeconds, () => {
        this.disconnect();
      });
    }
  }
}
