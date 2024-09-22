import { describe, expect, it } from 'vitest';
import { Capabilities } from '../../src/camera-manager/capabilities';
import {
  getPTZTarget,
  hasCameraTruePTZ,
  ptzActionToCapabilityKey,
} from '../../src/utils/ptz';
import {
  TestViewMedia,
  createCameraManager,
  createStore,
  createView,
} from '../test-utils';
import { MediaQueriesResults } from '../../src/view/media-queries-results';
import { FrigateCardView } from '../../src/config/types';

describe('getPTZTarget', () => {
  describe('in a viewer view', () => {
    it('with media', () => {
      const media = [new TestViewMedia({ id: 'media-id' })];
      const view = createView({
        view: 'media',
        queryResults: new MediaQueriesResults({ results: media, selectedIndex: 0 }),
      });
      expect(getPTZTarget(view, { cameraManager: createCameraManager() })).toEqual({
        targetID: 'media-id',
        type: 'digital',
      });
    });

    it('without media', () => {
      const view = createView({
        view: 'media',
      });
      expect(getPTZTarget(view, { cameraManager: createCameraManager() })).toBeNull();
    });

    it('with true PTZ restriction', () => {
      const media = [new TestViewMedia({ id: 'media-id' })];
      const view = createView({
        view: 'media',
        queryResults: new MediaQueriesResults({ results: media, selectedIndex: 0 }),
      });
      expect(
        getPTZTarget(view, { type: 'ptz', cameraManager: createCameraManager() }),
      ).toBeNull();
    });
  });

  describe('in live view', () => {
    it('without restriction with true PTZ capability', () => {
      const view = createView({
        view: 'live',
        camera: 'camera-1',
      });
      const store = createStore([
        {
          cameraID: 'camera-1',
          capabilities: new Capabilities({ ptz: { left: ['relative'] } }),
        },
      ]);

      expect(getPTZTarget(view, { cameraManager: createCameraManager(store) })).toEqual({
        targetID: 'camera-1',
        type: 'ptz',
      });
    });

    it('without restriction without true PTZ capability', () => {
      const view = createView({
        view: 'live',
        camera: 'camera-1',
      });

      expect(getPTZTarget(view, { cameraManager: createCameraManager() })).toEqual({
        targetID: 'camera-1',
        type: 'digital',
      });
    });

    it('with truePTZ restriction without true PTZ capability', () => {
      const view = createView({
        view: 'live',
        camera: 'camera-1',
      });

      expect(
        getPTZTarget(view, { type: 'ptz', cameraManager: createCameraManager() }),
      ).toBeNull();
    });

    it('with digitalPTZ restriction with true PTZ capability', () => {
      const view = createView({
        view: 'live',
        camera: 'camera-1',
      });
      const store = createStore([
        {
          cameraID: 'camera-1',
          capabilities: new Capabilities({ ptz: { left: ['relative'] } }),
        },
      ]);

      expect(
        getPTZTarget(view, {
          type: 'digital',
          cameraManager: createCameraManager(store),
        }),
      ).toEqual({
        targetID: 'camera-1',
        type: 'digital',
      });
    });
  });

  describe('in non-media views', () => {
    it.each([['timeline' as const], ['diagnostics' as const]])(
      '%s',
      (viewName: FrigateCardView) => {
        const view = createView({
          view: viewName,
        });
        expect(getPTZTarget(view, { cameraManager: createCameraManager() })).toBeNull();
      },
    );
  });
});

describe('hasCameraTruePTZ', () => {
  it('with true PTZ', () => {
    const store = createStore([
      {
        cameraID: 'camera-1',
        capabilities: new Capabilities({ ptz: { left: ['relative'] } }),
      },
    ]);

    expect(hasCameraTruePTZ(createCameraManager(store), 'camera-1')).toBeTruthy();
  });

  it('without true PTZ', () => {
    expect(hasCameraTruePTZ(createCameraManager(createStore()), 'camera-1')).toBeFalsy();
  });
});

it('ptzActionToCapabilityKey', () => {
  expect(ptzActionToCapabilityKey('left')).toBe('left');
  expect(ptzActionToCapabilityKey('right')).toBe('right');
  expect(ptzActionToCapabilityKey('up')).toBe('up');
  expect(ptzActionToCapabilityKey('down')).toBe('down');
  expect(ptzActionToCapabilityKey('zoom_in')).toBe('zoomIn');
  expect(ptzActionToCapabilityKey('zoom_out')).toBe('zoomOut');
  expect(ptzActionToCapabilityKey('preset')).toBeNull();
});
