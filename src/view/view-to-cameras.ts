import { CameraManager } from '../camera-manager/manager';
import { FrigateCardView } from '../config/types';

/**
 * Get cameraIDs that are relevant for a given view name based on camera
 * capability (if camera specified).
 */
export const getCameraIDsForViewName = (
  cameraManager: CameraManager,
  viewName: FrigateCardView,
  cameraID?: string,
): Set<string> => {
  switch (viewName) {
    case 'image':
    case 'diagnostics':
      return cameraManager.getStore().getCameraIDs();

    case 'live':
    case 'clip':
    case 'clips':
    case 'snapshot':
    case 'snapshots':
    case 'recording':
    case 'recordings':
      const capability =
        viewName === 'clip'
          ? 'clips'
          : viewName === 'snapshot'
            ? 'snapshots'
            : viewName === 'recording'
              ? 'recordings'
              : viewName;
      return cameraID
        ? cameraManager.getStore().getAllDependentCameras(cameraID, capability)
        : cameraManager.getStore().getCameraIDsWithCapability(capability);

    case 'timeline':
      return cameraManager.getStore().getCameraIDsWithCapability({
        anyCapabilities: ['clips', 'snapshots', 'recordings'],
      });

    case 'media':
      return cameraID
        ? cameraManager.getStore().getAllDependentCameras(cameraID, {
            anyCapabilities: ['clips', 'snapshots', 'recordings'],
          })
        : cameraManager.getStore().getCameraIDsWithCapability({
            anyCapabilities: ['clips', 'snapshots', 'recordings'],
          });
  }
};
