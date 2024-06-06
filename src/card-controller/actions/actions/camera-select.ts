import { CameraSelectActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { FrigateCardAction } from './base';

export class CameraSelectAction extends FrigateCardAction<CameraSelectActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    const selectCameraID =
      this._action.camera ??
      (this._action.triggered
        ? api.getTriggersManager().getMostRecentlyTriggeredCameraID()
        : null);
    const view = api.getViewManager().getView();
    const config = api.getConfigManager().getConfig();

    if (selectCameraID && view) {
      const viewOnCameraSelect = config?.view.camera_select ?? 'current';
      const targetViewName =
        viewOnCameraSelect === 'current' ? view.view : viewOnCameraSelect;
      api.getViewManager().setViewByParameters({
        viewName: targetViewName,
        cameraID: selectCameraID,
        failSafe: true,
      });
    }
  }
}
