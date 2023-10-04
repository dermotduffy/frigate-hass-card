import { View } from '../view/view';

export const getStreamCameraID = (view: View): string => {
  return view?.context?.live?.overrides?.get(view.camera) ?? view.camera;
};

export const hasSubstream = (view: View): boolean => {
  return getStreamCameraID(view) !== view.camera;
};
