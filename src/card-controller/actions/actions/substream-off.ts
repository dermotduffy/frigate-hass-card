import { GeneralActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { SubstreamOffViewModifier } from '../../view/modifiers/substream-off';
import { FrigateCardAction } from './base';

export class SubstreamOffAction extends FrigateCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    api.getViewManager().setViewByParameters({
      modifiers: [new SubstreamOffViewModifier()],
    });
  }
}
