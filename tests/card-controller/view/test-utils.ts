import { vi } from 'vitest';
import { CardController } from '../../../src/card-controller/controller';
import { RawFrigateCardConfig } from '../../../src/config/types';
import {
  createCameraManager,
  createCapabilities,
  createCardAPI,
  createConfig,
  createStore,
} from '../../test-utils';

export const createPopulatedAPI = (config?: RawFrigateCardConfig): CardController => {
  const api = createCardAPI();
  vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
  vi.mocked(api.getCameraManager().getStore).mockReturnValue(
    createStore([
      {
        cameraID: 'camera.office',
        capabilities: createCapabilities({
          live: true,
          snapshots: true,
          clips: true,
          recordings: true,
          substream: true,
        }),
      },
      {
        cameraID: 'camera.kitchen',
        capabilities: createCapabilities({
          live: true,
          snapshots: true,
          clips: true,
          recordings: true,
          substream: true,
        }),
      },
    ]),
  );
  vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig(config));
  return api;
};
