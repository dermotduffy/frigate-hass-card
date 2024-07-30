import { removeSubstream } from '../../../utils/substream';
import { View } from '../../../view/view';
import { ViewModifier } from '../types';

export class SubstreamOffViewModifier implements ViewModifier {
  public modify(view: View): void {
    removeSubstream(view);
  }
}
