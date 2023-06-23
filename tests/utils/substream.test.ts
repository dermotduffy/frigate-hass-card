import { describe, expect, it, vi } from 'vitest';
import { getAllDependentCameras } from '../../src/utils/camera';
import {
  createViewWithNextStream,
  createViewWithSelectedSubstream,
  createViewWithoutSubstream,
  hasSubstream,
} from '../../src/utils/substream';
import { View } from '../../src/view/view';
import { createCameraManager } from '../test-utils';

vi.mock('../../src/camera-manager/manager.js');
vi.mock('../../src/utils/camera');

describe('createViewWithSelectedSubstream', () => {
  it('should create view with selected substream', () => {
    const view = new View({ view: 'live', camera: 'camera' });
    const newView = createViewWithSelectedSubstream(view, 'substream');
    expect(newView?.context?.live?.overrides).toEqual(
      new Map([['camera', 'substream']]),
    );
  });

  it('should create view with selected substream with existing overrides', () => {
    const view = new View({
      view: 'live',
      camera: 'camera',
      context: {
        live: {
          overrides: new Map([['camera', 'camera']]),
        },
      },
    });
    const newView = createViewWithSelectedSubstream(view, 'substream');
    expect(newView?.context?.live?.overrides).toEqual(
      new Map([['camera', 'substream']]),
    );
  });
});

describe('createViewWithoutSubstream', () => {
  it('should create view without substream', () => {
    const view = new View({
      view: 'live',
      camera: 'camera',
      context: {
        live: {
          overrides: new Map([['camera', 'camera']]),
        },
      },
    });
    const newView = createViewWithoutSubstream(view);
    expect(newView?.context?.live?.overrides).toEqual(new Map());
  });
});

describe('hasSubstream', () => {
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
  });
  it('should not detect substream when absent', () => {
    const view = new View({
      view: 'live',
      camera: 'camera',
    });
    expect(hasSubstream(view)).toBeFalsy();
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
  });
});

describe('createViewWithNextStream', () => {
  it('should create new equal view with no dependencies', () => {
    const view = new View({
      view: 'live',
      camera: 'camera',
    });
    vi.mocked(getAllDependentCameras).mockReturnValue(new Set(['camera']));
    const cameraManager = createCameraManager()
    const newView = createViewWithNextStream(cameraManager, view);
    expect(newView.camera).toBe(view.camera);
    expect(newView.view).toBe(view.view);
    expect(newView.context).toEqual(view.context);
  });
  it('should create new view with next stream', () => {
    const view = new View({
      view: 'live',
      camera: 'camera',
    });
    vi.mocked(getAllDependentCameras).mockReturnValue(new Set(['camera', 'camera2']));
    const cameraManager = createCameraManager()
    const newView = createViewWithNextStream(cameraManager, view);
    expect(newView.context?.live?.overrides).toEqual(new Map([['camera', 'camera2']]));
  });
  it('should create new view with next stream that cycles back', () => {
    const view = new View({
      view: 'live',
      camera: 'camera',
      context: {
        live: {
          overrides: new Map([['camera', 'camera2']]),
        },
      },
    });
    vi.mocked(getAllDependentCameras).mockReturnValue(new Set(['camera', 'camera2']));
    const cameraManager = createCameraManager()
    const newView = createViewWithNextStream(cameraManager, view);
    expect(newView.context?.live?.overrides).toEqual(new Map([['camera', 'camera']]));
  });
  it('should create new view with first stream with invalid substream', () => {
    const view = new View({
      view: 'live',
      camera: 'camera',
      context: {
        live: {
          overrides: new Map([['camera', 'camera-that-does-not-exist']]),
        },
      },
    });
    vi.mocked(getAllDependentCameras).mockReturnValue(new Set(['camera', 'camera2']));
    const cameraManager = createCameraManager()
    const newView = createViewWithNextStream(cameraManager, view);
    expect(newView.context?.live?.overrides).toEqual(new Map([['camera', 'camera']]));
  });
});
