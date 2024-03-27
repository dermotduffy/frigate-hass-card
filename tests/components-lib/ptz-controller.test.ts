import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PTZController } from '../../src/components-lib/ptz-controller';
import {
  FrigateCardPTZConfig,
  frigateCardPTZSchema,
  PTZControlAction,
} from '../../src/config/types';
import {
  frigateCardHandleActionConfig,
  getActionConfigGivenAction,
} from '../../src/utils/action.js';
import {
  createCapabilities,
  createCameraManager,
  createHASS,
} from '../test-utils';

vi.mock('../../src/utils/action.js');

const createConfig = (config?: Partial<FrigateCardPTZConfig>): FrigateCardPTZConfig => {
  return frigateCardPTZSchema.parse({
    ...config,
  });
};

// @vitest-environment jsdom
describe('PTZController', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('should be creatable', () => {
    const controller = new PTZController(document.createElement('div'));
    expect(controller).toBeTruthy();
  });

  it('should get config creatable', () => {
    const controller = new PTZController(document.createElement('div'));
    const config = createConfig();
    controller.setConfig(config);
    expect(controller.getConfig()).toBe(config);
  });

  describe('should set element attributes', () => {
    describe('orientation', () => {
      describe('with config', () => {
        it.each([['horizontal' as const], ['vertical' as const]])(
          '%s',
          (orientation: 'horizontal' | 'vertical') => {
            const element = document.createElement('div');
            const controller = new PTZController(element);
            controller.setConfig(createConfig({ orientation: orientation }));
            expect(element.getAttribute('data-orientation')).toBe(orientation);
          },
        );
      });
      it('without config', () => {
        const element = document.createElement('div');
        const controller = new PTZController(element);
        controller.setConfig();
        expect(element.getAttribute('data-orientation')).toBe('horizontal');
      });
    });
    describe('position', () => {
      describe('with config', () => {
        it.each([
          ['top-left' as const],
          ['top-right' as const],
          ['bottom-left' as const],
          ['bottom-right' as const],
        ])(
          '%s',
          (position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right') => {
            const element = document.createElement('div');
            const controller = new PTZController(element);
            controller.setConfig(createConfig({ position: position }));
            expect(element.getAttribute('data-position')).toBe(position);
          },
        );
      });
      it('without config', () => {
        const element = document.createElement('div');
        const controller = new PTZController(element);
        controller.setConfig();
        expect(element.getAttribute('data-position')).toBe('bottom-right');
      });
    });
    it('with style in config', () => {
      const element = document.createElement('div');
      const controller = new PTZController(element);
      controller.setConfig(createConfig({ style: { transform: 'none', left: '50%' } }));
      expect(element.getAttribute('style')).toBe('transform:none;left:50%');
    });
  });

  describe('should respect mode', () => {
    it('off', () => {
      const controller = new PTZController(document.createElement('div'));
      expect(controller.shouldDisplay()).toBeFalsy();
    });
    it('off but forced on', () => {
      const controller = new PTZController(document.createElement('div'));
      controller.setForceVisibility(true);
      // No actions, no rendering, no matter what.
      expect(controller.shouldDisplay()).toBeFalsy();
    });
    it('on without actions', () => {
      const controller = new PTZController(document.createElement('div'));
      controller.setConfig(createConfig({ mode: 'on' }));
      expect(controller.shouldDisplay()).toBeFalsy();
    });
    it('on with actions', () => {
      const controller = new PTZController(document.createElement('div'));
      controller.setConfig(createConfig({ mode: 'on', actions_left: {} }));
      controller.setCamera(createCameraManager(), 'camera.office');
      expect(controller.shouldDisplay()).toBeTruthy();
    });
    it('on with actions but forced off', () => {
      const controller = new PTZController(document.createElement('div'));
      controller.setConfig(createConfig({ mode: 'on', actions_left: {} }));
      controller.setCamera(createCameraManager(), 'camera.office');
      controller.setForceVisibility(false);
      expect(controller.shouldDisplay()).toBeFalsy();
    });
  });

  describe('should get PTZ actions', () => {
    it('without config', () => {
      const controller = new PTZController(document.createElement('div'));
      expect(controller.getPTZActions('left')).toBeNull();
    });

    describe('using defaults', () => {
      describe('with continous PTZ', () => {
        it.each([
          ['left' as const],
          ['right' as const],
          ['up' as const],
          ['down' as const],
          ['zoom_in' as const],
          ['zoom_out' as const],
        ])('%s', (actionName: PTZControlAction) => {
          const controller = new PTZController(document.createElement('div'));
          controller.setConfig(createConfig());

          const cameraManager = createCameraManager();
          vi.mocked(cameraManager).getCameraCapabilities.mockReturnValue(
            createCapabilities({
              ptz: {
                panTilt: ['continuous'],
                zoom: ['continuous'],
              },
            }),
          );
          controller.setCamera(cameraManager, 'camera.office');

          expect(controller.getPTZActions(actionName)).toEqual({
            start_tap_action: {
              action: 'fire-dom-event',
              frigate_card_action: 'ptz',
              ptz_action: actionName,
              ptz_phase: 'start',
            },
            end_tap_action: {
              action: 'fire-dom-event',
              frigate_card_action: 'ptz',
              ptz_action: actionName,
              ptz_phase: 'stop',
            },
          });
        });
      });

      describe('with relative PTZ', () => {
        it.each([
          ['left' as const],
          ['right' as const],
          ['up' as const],
          ['down' as const],
          ['zoom_in' as const],
          ['zoom_out' as const],
        ])('%s', (actionName: PTZControlAction) => {
          const controller = new PTZController(document.createElement('div'));
          controller.setConfig(createConfig());

          const cameraManager = createCameraManager();
          vi.mocked(cameraManager).getCameraCapabilities.mockReturnValue(
            createCapabilities({
              ptz: {
                panTilt: ['relative'],
                zoom: ['relative'],
              },
            }),
          );
          controller.setCamera(cameraManager, 'camera.office');

          expect(controller.getPTZActions(actionName)).toEqual({
            tap_action: {
              action: 'fire-dom-event',
              frigate_card_action: 'ptz',
              ptz_action: actionName,
            },
          });
        });
      });

      it('home', () => {
        const controller = new PTZController(document.createElement('div'));
        controller.setConfig(createConfig());

        const cameraManager = createCameraManager();
        vi.mocked(cameraManager).getCameraCapabilities.mockReturnValue(
          createCapabilities({
            ptz: {
              presets: ['preset-foo'],
            },
          }),
        );
        controller.setCamera(cameraManager, 'camera.office');

        expect(controller.getPTZActions('home')).toEqual({
          tap_action: {
            action: 'fire-dom-event',
            frigate_card_action: 'ptz',
            ptz_action: 'preset',
            ptz_preset: 'preset-foo',
          },
        });
      });
    });

    describe('using config', () => {
      it.each([
        ['left' as const],
        ['right' as const],
        ['up' as const],
        ['down' as const],
        ['zoom_in' as const],
        ['zoom_out' as const],
      ])('configured %s', (actionName: PTZControlAction) => {
        const controller = new PTZController(document.createElement('div'));
        controller.setConfig(
          createConfig({
            [`actions_${actionName}`]: {
              argument: actionName,
            },
          }),
        );
        controller.setCamera(createCameraManager(), 'camera.office');

        expect(controller.getPTZActions(actionName)).toEqual({
          argument: actionName,
        });
      });

      it('configured home', () => {
        const controller = new PTZController(document.createElement('div'));
        controller.setConfig(
          createConfig({
            actions_home: {
              argument: 'home',
            },
          }),
        );
        controller.setCamera(createCameraManager(), 'camera.office');

        expect(controller.getPTZActions('home')).toEqual({
          argument: 'home',
        });
      });
    });
  });

  describe('should handle action', () => {
    it('without hass or action', () => {
      const controller = new PTZController(document.createElement('div'));
      controller.setHASS();
      controller.setCamera();
      controller.handleAction(
        new CustomEvent<{ action: string }>('@action', { detail: { action: 'tap' } }),
      );
      expect(frigateCardHandleActionConfig).not.toBeCalled();
    });

    it('with action', () => {
      const element = document.createElement('div');
      const controller = new PTZController(element);
      const hass = createHASS();
      controller.setHASS(hass);
      controller.setConfig(
        createConfig({
          [`actions_left`]: {},
        }),
      );
      const tapAction = {
        action: 'none' as const,
      };
      const actionsConfig = {
        tap_action: tapAction,
      };
      vi.mocked(getActionConfigGivenAction).mockReturnValue(tapAction);

      controller.handleAction(
        new CustomEvent<{ action: string }>('@action', { detail: { action: 'tap' } }),
        actionsConfig,
      );
      expect(frigateCardHandleActionConfig).toBeCalledWith(
        element,
        hass,
        actionsConfig,
        'tap',
        actionsConfig.tap_action,
      );
    });
  });
});
