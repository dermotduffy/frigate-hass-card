import { CameraConfig, RawFrigateCardConfig } from '../types.js';

/**
 * Get a camera id.
 * @param config The camera config (either parsed or raw).
 * @returns A camera id.
 */
export function getCameraID(
  config?: CameraConfig | RawFrigateCardConfig | null,
): string {
  return (
    (typeof config?.id === 'string' && config.id) ||
    (typeof config?.camera_entity === 'string' && config.camera_entity) ||
    (typeof config?.webrtc_card === 'object' &&
      config.webrtc_card &&
      typeof config.webrtc_card['entity'] === 'string' &&
      config.webrtc_card['entity']) ||
    (typeof config?.frigate === 'object' &&
      config.frigate &&
      typeof config?.frigate['camera_name'] === 'string' &&
      config.frigate['camera_name']) ||
    ''
  );
}

/**
 * Get all cameras that depend on a given camera.
 * @param cameras Cameras map.
 * @param cameraID ID of the target camera.
 * @returns A set of query parameters.
 */
export const getAllDependentCameras = (
  cameras: Map<string, CameraConfig>,
  cameraID?: string,
): Set<string> => {
  const cameraIDs: Set<string> = new Set();
  const getDependentCameras = (cameraID: string): void => {
    const cameraConfig = cameras.get(cameraID);
    if (cameraConfig) {
      cameraIDs.add(cameraID);
      const dependentCameras: Set<string> = new Set();
      (cameraConfig.dependencies.cameras || []).forEach((item) =>
        dependentCameras.add(item),
      );
      if (cameraConfig.dependencies.all_cameras) {
        cameras.forEach((_, key) => dependentCameras.add(key));
      }
      for (const eventCameraID of dependentCameras) {
        if (!cameraIDs.has(eventCameraID)) {
          getDependentCameras(eventCameraID);
        }
      }
    }
  };
  if (cameraID) {
    getDependentCameras(cameraID);
  }
  return cameraIDs;
};
