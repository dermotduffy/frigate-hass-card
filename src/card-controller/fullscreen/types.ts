export type FullscreenHandler = () => void;

export interface FullscreenProvider {
  connect(): void;
  disconnect(): void;

  isInFullscreen(): boolean;
  isSupported(): boolean;

  setFullscreen(fullscreen: boolean): void;
}
