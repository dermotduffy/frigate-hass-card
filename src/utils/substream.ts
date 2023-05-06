import { CameraManager } from '../camera-manager/manager';
import { View } from '../view/view';
import { getAllDependentCameras } from './camera';

export const createViewWithSelectedSubstream = (
  view: View,
  substreamID: string,
): View | null => {
  const overrides: Map<string, string> = view.context?.live?.overrides ?? new Map();
  overrides.set(view.camera, substreamID);
  return view.clone().mergeInContext({
    live: { overrides: overrides },
  });
};

export const createViewWithoutSubstream = (view: View): View => {
  const newView = view.clone();
  const overrides: Map<string, string> | undefined = newView.context?.live?.overrides;
  if (overrides && overrides.has(view.camera)) {
    newView.context?.live?.overrides?.delete(view.camera);
  }
  return newView;
};

export const hasSubstream = (view: View): boolean => {
  const override = view?.context?.live?.overrides?.get(view.camera);
  return !!override && override !== view.camera;
};

export const createViewWithNextStream = (
  cameraManager: CameraManager,
  view: View,
): View => {
  const dependencies = [...getAllDependentCameras(cameraManager, view.camera)];
  if (dependencies.length <= 1) {
    return view.clone();
  }

  const newView = view.clone();
  const overrides: Map<string, string> = newView.context?.live?.overrides ?? new Map();
  const currentOverride = overrides.get(newView.camera) ?? newView.camera;
  const currentIndex = dependencies.indexOf(currentOverride);
  const newIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % dependencies.length;
  overrides.set(view.camera, dependencies[newIndex]);
  newView.mergeInContext({ live: { overrides: overrides } });

  return newView;
};
