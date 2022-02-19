import { ReactiveController, ReactiveControllerHost } from 'lit';

export class CachedValueController<T> implements ReactiveController {
  public value?: T;

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
   * Update the cached value (and reset the timer).
   */
  public updateValue(): void {
    this.value = this._callback();
    this._setTimer();
  }

  /**
   * Update the value and render it.
   */
  protected _updateValueAndRender(): void {
    this.updateValue();
    this._host.requestUpdate();
  }

  /**
   * Remove the timer.
   */
  protected _removeTimer(): void {
    clearInterval(this._timerID);
    this._timerID = undefined;
  }

  /**
   * Set the timer.
   */
   protected _setTimer(): void {
    clearInterval(this._timerID);
    if (this._timerSeconds > 0) {
      this._timerID = window.setInterval(() => {
          this._updateValueAndRender();
      }, this._timerSeconds * 1000);
    }
  }

  /**
   * Host has connected to the cache.
   */
  hostConnected(): void {
    this._updateValueAndRender();
  }

  /**
   * Host has disconnected from the cache.
   */
  hostDisconnected(): void {
    this._removeTimer();
  }
}
