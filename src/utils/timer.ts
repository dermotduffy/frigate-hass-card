export class Timer {
  protected _timer: number | null = null;

  public stop(): void {
    if (this._timer) {
      window.clearTimeout(this._timer);
      this._timer = null;
    }
  }

  public isRunning(): boolean {
    return this._timer !== null;
  }

  public start(seconds: number, func: () => void): void {
    this.stop();
    this._timer = window.setTimeout(() => {
      this._timer = null;
      func();
    }, seconds * 1000);
  }

  public startRepeated(seconds: number, func: () => void): void {
    this.stop();
    this._timer = window.setInterval(() => {
      func();
    }, seconds * 1000);
  }
}
