/**
 * Determine if the card is currently being casted.
 * @returns
 */
export const isBeingCasted = (): boolean => {
  return !!navigator.userAgent.match(/CrKey\//);
};
