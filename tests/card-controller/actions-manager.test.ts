/* eslint-disable @typescript-eslint/no-non-null-assertion */
import { afterAll, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import {
  ActionType,
  FrigateCardCustomAction,
  FrigateCardView,
  frigateCardCustomActionSchema,
} from '../../src/config/types';
import { FrigateCardMediaPlayer } from '../../src/types';
import {
  convertActionToFrigateCardCustomAction,
  frigateCardHandleAction,
  frigateCardHandleActionConfig,
  getActionConfigGivenAction,
} from '../../src/utils/action.js';
import { ActionsManager, Interaction } from '../../src/card-controller/actions-manager';
import {
  createCardAPI,
  createConfig,
  createHASS,
  createMediaLoadedInfo,
  createView,
  createViewWithMedia,
} from '../test-utils';

vi.mock('../../src/utils/action.js');

const createAction = (
  action: Record<string, unknown>,
): FrigateCardCustomAction | null => {
  const result = frigateCardCustomActionSchema.safeParse({
    action: 'custom:frigate-card-action',
    ...action,
  });
  return result.success ? result.data : null;
};

describe('ActionsManager.getMergedActions', () => {
  const config = {
    view: {
      actions: {
        tap_action: {
          action: 'navigate',
          navigation_path: '1',
        },
      },
    },
    live: {
      actions: {
        tap_action: {
          action: 'navigate',
          navigation_path: '2',
        },
      },
    },
    media_gallery: {
      actions: {
        tap_action: {
          action: 'navigate',
          navigation_path: '3',
        },
      },
    },
    media_viewer: {
      actions: {
        tap_action: {
          action: 'navigate',
          navigation_path: '4',
        },
      },
    },
    image: {
      actions: {
        tap_action: {
          action: 'navigate',
          navigation_path: '5',
        },
      },
    },
  };

  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should get no merged actions with a message', () => {
    const api = createCardAPI();
    vi.mocked(api.getViewManager().getView).mockReturnValue(
      createView({ view: 'live' }),
    );
    vi.mocked(api.getMessageManager().hasMessage).mockReturnValue(true);

    const manager = new ActionsManager(api);

    expect(manager.getMergedActions()).toEqual({});
  });

  describe('should get merged actions with live view', () => {
    it.each([
      [
        'live' as const,
        {
          tap_action: {
            action: 'navigate',
            navigation_path: '2',
          },
        },
      ],
      [
        'clips' as const,
        {
          tap_action: {
            action: 'navigate',
            navigation_path: '3',
          },
        },
      ],
      [
        'clip' as const,
        {
          tap_action: {
            action: 'navigate',
            navigation_path: '4',
          },
        },
      ],
      [
        'image' as const,
        {
          tap_action: {
            action: 'navigate',
            navigation_path: '5',
          },
        },
      ],
      ['timeline' as const, {}],
    ])('%s', (viewName: FrigateCardView, result: Record<string, unknown>) => {
      const api = createCardAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({ view: viewName }),
      );
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(createConfig(config));

      const manager = new ActionsManager(api);

      expect(manager.getMergedActions()).toEqual(result);
    });
  });
});

// @vitest-environment jsdom
describe('ActionsManager.handleInteraction', () => {
  it('should handle interaction', () => {
    const api = createCardAPI();
    const element = document.createElement('div');
    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    const manager = new ActionsManager(api);

    const hass = createHASS();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

    const actionForThisInteraction: ActionType = {
      action: 'none',
    };
    vi.mocked(getActionConfigGivenAction).mockReturnValue(actionForThisInteraction);

    manager.handleInteractionEvent(
      new CustomEvent<Interaction>('event', { detail: { action: 'tap' } }),
    );

    expect(frigateCardHandleActionConfig).toBeCalledWith(
      element,
      hass,
      manager.getMergedActions(),
      'tap',
      actionForThisInteraction,
    );
  });

  it('should not handle interaction without hass', () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);

    // No values of hass.
    manager.handleInteractionEvent(
      new CustomEvent<Interaction>('event', { detail: { action: 'tap' } }),
    );
    expect(frigateCardHandleActionConfig).not.toBeCalledWith();
  });

  it('should not handle malformed interaction', () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    manager.handleInteractionEvent(
      new CustomEvent<Interaction>('event', {

        // Malformed interaction type.
        detail: { action: 'double_finger_snap' } as unknown as Interaction,
      }),
    );
    expect(frigateCardHandleActionConfig).not.toBeCalledWith();
  });
});

