import { View } from '../view/view';

export const getStreamCameraID = (view: View, cameraID?: string): string => {
  return (
    view.context?.live?.overrides?.get(cameraID ?? view.camera) ??
    cameraID ??
    view.camera
  );
};

export const hasSubstream = (view: View): boolean => {
  return getStreamCameraID(view) !== view.camera;
};

export const setSubstream = (view: View, substreamID: string): void => {
  const overrides: Map<string, string> = view.context?.live?.overrides ?? new Map();
  overrides.set(view.camera, substreamID);
  view.mergeInContext({
    live: { overrides: overrides },
  });
};

export const removeSubstream = (view: View): void => {
  const overrides: Map<string, string> | undefined = view.context?.live?.overrides;
  if (overrides && overrides.has(view.camera)) {
    view.context?.live?.overrides?.delete(view.camera);
  }
};
