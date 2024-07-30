import { describe, expect, it, vi } from 'vitest';
import { CardController } from '../../../../src/card-controller/controller';
import { SubstreamOnViewModifier } from '../../../../src/card-controller/view/modifiers/substream-on';
import { RawFrigateCardConfig } from '../../../../src/config/types';
import {
  getStreamCameraID,
  hasSubstream,
  setSubstream,
} from '../../../../src/utils/substream';
import {
  createCameraConfig,
  createCameraManager,
  createCapabilities,
  createCardAPI,
  createConfig,
  createStore,
  createView,
} from '../../../test-utils';

const createAPIWithSubstreams = (config?: RawFrigateCardConfig): CardController => {
  const api = createCardAPI();
  vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
  vi.mocked(api.getCameraManager().getStore).mockReturnValue(
    createStore([
      {
        cameraID: 'camera.office',
        capabilities: createCapabilities({
          live: true,
          substream: true,
        }),
        config: createCameraConfig({
          dependencies: {
            all_cameras: true,
          },
        }),
      },
      {
        cameraID: 'camera.kitchen',
        capabilities: createCapabilities({
          substream: true,
        }),
      },
    ]),
  );
  vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig(config));
  return api;
};

describe('should turn on substream', () => {
  it('substream available', () => {
    const view = createView({
      view: 'live',
      camera: 'camera.office',
    });

    expect(hasSubstream(view)).toBe(false);

    const api = createAPIWithSubstreams();

    const modifier = new SubstreamOnViewModifier(api);
    modifier.modify(view);

    expect(hasSubstream(view)).toBe(true);
    expect(getStreamCameraID(view)).toBe('camera.kitchen');

    modifier.modify(view);

    expect(hasSubstream(view)).toBe(false);
    expect(getStreamCameraID(view)).toBe('camera.office');
  });

  it('malformed substream', () => {
    const view = createView({
      view: 'live',
      camera: 'camera.office',
    });

    const api = createAPIWithSubstreams();

    setSubstream(view, 'NOT_A_REAL_CAMERA');

    const modifier = new SubstreamOnViewModifier(api);
    modifier.modify(view);

    expect(hasSubstream(view)).toBe(false);
    expect(getStreamCameraID(view)).toBe('camera.office');
  });

  it('substream unavailable', () => {
    const view = createView({
      view: 'live',
      camera: 'camera.office',
    });

    expect(hasSubstream(view)).toBe(false);

    const api = createCardAPI();
    vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());

    const modifier = new SubstreamOnViewModifier(api);
    modifier.modify(view);

    expect(hasSubstream(view)).toBe(false);
  });
});
