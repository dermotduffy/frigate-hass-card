import { HomeAssistant } from 'custom-card-helpers';
import { CameraConfig, RawFrigateCardConfig } from '../types.js';
import { prettifyTitle } from './basic.js';
import { getEntityIcon, getEntityTitle } from './ha';

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
 * Get a camera text title.
 * @param hass The Home Assistant object.
 * @param config The camera config (either parsed or raw).
 * @returns A title string.
 */
export function getCameraTitle(
  hass?: HomeAssistant,
  config?: CameraConfig | RawFrigateCardConfig | null,
): string {
  // Attempt to render a recognizable name for the camera,
  // starting with the most likely to be useful and working our
  // ways towards the least useful. Extra type checking here since this is also
  // used on raw configuration in the editor.
  return (
    (typeof config?.title === 'string' && config.title) ||
    (typeof config?.camera_entity === 'string'
      ? getEntityTitle(hass, config.camera_entity)
      : '') ||
    (typeof config?.webrtc_card === 'object' &&
      config.webrtc_card &&
      typeof config.webrtc_card['entity'] === 'string' &&
      config.webrtc_card['entity']) ||
    (typeof config?.frigate === 'object' &&
    config.frigate &&
    typeof config?.frigate['camera_name'] === 'string' &&
    config.frigate['camera_name']
      ? prettifyTitle(config.frigate['camera_name'])
      : '') ||
    (typeof config?.id === 'string' && config.id) ||
    ''
  );
}

/**
 * Get a camera icon.
 * @param hass The Home Assistant object.
 * @param config The camera config.
 * @returns An icon string.
 */
export function getCameraIcon(
  hass?: HomeAssistant,
  config?: CameraConfig | null,
): string {
  return config?.icon || getEntityIcon(hass, config?.camera_entity) || 'mdi:video';
}

/**
 * Get all cameras that depend on a given camera.
 * @param cameras Cameras map.
 * @param camera Name of the target camera.
 * @returns A set of query parameters.
 */
export const getAllDependentCameras = (
  cameras: Map<string, CameraConfig>,
  camera?: string,
): Set<string> => {
  const cameraIDs: Set<string> = new Set();
  const getDependentCameras = (camera: string): void => {
    const cameraConfig = cameras.get(camera);
    if (cameraConfig) {
      cameraIDs.add(camera);
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
  if (camera) {
    getDependentCameras(camera);
  }
  return cameraIDs;
};

/**
 * Return the cameraIDs of truly unique cameras (some configured cameras may be
 * the same Frigate came but with different zone/labels).
 * @param cameras The full set of cameras.
 * @param cameraIDs The specific IDs to dedup.
 */
export const getTrueCameras = (
  cameras: Map<string, CameraConfig>,
  cameraIDs: Set<string>,
): Set<string> => {
  const getTrueCameraID = (cameraConfig: CameraConfig): string => {
    return `${cameraConfig.frigate?.client_id ?? ''}/${
      cameraConfig.frigate.camera_name ?? ''
    }`;
  };

  const output = new Set<string>();
  const visitedTrueCameras = new Set<string>();
  cameraIDs.forEach((cameraID: string) => {
    const cameraConfig = cameras.get(cameraID) ?? null;
    if (cameraConfig && cameraConfig.frigate.camera_name) {
      const trueCameraID = getTrueCameraID(cameraConfig);
      if (!visitedTrueCameras.has(trueCameraID)) {
        output.add(cameraID);
        visitedTrueCameras.add(trueCameraID);
      }
    }
  });
  return output;
};
