import { DisplayModeActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { FrigateCardAction } from './base';

export class DisplayModeSelectAction extends FrigateCardAction<DisplayModeActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    await api.getViewManager().setViewByParametersWithNewQuery({
      params: {
        displayMode: this._action.display_mode,
      },
    });
  }
}
