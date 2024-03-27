import { CameraConfig } from '../../config/types';

export const getCameraEntityFromConfig = (cameraConfig: CameraConfig): string | null => {
  return cameraConfig.camera_entity ?? cameraConfig.webrtc_card?.entity ?? null;
};
