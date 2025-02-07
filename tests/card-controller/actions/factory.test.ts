import { describe, expect, it } from 'vitest';
import { CameraSelectAction } from '../../../src/card-controller/actions/actions/camera-select';
import { CameraUIAction } from '../../../src/card-controller/actions/actions/camera-ui';
import { DefaultAction } from '../../../src/card-controller/actions/actions/default';
import { DisplayModeSelectAction } from '../../../src/card-controller/actions/actions/display-mode-select';
import { DownloadAction } from '../../../src/card-controller/actions/actions/download';
import { ExpandAction } from '../../../src/card-controller/actions/actions/expand';
import { FullscreenAction } from '../../../src/card-controller/actions/actions/fullscreen';
import { GenericAction } from '../../../src/card-controller/actions/actions/generic';
import { LogAction } from '../../../src/card-controller/actions/actions/log';
import { MediaPlayerAction } from '../../../src/card-controller/actions/actions/media-player';
import { MenuToggleAction } from '../../../src/card-controller/actions/actions/menu-toggle';
import { MicrophoneConnectAction } from '../../../src/card-controller/actions/actions/microphone-connect';
import { MicrophoneDisconnectAction } from '../../../src/card-controller/actions/actions/microphone-disconnect';
import { MicrophoneMuteAction } from '../../../src/card-controller/actions/actions/microphone-mute';
import { MicrophoneUnmuteAction } from '../../../src/card-controller/actions/actions/microphone-unmute';
import { MuteAction } from '../../../src/card-controller/actions/actions/mute';
import { PauseAction } from '../../../src/card-controller/actions/actions/pause';
import { PlayAction } from '../../../src/card-controller/actions/actions/play';
import { PTZAction } from '../../../src/card-controller/actions/actions/ptz';
import { PTZControlsAction } from '../../../src/card-controller/actions/actions/ptz-controls';
import { PTZDigitalAction } from '../../../src/card-controller/actions/actions/ptz-digital';
import { PTZMultiAction } from '../../../src/card-controller/actions/actions/ptz-multi';
import { ScreenshotAction } from '../../../src/card-controller/actions/actions/screenshot';
import { SleepAction } from '../../../src/card-controller/actions/actions/sleep';
import { StatusBarAction } from '../../../src/card-controller/actions/actions/status-bar';
import { SubstreamOffAction } from '../../../src/card-controller/actions/actions/substream-off';
import { SubstreamOnAction } from '../../../src/card-controller/actions/actions/substream-on';
import { SubstreamSelectAction } from '../../../src/card-controller/actions/actions/substream-select';
import { UnmuteAction } from '../../../src/card-controller/actions/actions/unmute';
import { ViewAction } from '../../../src/card-controller/actions/actions/view';
import { ActionFactory } from '../../../src/card-controller/actions/factory';
import { AdvancedCameraCardCustomAction } from '../../../src/config/types';

