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
    (typeof config?.camera_name === 'string' && config.camera_name) ||
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
    (typeof config?.camera_name === 'string' ? prettifyTitle(config.camera_name) : '') ||
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
