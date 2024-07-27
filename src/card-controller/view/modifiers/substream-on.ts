import { CameraManager } from '../../../camera-manager/manager';
import { getStreamCameraID, setSubstream } from '../../../utils/substream';
import { View } from '../../../view/view';
import { ViewModifier } from '../types';

interface SubstreamOnViewModifierAPI {
  getCameraManager(): CameraManager;
}

export class SubstreamOnViewModifier implements ViewModifier {
  protected _api: SubstreamOnViewModifierAPI;

  constructor(api: SubstreamOnViewModifierAPI) {
    this._api = api;
  }

  public modify(view: View): void {
    const dependencies = [
      ...this._api
        .getCameraManager()
        .getStore()
        .getAllDependentCameras(view.camera, 'substream'),
    ];

    if (dependencies.length <= 1) {
      return;
    }

    const currentOverride = getStreamCameraID(view);
    const currentIndex = dependencies.indexOf(currentOverride);
    const newIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % dependencies.length;

    setSubstream(view, dependencies[newIndex]);
  }
}
