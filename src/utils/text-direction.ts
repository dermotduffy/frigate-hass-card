export type TextDirection = 'ltr' | 'rtl';

export const getTextDirection = (element: HTMLElement): TextDirection => {
  return getComputedStyle(element).direction === 'rtl' ? 'rtl' : 'ltr';
};
