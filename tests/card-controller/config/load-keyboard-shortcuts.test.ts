import { describe, expect, it, vi } from 'vitest';
import { createCardAPI, createConfig } from '../../test-utils';
import { setKeyboardShortcutsFromConfig } from '../../../src/card-controller/config/load-keyboard-shortcuts';
import { PTZKeyboardShortcutName } from '../../../src/config/keyboard-shortcuts';
import { PTZAction } from '../../../src/config/ptz';

describe('setKeyboardShortcutsFromConfig', () => {
  it('without shortcuts', () => {
    const api = createCardAPI();
    setKeyboardShortcutsFromConfig(api, 'tag');

    expect(api.getAutomationsManager().deleteAutomations).toBeCalledWith('tag');
    expect(api.getAutomationsManager().addAutomations).not.toBeCalled();
  });

  it('with shortcuts disabled', () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        view: {
          keyboard_shortcuts: {
            enabled: false,
          },
        },
      }),
    );
    setKeyboardShortcutsFromConfig(api, 'tag');

    expect(api.getAutomationsManager().deleteAutomations).toBeCalledWith('tag');
    expect(api.getAutomationsManager().addAutomations).not.toBeCalled();
  });

  describe('PTZ shortcuts', () => {
    describe('actions', () => {
      it.each([
        ['ptz_left' as const, 'left' as const],
        ['ptz_right' as const, 'right' as const],
        ['ptz_up' as const, 'up' as const],
        ['ptz_down' as const, 'down' as const],
        ['ptz_zoom_in' as const, 'zoom_in' as const],
        ['ptz_zoom_out' as const, 'zoom_out' as const],
      ])('%s', (name: PTZKeyboardShortcutName, ptzAction: PTZAction) => {
        const api = createCardAPI();
        vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
          createConfig({
            view: {
              keyboard_shortcuts: {
                enabled: true,
                ptz_home: null,
                ptz_left: null,
                ptz_right: null,
                ptz_up: null,
                ptz_down: null,
                ptz_zoom_in: null,
                ptz_zoom_out: null,
                [name]: { key: 'z' },
              },
            },
          }),
        );

        setKeyboardShortcutsFromConfig(api, 'tag');

        expect(api.getAutomationsManager().deleteAutomations).toBeCalledWith('tag');
        expect(api.getAutomationsManager().addAutomations).toBeCalledWith([
          {
            actions: [
              {
                action: 'fire-dom-event',
                frigate_card_action: 'ptz_multi',
                ptz_action: ptzAction,
                ptz_phase: 'start',
              },
            ],
            conditions: [
              {
                alt: undefined,
                condition: 'key',
                ctrl: undefined,
                key: 'z',
                meta: undefined,
                shift: undefined,
                state: 'down',
              },
            ],
            tag: 'tag',
          },
          {
            actions: [
              {
                action: 'fire-dom-event',
                frigate_card_action: 'ptz_multi',
                ptz_action: ptzAction,
                ptz_phase: 'stop',
              },
            ],
            conditions: [
              {
                condition: 'key',
                key: 'z',
                state: 'up',
              },
            ],
            tag: 'tag',
          },
        ]);
      });

      it('ptz_home', () => {
        const api = createCardAPI();
        vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig());

        setKeyboardShortcutsFromConfig(api, 'tag');

        expect(api.getAutomationsManager().deleteAutomations).toBeCalledWith('tag');
        expect(api.getAutomationsManager().addAutomations).toBeCalledWith(
          expect.arrayContaining([
            {
              actions: [
                {
                  action: 'fire-dom-event',
                  frigate_card_action: 'ptz_multi',
                },
              ],
              conditions: [
                {
                  alt: undefined,
                  condition: 'key',
                  ctrl: undefined,
                  key: 'h',
                  meta: undefined,
                  shift: undefined,
                  state: 'down',
                },
              ],
              tag: 'tag',
            },
          ]),
        );
      });
    });
  });
});
