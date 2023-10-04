import { describe, expect, it } from 'vitest';
import { getStreamCameraID, hasSubstream } from '../../src/utils/substream';
import { View } from '../../src/view/view';

describe('hasSubstream/getStreamCameraID', () => {
  it('should detect substream', () => {
    const view = new View({
      view: 'live',
      camera: 'camera',
      context: {
        live: {
          overrides: new Map([['camera', 'camera2']]),
        },
      },
    });
    expect(hasSubstream(view)).toBeTruthy();
    expect(getStreamCameraID(view)).toBe('camera2');
  });
  it('should not detect substream when absent', () => {
    const view = new View({
      view: 'live',
      camera: 'camera',
    });
    expect(hasSubstream(view)).toBeFalsy();
    expect(getStreamCameraID(view)).toBe('camera');
  });
  it('should not detect substream when main stream', () => {
    const view = new View({
      view: 'live',
      camera: 'camera',
      context: {
        live: {
          overrides: new Map([['camera', 'camera']]),
        },
      },
    });
    expect(hasSubstream(view)).toBeFalsy();
    expect(getStreamCameraID(view)).toBe('camera');
  });
});
