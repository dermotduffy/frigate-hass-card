import { describe, expect, it } from 'vitest';
import { getDefaultGo2RTCEndpoint } from '../../../src/camera-manager/utils/go2rtc-endpoint.js';
import { createCameraConfig } from '../../test-utils.js';

describe('getDefaultGo2RTCEndpoint', () => {
  it('with local configuration', () => {
    expect(
      getDefaultGo2RTCEndpoint(
        createCameraConfig({
          go2rtc: {
            stream: 'stream',
            url: '/local/path',
          },
        }),
      ),
    ).toEqual({
      endpoint: '/local/path/api/ws?src=stream',
      sign: true,
    });
  });

  it('with remote configuration', () => {
    expect(
      getDefaultGo2RTCEndpoint(
        createCameraConfig({
          go2rtc: {
            stream: 'stream',
            url: 'https://my-custom-go2rtc',
          },
        }),
      ),
    ).toEqual({
      endpoint: 'https://my-custom-go2rtc/api/ws?src=stream',
      sign: false,
    });
  });

  it('without configuration', () => {
    expect(getDefaultGo2RTCEndpoint(createCameraConfig())).toBeNull();
  });
});
