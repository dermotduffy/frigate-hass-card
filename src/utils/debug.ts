import { CardWideConfig } from '../types';

export const log = (cardWideConfig?: CardWideConfig, ...args: unknown[]) => {
  if (cardWideConfig?.debug?.logging) {
    console.debug(...args);
  }
};