// @vitest-environment jsdom
describe('ActionFactory', () => {
  it('mismatched card-id', () => {
    const factory = new ActionFactory();
    expect(
      factory.createAction(
        {},
        {
          action: 'fire-dom-event',
          advanced_camera_card_action: 'clip',
          card_id: 'card_id',
        },
        {
          cardID: 'different_card_id',
        },
      ),
    ).toBeNull();
  });

  describe('generic', () => {
    it('non advanced camera card action', () => {
      const factory = new ActionFactory();
      expect(factory.createAction({}, { action: 'fire-dom-event' })).toBeInstanceOf(
        GenericAction,
      );
    });

    it('non fire-dom-event', () => {
      const factory = new ActionFactory();
      expect(factory.createAction({}, { action: 'more-info' })).toBeInstanceOf(
        GenericAction,
      );
    });
  });

  describe('actions', () => {
    it.each([
      [{ advanced_camera_card_action: 'camera_select' as const }, CameraSelectAction],
      [{ advanced_camera_card_action: 'camera_ui' as const }, CameraUIAction],
      [{ advanced_camera_card_action: 'clip' as const }, ViewAction],
      [{ advanced_camera_card_action: 'clips' as const }, ViewAction],
      [{ advanced_camera_card_action: 'default' as const }, DefaultAction],
      [{ advanced_camera_card_action: 'diagnostics' as const }, ViewAction],
      [
        {
          advanced_camera_card_action: 'display_mode_select' as const,
          display_mode: 'single' as const,
        },
        DisplayModeSelectAction,
      ],
      [{ advanced_camera_card_action: 'download' as const }, DownloadAction],
      [{ advanced_camera_card_action: 'expand' as const }, ExpandAction],
      [{ advanced_camera_card_action: 'fullscreen' as const }, FullscreenAction],
      [{ advanced_camera_card_action: 'image' as const }, ViewAction],
      [
        { advanced_camera_card_action: 'live_substream_off' as const },
        SubstreamOffAction,
      ],
      [{ advanced_camera_card_action: 'live_substream_on' as const }, SubstreamOnAction],
      [
        {
          advanced_camera_card_action: 'live_substream_select' as const,
          camera: 'camera.office',
        },
        SubstreamSelectAction,
      ],
      [{ advanced_camera_card_action: 'live' as const }, ViewAction],
      [
        {
          advanced_camera_card_action: 'log' as const,
          message: 'Hello, world!' as const,
        },
        LogAction,
      ],
      [
        {
          advanced_camera_card_action: 'media_player' as const,
          media_player: 'media_player.foo' as const,
          media_player_action: 'play' as const,
        },
        MediaPlayerAction,
      ],
      [{ advanced_camera_card_action: 'menu_toggle' as const }, MenuToggleAction],
      [
        { advanced_camera_card_action: 'microphone_connect' as const },
        MicrophoneConnectAction,
      ],
      [
        { advanced_camera_card_action: 'microphone_disconnect' as const },
        MicrophoneDisconnectAction,
      ],
      [
        { advanced_camera_card_action: 'microphone_mute' as const },
        MicrophoneMuteAction,
      ],
      [
        { advanced_camera_card_action: 'microphone_unmute' as const },
        MicrophoneUnmuteAction,
      ],
      [{ advanced_camera_card_action: 'mute' as const }, MuteAction],
      [{ advanced_camera_card_action: 'pause' as const }, PauseAction],
      [{ advanced_camera_card_action: 'play' as const }, PlayAction],
      [{ advanced_camera_card_action: 'ptz_digital' as const }, PTZDigitalAction],
      [
        {
          advanced_camera_card_action: 'ptz_multi' as const,
          ptz_action: 'right' as const,
        },
        PTZMultiAction,
      ],
      [
        { advanced_camera_card_action: 'ptz' as const, ptz_action: 'right' as const },
        PTZAction,
      ],
      [{ advanced_camera_card_action: 'recording' as const }, ViewAction],
      [{ advanced_camera_card_action: 'recordings' as const }, ViewAction],
      [{ advanced_camera_card_action: 'screenshot' as const }, ScreenshotAction],
      [
        { advanced_camera_card_action: 'ptz_controls' as const, enabled: true },
        PTZControlsAction,
      ],
      [{ advanced_camera_card_action: 'sleep' as const }, SleepAction],
      [{ advanced_camera_card_action: 'snapshot' as const }, ViewAction],
      [{ advanced_camera_card_action: 'snapshots' as const }, ViewAction],
      [{ advanced_camera_card_action: 'timeline' as const }, ViewAction],
      [{ advanced_camera_card_action: 'unmute' as const }, UnmuteAction],
      [
        {
          advanced_camera_card_action: 'status_bar' as const,
          status_bar_action: 'reset',
        },
        StatusBarAction,
      ],
    ])(
      'advanced_camera_card_action: $advanced_camera_card_action',
      (action: Partial<AdvancedCameraCardCustomAction>, classObject: object) => {
        const factory = new ActionFactory();
        expect(
          factory.createAction({}, { action: 'fire-dom-event', ...action }),
        ).toBeInstanceOf(classObject);
      },
    );
  });
});