describe('ActionsManager.handleActionEvent', () => {
  it('should handle event', () => {
    const action = createAction({ frigate_card_action: 'default' })!;
    const event: CustomEvent<FrigateCardCustomAction> = new CustomEvent('ll-custom', {
      detail: action,
    });

    // The file containing convertActionToFrigateCardCustomAction (action.ts) is
    // mocked, so need to provide a value here.
    vi.mocked(convertActionToFrigateCardCustomAction).mockReturnValue(action);

    const api = createCardAPI();
    const manager = new ActionsManager(api);

    manager.handleActionEvent(event);
    expect(api.getViewManager().setViewDefault).toBeCalled();
  });

  it('should not handle event without detail', () => {
    const action = createAction({ frigate_card_action: 'default' })!;
    const event = new Event('ll-custom');

    // Mock this out just so that if the sentinel in handleActionEvent failed,
    // it would still trigger a test failure below.
    vi.mocked(convertActionToFrigateCardCustomAction).mockReturnValue(action);

    const api = createCardAPI();
    const manager = new ActionsManager(api);
    manager.handleActionEvent(event);

    expect(api.getViewManager().setViewDefault).not.toBeCalled();
  });

  it('should not handle malformed action', () => {
    const action = createAction({ frigate_card_action: 'default' })!;
    const event: CustomEvent<FrigateCardCustomAction> = new CustomEvent('ll-custom', {
      detail: action,
    });

    vi.mocked(convertActionToFrigateCardCustomAction).mockReturnValue(null);

    const api = createCardAPI();
    const manager = new ActionsManager(api);
    manager.handleActionEvent(event);

    expect(api.getViewManager().setViewDefault).not.toBeCalled();
  });
});

