import add from 'date-fns/add';
import { HassEntities } from 'home-assistant-js-websocket';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ScanOptions } from '../../../src/config/types';
import { TriggersManager } from '../../../src/utils/card-controller/triggers-manager';
import {
  createCameraConfig,
  createCameraManager,
  createCardAPI,
  createConfig,
  createHASS,
  createStateEntity,
  createView,
} from '../../test-utils';

vi.mock('../../../src/camera-manager/manager.js');

// Creating and mocking a trigger API is a lot of boilerplate, this convenience
// function reduces it.
const createTriggerAPI = (options?: {
  config?: Partial<ScanOptions>;
  hassStates?: HassEntities;
  interaction?: boolean;
}) => {
  const api = createCardAPI();
  vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
    createConfig({
      view: {
        scan: options?.config ?? {
          enabled: true,
          untrigger_reset: true,
          untrigger_seconds: 10,
        },
      },
    }),
  );
  vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
    createHASS(options?.hassStates),
  );
  vi.mocked(api.getCameraManager).mockReturnValue(
    createCameraManager({
      configs: new Map([
        [
          'camera_1',
          createCameraConfig({
            triggers: {
              entities: ['binary_sensor.motion'],
            },
          }),
        ],
      ]),
    }),
  );
  vi.mocked(api.getInteractionManager().hasInteraction).mockReturnValue(
    options?.interaction ?? false,
  );

  return api;
};

// @vitest-environment jsdom
describe('TriggersManager', () => {
  const hassActiveState = {
    'binary_sensor.motion': createStateEntity({ state: 'on' }),
  };
  const hassInactiveState = {
    'binary_sensor.motion': createStateEntity({ state: 'off' }),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.useFakeTimers();
  });

  it('should not be triggered by default', () => {
    const manager = new TriggersManager(createCardAPI());
    expect(manager.isTriggered()).toBeFalsy();
  });

  it('should not trigger when scan mode disabled default', () => {
    const api = createTriggerAPI({
      config: { enabled: false },
      hassStates: hassActiveState,
    });
    const manager = new TriggersManager(api);

    manager.updateTriggeredCameras(null);

    expect(manager.isTriggered()).toBeFalsy();
  });

  it('should trigger and untrigger based on entity state', () => {
    const start = new Date('2023-10-01T17:14');
    vi.setSystemTime(start);
    const api = createTriggerAPI({
      hassStates: hassActiveState,
    });
    const manager = new TriggersManager(api);

    manager.updateTriggeredCameras(createHASS(hassInactiveState));

    expect(manager.isTriggered()).toBeTruthy();
    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      viewName: 'live',
      cameraID: 'camera_1',
    });

    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
      createHASS(hassInactiveState),
    );

    manager.updateTriggeredCameras(createHASS(hassActiveState));

    // Intentional state update with no change.
    manager.updateTriggeredCameras(createHASS(hassActiveState));

    // Will still be triggered, but untrigger timer will be running.
    expect(manager.isTriggered()).toBeTruthy();

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    expect(manager.isTriggered()).toBeFalsy();
    expect(api.getViewManager().setViewDefault).toBeCalled();
  });

  it('should trigger and set view if current view is wrong', () => {
    const api = createTriggerAPI({
      hassStates: hassActiveState,
    });
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({
        // Correct camera, but wrong view.
        view: 'clips',
        camera: 'camera_1',
      }),
    );
    const manager = new TriggersManager(api);
    manager.updateTriggeredCameras(null);

    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      viewName: 'live',
      cameraID: 'camera_1',
    });
  });

  it('should trigger when entity state is active on startup', () => {
    const api = createTriggerAPI({
      hassStates: hassActiveState,
    });
    const manager = new TriggersManager(api);
    expect(manager.isTriggered()).toBeFalsy();

    manager.updateTriggeredCameras(null);
    expect(manager.isTriggered()).toBeTruthy();
  });

  it('should untrigger manually', () => {
    const api = createTriggerAPI({
      hassStates: hassActiveState,
    });
    const manager = new TriggersManager(api);

    // Untriggering when not triggered.
    manager.untrigger();
    expect(api.getViewManager().setViewDefault).not.toBeCalled();

    manager.updateTriggeredCameras(null);
    expect(manager.isTriggered()).toBeTruthy();

    manager.untrigger();
    expect(manager.isTriggered()).toBeFalsy();
    expect(api.getViewManager().setViewDefault).toBeCalled();
  });

  it('should take no actions when automated actions are not allowed', () => {
    const api = createTriggerAPI({
      hassStates: hassActiveState,
      // Interaction present.
      interaction: true,
    });
    const manager = new TriggersManager(api);
    manager.updateTriggeredCameras(null);
    expect(manager.isTriggered()).toBeTruthy();
    expect(api.getViewManager().setViewByParameters).not.toBeCalled();

    manager.untrigger();
    expect(api.getViewManager().setViewDefault).not.toBeCalled();
  });
});
