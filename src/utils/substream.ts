import { View } from '../view/view';

export const getStreamCameraID = (view: View, cameraID?: string): string => {
  return view.context?.live?.overrides?.get(cameraID ?? view.camera) ?? view.camera;
};

export const hasSubstream = (view: View): boolean => {
  return getStreamCameraID(view) !== view.camera;
};
