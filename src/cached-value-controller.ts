import { ReactiveController, ReactiveControllerHost } from 'lit';

export class CachedValueController<T> implements ReactiveController {
  protected _value?: T;
  protected _host: ReactiveControllerHost;
  protected _timerSeconds: number;
  protected _callback: () => T;
  protected _timerID?: number;

  constructor(host: ReactiveControllerHost, timerSeconds: number, callback: () => T) {
    this._timerSeconds = timerSeconds;
    this._callback = callback;
    (this._host = host).addController(this);
  }

  /**
   * Remove the controller for the host.
   */
  public removeController(): void {
    this._host.removeController(this);
  }

  /**
   * Get the value.
   */
  get value(): T | undefined {
    return this._value;
  }

  /**
   * Update the cached value.
   */
  public updateValue(): void {
    this._value = this._callback();
  }

  /**
   * Clear the cached value.
   */
  public clearValue(): void {
    this._value = undefined;
  }

  /**
   * Disable the timer.
   */
  public stopTimer(): void {
    if (this._timerID !== undefined) {
      window.clearInterval(this._timerID);
    }
    this._timerID = undefined;
  }

  /**
   * Enable the timer. Repeated calls will have no effect.
   */
  public startTimer(): void {
    this.stopTimer();

    if (this._timerSeconds > 0) {
      this._timerID = window.setInterval(() => {
        this.updateValue();
        this._host.requestUpdate();
      }, this._timerSeconds * 1000);
    }
  }

  /**
   * Host has connected to the cache.
   */
  hostConnected(): void {
    this.updateValue();
    this.startTimer();
    this._host.requestUpdate();
  }

  /**
   * Host has disconnected from the cache.
   */
  hostDisconnected(): void {
    this.clearValue();
    this.stopTimer();
  }
}
