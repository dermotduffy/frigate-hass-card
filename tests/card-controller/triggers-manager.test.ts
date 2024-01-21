import add from 'date-fns/add';
import { HassEntities } from 'home-assistant-js-websocket';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CardController } from '../../src/card-controller/controller';
import { TriggersManager } from '../../src/card-controller/triggers-manager';
import { ScanOptions, scanSchema } from '../../src/config/types';
import {
  createCameraConfig,
  createCameraManager,
  createCardAPI,
  createConfig,
  createHASS,
  createStateEntity,
  createStore,
  createView,
} from '../test-utils';

const baseScanConfig: Partial<ScanOptions> = {
  enabled: true,
  untrigger_seconds: 10,
  filter_selected_camera: false,
  actions: {
    trigger: 'live' as const,
    untrigger: 'default' as const,
    interaction_mode: 'inactive' as const,
  },
};

// Creating and mocking a trigger API is a lot of boilerplate, this convenience
// function reduces it.
const createTriggerAPI = (options?: {
  config?: Partial<ScanOptions>;
  hassStates?: HassEntities;
  interaction?: boolean;
}): CardController => {
  const api = createCardAPI();
  vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
    createConfig({
      view: {
        scan: options?.config ? scanSchema.parse(options.config) : baseScanConfig,
      },
    }),
  );
  vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
    createHASS(options?.hassStates),
  );
  vi.mocked(api.getCameraManager).mockReturnValue(createCameraManager());
  vi.mocked(api.getCameraManager().getStore).mockReturnValue(
    createStore([
      {
        cameraID: 'camera_1',
        config: createCameraConfig({
          triggers: {
            entities: ['binary_sensor.motion'],
          },
        }),
      },
    ]),
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

    manager.updateTriggerHAState(null);

    expect(manager.isTriggered()).toBeFalsy();
  });

  it('should not trigger without a scan config', () => {
    const api = createTriggerAPI({
      hassStates: hassActiveState,
    });

    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({
        camera: 'camera_1' as const,
      }),
    );
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(null);

    const manager = new TriggersManager(api);
    manager.updateView(null);
    expect(manager.isTriggered()).toBeFalsy();
  });

  it('should trigger and untrigger based on entity state', () => {
    const start = new Date('2023-10-01T17:14');
    vi.setSystemTime(start);
    const api = createTriggerAPI({
      hassStates: hassActiveState,
    });
    const manager = new TriggersManager(api);

    manager.updateTriggerHAState(createHASS(hassInactiveState));

    expect(manager.isTriggered()).toBeTruthy();
    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      viewName: 'live' as const,
      cameraID: 'camera_1' as const,
    });

    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
      createHASS(hassInactiveState),
    );

    manager.updateTriggerHAState(createHASS(hassActiveState));

    // Intentional state update with no change.
    manager.updateTriggerHAState(createHASS(hassActiveState));

    // Will still be triggered, but untrigger timer will be running.
    expect(manager.isTriggered()).toBeTruthy();

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    expect(manager.isTriggered()).toBeFalsy();

    expect(api.getViewManager().setViewDefault).toBeCalled();
  });

  it('should trigger when entity state is active on startup', () => {
    const api = createTriggerAPI({
      hassStates: hassActiveState,
    });
    const manager = new TriggersManager(api);
    expect(manager.isTriggered()).toBeFalsy();

    manager.updateTriggerHAState(null);
    expect(manager.isTriggered()).toBeTruthy();
  });

  it('should take no actions with human interactions', () => {
    const start = new Date('2023-10-01T17:14');
    const api = createTriggerAPI({
      hassStates: hassActiveState,
      // Interaction present.
      interaction: true,
    });
    const manager = new TriggersManager(api);
    manager.updateTriggerHAState(createHASS(hassInactiveState));
    expect(manager.isTriggered()).toBeTruthy();

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();

    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
      createHASS(hassInactiveState),
    );
    manager.updateTriggerHAState(createHASS(hassActiveState));

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    expect(manager.isTriggered()).toBeFalsy();

    expect(api.getViewManager().setViewDefault).not.toBeCalled();
  });

  it('should take no actions when actions are set to none', () => {
    const start = new Date('2023-10-01T17:14');
    const api = createTriggerAPI({
      hassStates: hassActiveState,
      config: {
        enabled: true,
        actions: {
          interaction_mode: 'all',
          trigger: 'none',
          untrigger: 'none',
        },
      },
    });
    const manager = new TriggersManager(api);
    manager.updateTriggerHAState(createHASS(hassInactiveState));
    expect(manager.isTriggered()).toBeTruthy();

    expect(api.getViewManager().setViewByParameters).not.toBeCalled();

    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
      createHASS(hassInactiveState),
    );
    manager.updateTriggerHAState(createHASS(hassActiveState));

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    expect(manager.isTriggered()).toBeFalsy();

    expect(api.getViewManager().setViewDefault).not.toBeCalled();
  });

  it('should take actions with human interactions when interaction mode is active', () => {
    const start = new Date('2023-10-01T17:14');
    const api = createTriggerAPI({
      hassStates: hassActiveState,
      // Interaction present.
      interaction: true,
      config: {
        ...baseScanConfig,
        actions: {
          trigger: 'live' as const,
          untrigger: 'default' as const,
          interaction_mode: 'active',
        },
      },
    });
    const manager = new TriggersManager(api);
    manager.updateTriggerHAState(createHASS(hassInactiveState));
    expect(manager.isTriggered()).toBeTruthy();

    expect(api.getViewManager().setViewByParameters).toBeCalledWith({
      viewName: 'live' as const,
      cameraID: 'camera_1' as const,
    });

    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
      createHASS(hassInactiveState),
    );
    manager.updateTriggerHAState(createHASS(hassActiveState));

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    expect(manager.isTriggered()).toBeFalsy();

    expect(api.getViewManager().setViewDefault).toBeCalled();
  });

  it('should report multiple triggered cameras', () => {
    const start = new Date('2023-10-01T17:14');
    const bothOnState = {
      'binary_sensor.one': createStateEntity({ state: 'on' }),
      'binary_sensor.two': createStateEntity({ state: 'on' }),
    };
    const api = createTriggerAPI({
      hassStates: bothOnState,
    });
    vi.mocked(api.getCameraManager().getStore).mockReturnValue(
      createStore([
        {
          cameraID: 'camera_1',
          config: createCameraConfig({
            triggers: {
              entities: ['binary_sensor.one'],
            },
          }),
        },
        {
          cameraID: 'camera_2',
          config: createCameraConfig({
            triggers: {
              entities: ['binary_sensor.two'],
            },
          }),
        },
      ]),
    );

    const manager = new TriggersManager(api);

    expect(manager.isTriggered()).toBeFalsy();
    expect(manager.getMostRecentlyTriggeredCameraID()).toBeNull();
    expect(manager.getTriggeredCameraIDs()).toEqual(new Set());

    manager.updateTriggerHAState(null);
    expect(manager.isTriggered()).toBeTruthy();
    expect(manager.getTriggeredCameraIDs()).toEqual(new Set(['camera_1', 'camera_2']));

    // Either is the most recently triggered.
    expect(['camera_1', 'camera_2']).toContain(
      manager.getMostRecentlyTriggeredCameraID(),
    );

    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
      createHASS({
        'binary_sensor.one': createStateEntity({ state: 'off' }),
        'binary_sensor.two': createStateEntity({ state: 'on' }),
      }),
    );

    manager.updateTriggerHAState(createHASS(bothOnState));

    vi.setSystemTime(add(start, { seconds: 10 }));
    vi.runOnlyPendingTimers();

    expect(manager.getTriggeredCameraIDs()).toEqual(new Set(['camera_2']));
    expect(manager.getMostRecentlyTriggeredCameraID()).toBe('camera_2');
  });

  it('should filter triggers by camera', () => {
    const start = new Date('2023-10-01T17:14');
    const api = createTriggerAPI({
      config: {
        ...baseScanConfig,
        // Filter triggers to selected camera only.
        filter_selected_camera: true,
      },
      hassStates: hassActiveState,
    });
    const manager = new TriggersManager(api);
    manager.updateTriggerHAState(createHASS(hassInactiveState));
    expect(manager.isTriggered()).toBeFalsy();

    const otherCameraSelected = createView({
      camera: 'camera_SOME_OTHER_CAMERA' as const,
    });

    vi.mocked(api.getViewManager().getView).mockReturnValue(otherCameraSelected);
    manager.updateView(null);
    expect(manager.isTriggered()).toBeFalsy();

    const thisCameraSelected = createView({
      camera: 'camera_1' as const,
    });

    vi.mocked(api.getViewManager().getView).mockReturnValue(thisCameraSelected);
    manager.updateView(otherCameraSelected);
    expect(manager.isTriggered()).toBeTruthy();

    // Ensure a view change to the same camera stays triggered.
    vi.mocked(api.getViewManager().getView).mockReturnValue(thisCameraSelected);
    manager.updateView(thisCameraSelected);
    expect(manager.isTriggered()).toBeTruthy();
  });

  it('should not untrigger triggers by camera', () => {
    const start = new Date('2023-10-01T17:14');
    const api = createTriggerAPI({
      config: {
        ...baseScanConfig,
        // Filter triggers to selected camera only.
        filter_selected_camera: true,
      },
      hassStates: hassActiveState,
    });
    const manager = new TriggersManager(api);
    manager.updateTriggerHAState(createHASS(hassInactiveState));
    expect(manager.isTriggered()).toBeFalsy();

    const otherCameraSelected = createView({
      camera: 'camera_SOME_OTHER_CAMERA' as const,
    });

    vi.mocked(api.getViewManager().getView).mockReturnValue(otherCameraSelected);
    manager.updateView(null);
    expect(manager.isTriggered()).toBeFalsy();

    const thisCameraSelected = createView({
      camera: 'camera_1' as const,
    });

    vi.mocked(api.getViewManager().getView).mockReturnValue(thisCameraSelected);
    manager.updateView(otherCameraSelected);
    expect(manager.isTriggered()).toBeTruthy();

    // Ensure a view change to the same camera stays triggered.
    vi.mocked(api.getViewManager().getView).mockReturnValue(thisCameraSelected);
    manager.updateView(thisCameraSelected);
    expect(manager.isTriggered()).toBeTruthy();
  });
});
