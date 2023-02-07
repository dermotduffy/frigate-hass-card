import { CardWideConfig } from '../types';

export const log = (cardWideConfig?: CardWideConfig, ...args: unknown[]) => {
  if (cardWideConfig?.debug?.logging) {
    console.debug(...args);
  }
};

/**
 * For debug purposes only.
 * @param seconds
 */
// ts-prune-ignore-next
export const sleep = async (seconds: number) => {
  await new Promise((r) => setTimeout(r, seconds * 1000));
};
