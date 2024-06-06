import { ViewActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { FrigateCardAction } from './base';

export class ViewAction extends FrigateCardAction<ViewActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    api.getViewManager().setViewByParameters({
      viewName: this._action.frigate_card_action,

      // Note: This function needs to process (view-related) commands even when
      // _view has not yet been initialized (since it may be used to set a view
      // via the querystring).
      cameraID: api.getViewManager().getView()?.camera,
    });
  }
}
