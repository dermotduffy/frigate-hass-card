import { SubstreamSelectActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { SubstreamSelectViewModifier } from '../../view/modifiers/substream-select';
import { FrigateCardAction } from './base';

export class SubstreamSelectAction extends FrigateCardAction<SubstreamSelectActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    api.getViewManager().setViewByParameters({
      modifiers: [new SubstreamSelectViewModifier(this._action.camera)],
    });
  }
}
