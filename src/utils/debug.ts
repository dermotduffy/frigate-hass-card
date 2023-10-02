import { CardWideConfig } from '../types';

export const log = (cardWideConfig?: CardWideConfig | null, ...args: unknown[]) => {
  if (cardWideConfig?.debug?.logging) {
    console.debug(...args);
  }
};