describe('ActionsManager.executeAction', () => {
  it('should not handle actions with different card_id', async () => {
    const api = createCardAPI();
    vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
      createConfig({
        card_id: 'foo',
      }),
    );

    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        card_id: 'NOT_foo',
        frigate_card_action: 'default',
      })!,
    );

    expect(api.getViewManager().setViewDefault).not.toBeCalled();
  });

  it('should handle default action', async () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        frigate_card_action: 'default',
      })!,
    );

    expect(api.getViewManager().setViewDefault).toBeCalled();
  });

  describe('should handle view action', async () => {
    it.each([
      ['clip' as const],
      ['clips' as const],
      ['image' as const],
      ['live' as const],
      ['recording' as const],
      ['recordings' as const],
      ['snapshot' as const],
      ['snapshots' as const],
      ['timeline' as const],
    ])('%s', async (viewName: FrigateCardView) => {
      const api = createCardAPI();
      const manager = new ActionsManager(api);

      await manager.executeFrigateAction(
        createAction({
          frigate_card_action: viewName,
        })!,
      );

      expect(api.getViewManager().setViewByParameters).toBeCalledWith(
        expect.objectContaining({
          viewName: viewName,
        }),
      );
    });
  });

  it('should handle download action', async () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        frigate_card_action: 'download',
      })!,
    );

    expect(api.getDownloadManager().downloadViewerMedia).toBeCalled();
  });

  it('should handle camera ui action', async () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        frigate_card_action: 'camera_ui',
      })!,
    );

    expect(api.getCameraURLManager().openURL).toBeCalled();
  });

  it('should handle expand action', async () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        frigate_card_action: 'expand',
      })!,
    );

    expect(api.getExpandManager().toggleExpanded).toBeCalled();
  });

  it('should handle fullscreen action', async () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        frigate_card_action: 'fullscreen',
      })!,
    );

    expect(api.getFullscreenManager().toggleFullscreen).toBeCalled();
  });

  it('should handle menu toggle action', async () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        frigate_card_action: 'menu_toggle',
      })!,
    );

    expect(api.getCardElementManager().toggleMenu).toBeCalled();
  });

  describe('should handle camera_select action', () => {
    it('with valid camera and view', async () => {
      const api = createCardAPI();
      const manager = new ActionsManager(api);

      vi.mocked(api.getViewManager().getView).mockReturnValue(createView());
      vi.mocked(api.getViewManager().isViewSupportedByCamera).mockReturnValue(true);

      await manager.executeFrigateAction(
        createAction({
          frigate_card_action: 'camera_select',
          camera: 'camera',
        })!,
      );

      expect(api.getViewManager().setViewByParameters).toBeCalledWith(
        expect.objectContaining({
          viewName: 'live',
          cameraID: 'camera',
          failSafe: true,
        }),
      );
    });

    it('without config', async () => {
      const api = createCardAPI();
      const manager = new ActionsManager(api);

      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(null);
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({
          view: 'timeline',
        }),
      );
      vi.mocked(api.getViewManager().isViewSupportedByCamera).mockReturnValue(true);

      await manager.executeFrigateAction(
        createAction({
          frigate_card_action: 'camera_select',
          camera: 'camera',
        })!,
      );

      expect(api.getViewManager().setViewByParameters).toBeCalledWith(
        expect.objectContaining({
          viewName: 'timeline',
          cameraID: 'camera',
          failSafe: true,
        }),
      );
    });

    it('with target view', async () => {
      const api = createCardAPI();
      vi.mocked(api.getConfigManager().getConfig).mockReturnValue(
        createConfig({
          view: {
            // Change to clips view when the camera changes.
            camera_select: 'clips',
          },
        }),
      );
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({
          view: 'live',
        }),
      );
      vi.mocked(api.getViewManager().isViewSupportedByCamera).mockReturnValue(true);
      const manager = new ActionsManager(api);

      await manager.executeFrigateAction(
        createAction({
          frigate_card_action: 'camera_select',
          camera: 'camera',
        })!,
      );

      expect(api.getViewManager().setViewByParameters).toBeCalledWith(
        expect.objectContaining({
          viewName: 'clips',
          cameraID: 'camera',
          failSafe: true,
        }),
      );
    });

    it('with triggered camera', async () => {
      const api = createCardAPI();
      const manager = new ActionsManager(api);

      vi.mocked(api.getViewManager().getView).mockReturnValue(createView());
      vi.mocked(api.getViewManager().isViewSupportedByCamera).mockReturnValue(true);
      vi.mocked(
        api.getTriggersManager().getMostRecentlyTriggeredCameraID,
      ).mockReturnValue('camera');

      await manager.executeFrigateAction(
        createAction({
          frigate_card_action: 'camera_select',
          triggered: true,
        })!,
      );

      expect(api.getViewManager().setViewByParameters).toBeCalledWith(
        expect.objectContaining({
          viewName: 'live',
          cameraID: 'camera',
          failSafe: true,
        }),
      );
    });

    it('without camera or triggered camera', async () => {
      const api = createCardAPI();
      const manager = new ActionsManager(api);

      vi.mocked(api.getViewManager().getView).mockReturnValue(createView());
      vi.mocked(api.getViewManager().isViewSupportedByCamera).mockReturnValue(true);
      vi.mocked(
        api.getTriggersManager().getMostRecentlyTriggeredCameraID,
      ).mockReturnValue('camera');

      await manager.executeFrigateAction(
        createAction({
          frigate_card_action: 'camera_select',
        })!,
      );

      expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    });

    it('without a current view', async () => {
      const api = createCardAPI();
      const manager = new ActionsManager(api);

      await manager.executeFrigateAction(
        createAction({
          frigate_card_action: 'camera_select',
          camera: 'camera',
        })!,
      );

      expect(api.getViewManager().setViewByParameters).not.toBeCalled();
    });
  });

  it('should handle live_substream_select action', async () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        frigate_card_action: 'live_substream_select',
        camera: 'substream',
      })!,
    );

    expect(api.getViewManager().setViewWithSubstream).toBeCalledWith('substream');
  });

  it('should handle live_substream_off action', async () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        frigate_card_action: 'live_substream_off',
      })!,
    );

    expect(api.getViewManager().setViewWithoutSubstream).toBeCalled();
  });

  it('should handle live_substream_on action', async () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        frigate_card_action: 'live_substream_on',
      })!,
    );

    expect(api.getViewManager().setViewWithSubstream).toBeCalledWith();
  });

  describe('should handle media_player action', () => {
    it('to stop', async () => {
      const api = createCardAPI();
      const manager = new ActionsManager(api);

      await manager.executeFrigateAction(
        createAction({
          frigate_card_action: 'media_player',
          media_player_action: 'stop',
          media_player: 'this_is_a_media_player',
        })!,
      );

      expect(api.getMediaPlayerManager().stop).toBeCalledWith('this_is_a_media_player');
    });

    it('to play live', async () => {
      const api = createCardAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({
          camera: 'camera',
          view: 'live',
        }),
      );
      const manager = new ActionsManager(api);

      await manager.executeFrigateAction(
        createAction({
          frigate_card_action: 'media_player',
          media_player_action: 'play',
          media_player: 'this_is_a_media_player',
        })!,
      );

      expect(api.getMediaPlayerManager().playLive).toBeCalledWith(
        'this_is_a_media_player',
        'camera',
      );
    });

    it('to play media', async () => {
      const api = createCardAPI();
      const view = createViewWithMedia({
        camera: 'camera',
        view: 'media',
      });

      vi.mocked(api.getViewManager().getView).mockReturnValue(view);
      const manager = new ActionsManager(api);

      await manager.executeFrigateAction(
        createAction({
          frigate_card_action: 'media_player',
          media_player_action: 'play',
          media_player: 'this_is_a_media_player',
        })!,
      );

      expect(api.getMediaPlayerManager().playMedia).toBeCalledWith(
        'this_is_a_media_player',
        view.queryResults?.getSelectedResult(),
      );
    });

    it('to play media without selected media', async () => {
      const api = createCardAPI();
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({
          view: 'media',
        }),
      );
      const manager = new ActionsManager(api);

      await manager.executeFrigateAction(
        createAction({
          frigate_card_action: 'media_player',
          media_player_action: 'play',
          media_player: 'this_is_a_media_player',
        })!,
      );

      expect(api.getMediaPlayerManager().playMedia).not.toBeCalled();
    });
  });

  it('should handle diagnostics action', async () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        frigate_card_action: 'diagnostics',
      })!,
    );

    expect(api.getViewManager().setViewByParameters).toBeCalledWith(
      expect.objectContaining({
        viewName: 'diagnostics',
      }),
    );
  });

  it('should handle microphone_mute action', async () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        frigate_card_action: 'microphone_mute',
      })!,
    );

    expect(api.getMicrophoneManager().mute).toBeCalled();
  });

  it('should handle microphone_unmute action', async () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        frigate_card_action: 'microphone_unmute',
      })!,
    );

    expect(api.getMicrophoneManager().unmute).toBeCalled();
  });

  describe('should handle media player action', () => {
    it.each([
      ['mute' as const],
      ['unmute' as const],
      ['play' as const],
      ['pause' as const],
    ])('%s', async (action: 'mute' | 'unmute' | 'play' | 'pause') => {
      const api = createCardAPI();
      const player = mock<FrigateCardMediaPlayer>();
      vi.mocked(api.getMediaLoadedInfoManager().get).mockReturnValue(
        createMediaLoadedInfo({
          player: player,
        }),
      );
      const manager = new ActionsManager(api);

      await manager.executeFrigateAction(
        createAction({
          frigate_card_action: action,
        })!,
      );

      expect(player[action]).toBeCalled();
    });
  });

  it('should handle screenshot action', async () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        frigate_card_action: 'screenshot',
      })!,
    );

    expect(api.getDownloadManager().downloadScreenshot).toBeCalled();
  });

  it('should handle display_mode_select action', async () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        frigate_card_action: 'display_mode_select',
        display_mode: 'grid',
      })!,
    );

    expect(api.getViewManager().setViewWithNewDisplayMode).toBeCalledWith('grid');
  });

  describe('should handle ptz action', () => {
    it('with selected camera', async () => {
      const api = createCardAPI();
      const manager = new ActionsManager(api);
      vi.mocked(api.getViewManager().getView).mockReturnValue(
        createView({ camera: 'camera.office' }),
      );

      await manager.executeFrigateAction(
        createAction({
          frigate_card_action: 'ptz',
          ptz_action: 'left',
        })!,
      );

      expect(api.getCameraManager().executePTZAction).toBeCalledWith(
        'camera.office',
        'left',
        {
          phase: undefined,
          preset: undefined,
        },
      );
    });

    it('without selected camera', async () => {
      const api = createCardAPI();
      const manager = new ActionsManager(api);

      await manager.executeFrigateAction(
        createAction({
          frigate_card_action: 'ptz',
          ptz_action: 'left',
        })!,
      );

      expect(api.getCameraManager().executePTZAction).not.toBeCalled();
    });
  });

  it('should handle show_ptz action', async () => {
    const api = createCardAPI();
    const manager = new ActionsManager(api);

    await manager.executeFrigateAction(
      createAction({
        frigate_card_action: 'show_ptz',
        show_ptz: true,
      })!,
    );

    expect(api.getViewManager().setViewWithNewContext).toBeCalledWith(
      expect.objectContaining({ live: { ptzVisible: true } }),
    );
  });

  it('should handle unknown action', async () => {
    const manager = new ActionsManager(createCardAPI());

    const spy = vi.spyOn(global.console, 'warn').mockImplementation(() => true);

    await manager.executeFrigateAction(
      // Have to manually create the action (vs using `createAction()`) since
      // it's malformed.
      {
        frigate_card_action: 'not_a_real_action',
      } as unknown as FrigateCardCustomAction,
    );

    expect(spy).toBeCalledWith(
      'Frigate card received unknown card action: not_a_real_action',
    );
  });
});

describe('ActionsManager.executeActions', () => {
  it('should execute actions', async () => {
    const api = createCardAPI();
    const hass = createHASS();
    const element = document.createElement('div');

    vi.mocked(api.getCardElementManager().getElement).mockReturnValue(element);
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);

    const manager = new ActionsManager(api);
    const action = createAction({
      frigate_card_action: 'default',
    })!;
    manager.executeActions(action);

    expect(frigateCardHandleAction).toBeCalledWith(element, hass, {}, action);
  });

  it('should not execute actions without hass', async () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);

    const manager = new ActionsManager(api);
    manager.executeActions(
      createAction({
        frigate_card_action: 'default',
      })!,
    );

    expect(api.getViewManager().setViewDefault).not.toBeCalled();
  });
});
