import { ViewActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { FrigateCardAction } from './base';

export class ViewAction extends FrigateCardAction<ViewActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await api.getViewManager().setViewByParametersWithNewQuery({
      params: {
        view: this._action.frigate_card_action,
      },
    });
  }
}
