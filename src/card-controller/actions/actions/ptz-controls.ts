import { PTZControlsActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { FrigateCardAction } from './base';

export class PTZControlsAction extends FrigateCardAction<PTZControlsActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    api.getViewManager().setViewWithMergedContext({
      ptzControls: { enabled: this._action.enabled },
    });
  }
}
