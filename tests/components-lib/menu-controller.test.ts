import { handleActionConfig } from '@dermotduffy/custom-card-helpers';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FRIGATE_ICON_SVG_PATH } from '../../src/camera-manager/frigate/icon';
import { MenuController } from '../../src/components-lib/menu-controller';
import { MenuConfig, menuConfigSchema } from '../../src/config/types';
import { StateParameters } from '../../src/types';
import { refreshDynamicStateParameters } from '../../src/utils/ha';
import { createInteractionEvent, createHASS, createLitElement } from '../test-utils';

vi.mock('@dermotduffy/custom-card-helpers');
vi.mock('../../src/utils/ha');

const createMenuConfig = (config: unknown): MenuConfig => {
  return menuConfigSchema.parse(config);
};

// @vitest-environment jsdom
describe('MenuController', () => {
  const action = {
    action: 'fire-dom-event' as const,
  };
  const menuToggleAction = {
    action: 'fire-dom-event' as const,
    frigate_card_action: 'menu_toggle' as const,
  };
  const tapActionConfig = {
    camera_entity: 'foo',
    tap_action: action,
  };
  const tapActionConfigMulti = {
    camera_entity: 'foo',
    tap_action: [action, action, action],
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should set and get menu config', () => {
    const host = createLitElement();
    const controller = new MenuController(host);

    const config = createMenuConfig({
      button_size: 21,
      style: 'hover',
      position: 'left',
      alignment: 'top',
    });
    controller.setMenuConfig(config);
    expect(controller.getMenuConfig()).toBe(config);

    expect(host.style.getPropertyValue('--frigate-card-menu-button-size')).toBe('21px');
    expect(host.getAttribute('data-style')).toBe('hover');
    expect(host.getAttribute('data-position')).toBe('left');
    expect(host.getAttribute('data-alignment')).toBe('top');
  });

  it('should expand', () => {
    const host = createLitElement();
    const controller = new MenuController(host);

    expect(controller.isExpanded()).toBeFalsy();
    expect(host.getAttribute('expanded')).toBeNull();

    controller.setExpanded(true);
    expect(controller.isExpanded()).toBeTruthy();
    expect(host.getAttribute('expanded')).toBe('');

    controller.setExpanded(false);
    expect(controller.isExpanded()).toBeFalsy();
    expect(host.getAttribute('expanded')).toBeNull();
  });

  describe('should set and sort buttons', () => {
    it('by priority', () => {
      const controller = new MenuController(createLitElement());
      controller.setButtons([
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:cow',
          priority: 20,
          alignment: 'matching',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:goat',
          alignment: 'matching',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:chicken',
          priority: 40,
          alignment: 'matching',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:horse',
          priority: 40,
          alignment: 'matching',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:sheep',
          priority: 30,
          alignment: 'matching',
        },
      ]);

      expect(controller.getButtons('matching')).toEqual([
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:chicken',
          priority: 40,
          alignment: 'matching',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:horse',
          priority: 40,
          alignment: 'matching',
        },
        {
          alignment: 'matching',
          icon: 'mdi:sheep',
          priority: 30,
          type: 'custom:frigate-card-menu-icon',
        },
        {
          alignment: 'matching',
          icon: 'mdi:cow',
          priority: 20,
          type: 'custom:frigate-card-menu-icon',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:goat',
          alignment: 'matching',
        },
      ]);
    });

    it('with frigate button first', () => {
      const controller = new MenuController(createLitElement());
      controller.setMenuConfig(
        createMenuConfig({
          style: 'hidden',
        }),
      );
      controller.setExpanded(true);
      controller.setButtons([
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:cow',
          priority: 100,
          alignment: 'matching',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'frigate',
          alignment: 'matching',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:sheep',
          priority: 100,
          alignment: 'matching',
        },
      ]);

      expect(controller.getButtons('matching')).toEqual([
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'frigate',
          alignment: 'matching',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:cow',
          priority: 100,
          alignment: 'matching',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:sheep',
          priority: 100,
          alignment: 'matching',
        },
      ]);
    });
  });

  describe('should get buttons', () => {
    it('with matching alignment', () => {
      const controller = new MenuController(createLitElement());
      controller.setButtons([
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:cow',
          alignment: 'opposing',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:sheep',
          alignment: 'matching',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:cow',
        },
      ]);

      expect(controller.getButtons('matching')).toEqual([
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:sheep',
          alignment: 'matching',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:cow',
        },
      ]);
    });

    it('with disabled buttons', () => {
      const controller = new MenuController(createLitElement());
      controller.setButtons([
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:cow',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:sheep',
          enabled: false,
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:goat',
          enabled: true,
        },
      ]);

      expect(controller.getButtons('matching')).toEqual([
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:cow',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:goat',
          enabled: true,
        },
      ]);
    });

    it('with hidden non-expanded menu', () => {
      const controller = new MenuController(createLitElement());
      controller.setMenuConfig(
        createMenuConfig({
          style: 'hidden',
        }),
      );

      controller.setButtons([
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'frigate',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:sheep',
        },
      ]);

      expect(controller.getButtons('matching')).toEqual([
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'frigate',
        },
      ]);

      controller.toggleExpanded();

      expect(controller.getButtons('matching')).toEqual([
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'frigate',
        },
        {
          type: 'custom:frigate-card-menu-icon',
          icon: 'mdi:sheep',
        },
      ]);
    });
  });

  describe('should get fresh button state', () => {
    it('on state icon', () => {
      const controller = new MenuController(createLitElement());
      const stateButton = {
        type: 'custom:frigate-card-menu-state-icon' as const,
        icon: 'mdi:sheep',
        entity: 'switch.foo',
        state_color: true,
      };

      const stateParameters: StateParameters = {};
      vi.mocked(refreshDynamicStateParameters).mockReturnValue(stateParameters);

      expect(controller.getFreshButtonState(createHASS(), stateButton)).toBe(
        stateParameters,
      );

      expect(vi.mocked(refreshDynamicStateParameters)).toBeCalled();
    });

    it('on non state icon', () => {
      const controller = new MenuController(createLitElement());
      const button = {
        type: 'custom:frigate-card-menu-icon' as const,
        icon: 'mdi:sheep',
      };

      expect(controller.getFreshButtonState(createHASS(), button)).toEqual(button);
      expect(vi.mocked(refreshDynamicStateParameters)).not.toBeCalled();
    });
  });

  describe('should get svg path', () => {
    it('frigate icon', () => {
      const controller = new MenuController(createLitElement());
      const button = {
        type: 'custom:frigate-card-menu-icon' as const,
        icon: 'frigate',
      };
      expect(controller.getSVGPath(button)).toEqual(FRIGATE_ICON_SVG_PATH);
    });

    it('non-frigate icon', () => {
      const controller = new MenuController(createLitElement());
      const button = {
        type: 'custom:frigate-card-menu-icon' as const,
        icon: 'mdi:cow',
      };
      expect(controller.getSVGPath(button)).toBeFalsy();
    });
  });

  describe('should handle actions', () => {
    it('should bail without config', () => {
      const controller = new MenuController(createLitElement());
      controller.actionHandler(createInteractionEvent('tap'));
      expect(vi.mocked(handleActionConfig)).not.toBeCalled();
    });

    it('should execute simple action in non-hidden menu', () => {
      const host = createLitElement();
      const handler = vi.fn();
      host.addEventListener('frigate-card:action:execution-request', handler);

      const controller = new MenuController(host);

      controller.actionHandler(createInteractionEvent('tap'), tapActionConfig);
      expect(handler).toBeCalledWith(
        expect.objectContaining({
          detail: { action: [action], config: tapActionConfig },
        }),
      );
      expect(controller.isExpanded()).toBeFalsy();
    });

    it('should execute simple action in with config in event', () => {
      const host = createLitElement();
      const handler = vi.fn();
      host.addEventListener('frigate-card:action:execution-request', handler);

      const controller = new MenuController(host);

      controller.actionHandler(createInteractionEvent('tap', tapActionConfig));
      expect(handler).toBeCalledWith(
        expect.objectContaining({
          detail: { action: [action], config: tapActionConfig },
        }),
      );
    });

    it('should execute simple array of actions in non-hidden menu', () => {
      const host = createLitElement();
      const handler = vi.fn();
      host.addEventListener('frigate-card:action:execution-request', handler);

      const controller = new MenuController(host);

      controller.actionHandler(createInteractionEvent('tap'), tapActionConfigMulti);

      expect(handler).toBeCalledWith(
        expect.objectContaining({
          detail: { action: [action, action, action], config: tapActionConfigMulti },
        }),
      );
    });

    describe('should close menu', () => {
      it('tap', () => {
        const host = createLitElement();
        const controller = new MenuController(host);
        controller.setMenuConfig(
          createMenuConfig({
            style: 'hidden',
          }),
        );

        controller.setExpanded(true);
        expect(controller.isExpanded()).toBeTruthy();

        controller.actionHandler(createInteractionEvent('tap'), tapActionConfig);
        expect(controller.isExpanded()).toBeFalsy();
      });

      it('end_tap', () => {
        const host = createLitElement();
        const controller = new MenuController(host);
        controller.setMenuConfig(
          createMenuConfig({
            style: 'hidden',
          }),
        );

        controller.setExpanded(true);
        expect(controller.isExpanded()).toBeTruthy();

        controller.actionHandler(createInteractionEvent('end_tap'), {
          end_tap_action: action,
        });
        expect(controller.isExpanded()).toBeFalsy();
      });
    });

    describe('should not close menu', () => {
      it('start_tap with later action', () => {
        const host = createLitElement();
        const controller = new MenuController(host);
        controller.setMenuConfig(
          createMenuConfig({
            style: 'hidden',
          }),
        );

        controller.setExpanded(true);
        expect(controller.isExpanded()).toBeTruthy();

        controller.actionHandler(createInteractionEvent('start_tap'), {
          start_tap_action: action,
          end_tap_action: action,
        });
        expect(controller.isExpanded()).toBeTruthy();
      });

      it('with a menu toggle action', () => {
        const host = createLitElement();
        const controller = new MenuController(host);
        controller.setMenuConfig(
          createMenuConfig({
            style: 'hidden',
          }),
        );

        controller.setExpanded(false);
        expect(controller.isExpanded()).toBeFalsy();

        controller.actionHandler(createInteractionEvent('tap'), {
          camera_entity: 'foo',
          tap_action: menuToggleAction,
        });
        expect(controller.isExpanded()).toBeTruthy();
      });

      it('when no action is actually taken', () => {
        const host = createLitElement();
        const controller = new MenuController(host);
        controller.setMenuConfig(
          createMenuConfig({
            style: 'hidden',
          }),
        );

        controller.setExpanded(true);
        expect(controller.isExpanded()).toBeTruthy();

        controller.actionHandler(createInteractionEvent('end_tap'), tapActionConfig);
        expect(controller.isExpanded()).toBeTruthy();
      });
    });
  });
});
