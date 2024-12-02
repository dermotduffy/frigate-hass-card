import { View } from '../../../view/view';
import { ViewModifier } from '../types';

export const applyViewModifiers = (
  view: View,
  modifiers?: ViewModifier[] | null,
): void => {
  modifiers?.forEach((modifier) => modifier.modify(view));
};
