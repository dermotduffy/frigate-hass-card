import { SubstreamSelectActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { FrigateCardAction } from './base';

export class SubstreamSelectAction extends FrigateCardAction<SubstreamSelectActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    api.getViewManager().setViewWithSubstream(this._action.camera);
  }
}
