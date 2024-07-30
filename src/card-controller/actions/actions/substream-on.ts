import { GeneralActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { SubstreamOnViewModifier } from '../../view/modifiers/substream-on';
import { FrigateCardAction } from './base';

export class SubstreamOnAction extends FrigateCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    api.getViewManager().setViewByParameters({
      modifiers: [new SubstreamOnViewModifier(api)],
    });
  }
}
