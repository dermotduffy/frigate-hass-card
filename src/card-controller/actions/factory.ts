import { ActionConfig } from '@dermotduffy/custom-card-helpers';
import { ActionContext } from 'action';
import { ActionType } from '../../config/types';
import { convertActionToCardCustomAction } from '../../utils/action';
import { CameraSelectAction } from './actions/camera-select';
import { CameraUIAction } from './actions/camera-ui';
import { DefaultAction } from './actions/default';
import { DisplayModeSelectAction } from './actions/display-mode-select';
import { DownloadAction } from './actions/download';
import { ExpandAction } from './actions/expand';
import { FullscreenAction } from './actions/fullscreen';
import { GenericAction } from './actions/generic';
import { LogAction } from './actions/log';
import { MediaPlayerAction } from './actions/media-player';
import { MenuToggleAction } from './actions/menu-toggle';
import { MicrophoneConnectAction } from './actions/microphone-connect';
import { MicrophoneDisconnectAction } from './actions/microphone-disconnect';
import { MicrophoneMuteAction } from './actions/microphone-mute';
import { MicrophoneUnmuteAction } from './actions/microphone-unmute';
import { MuteAction } from './actions/mute';
import { PauseAction } from './actions/pause';
import { PlayAction } from './actions/play';
import { PTZAction } from './actions/ptz';
import { PTZControlsAction } from './actions/ptz-controls';
import { PTZDigitalAction } from './actions/ptz-digital';
import { PTZMultiAction } from './actions/ptz-multi';
import { ScreenshotAction } from './actions/screenshot';
import { SleepAction } from './actions/sleep';
import { StatusBarAction } from './actions/status-bar';
import { SubstreamOffAction } from './actions/substream-off';
import { SubstreamOnAction } from './actions/substream-on';
import { SubstreamSelectAction } from './actions/substream-select';
import { UnmuteAction } from './actions/unmute';
import { ViewAction } from './actions/view';
import { Action, AuxillaryActionConfig } from './types';

export class ActionFactory {
  public createAction(
    context: ActionContext,
    action: ActionType,
    options?: {
      config?: AuxillaryActionConfig;
      cardID?: string;
    },
  ): Action | null {
    const frigateCardAction = convertActionToCardCustomAction(action);
    if (action.action !== 'fire-dom-event' || !frigateCardAction) {
      // * There is a slight typing (but not functional) difference between
      //   ActionType in this card and ActionConfig in `custom-card-helpers`. See
      //   `ExtendedConfirmationRestrictionConfig` in `types.ts` for the source and
      //   reason behind this difference.
      return new GenericAction(context, action as ActionConfig, options?.config);
    }

    if (
      // Command not intended for this card (e.g. query string command).
      frigateCardAction.card_id &&
      frigateCardAction.card_id !== options?.cardID
    ) {
      return null;
    }

    switch (frigateCardAction.frigate_card_action) {
      case 'default':
        return new DefaultAction(context, frigateCardAction, options?.config);
      case 'clip':
      case 'clips':
      case 'image':
      case 'live':
      case 'recording':
      case 'recordings':
      case 'snapshot':
      case 'snapshots':
      case 'timeline':
      case 'diagnostics':
        return new ViewAction(context, frigateCardAction, options?.config);
      case 'sleep':
        return new SleepAction(context, frigateCardAction, options?.config);
      case 'download':
        return new DownloadAction(context, frigateCardAction, options?.config);
      case 'camera_ui':
        return new CameraUIAction(context, frigateCardAction, options?.config);
      case 'expand':
        return new ExpandAction(context, frigateCardAction, options?.config);
      case 'fullscreen':
        return new FullscreenAction(context, frigateCardAction, options?.config);
      case 'menu_toggle':
        // This is a rare code path: this would only be used if someone has a
        // menu toggle action configured outside of the menu itself.
        return new MenuToggleAction(context, frigateCardAction, options?.config);
      case 'camera_select':
        return new CameraSelectAction(context, frigateCardAction, options?.config);
      case 'live_substream_select':
        return new SubstreamSelectAction(context, frigateCardAction, options?.config);
      case 'live_substream_off':
        return new SubstreamOffAction(context, frigateCardAction, options?.config);
      case 'live_substream_on':
        return new SubstreamOnAction(context, frigateCardAction, options?.config);
      case 'media_player':
        return new MediaPlayerAction(context, frigateCardAction, options?.config);
      case 'microphone_connect':
        return new MicrophoneConnectAction(context, frigateCardAction, options?.config);
      case 'microphone_disconnect':
        return new MicrophoneDisconnectAction(
          context,
          frigateCardAction,
          options?.config,
        );
      case 'microphone_mute':
        return new MicrophoneMuteAction(context, frigateCardAction, options?.config);
      case 'microphone_unmute':
        return new MicrophoneUnmuteAction(context, frigateCardAction, options?.config);
      case 'mute':
        return new MuteAction(context, frigateCardAction, options?.config);
      case 'unmute':
        return new UnmuteAction(context, frigateCardAction, options?.config);
      case 'play':
        return new PlayAction(context, frigateCardAction, options?.config);
      case 'pause':
        return new PauseAction(context, frigateCardAction, options?.config);
      case 'screenshot':
        return new ScreenshotAction(context, frigateCardAction, options?.config);
      case 'display_mode_select':
        return new DisplayModeSelectAction(context, frigateCardAction, options?.config);
      case 'ptz':
        return new PTZAction(context, frigateCardAction, options?.config);
      case 'ptz_digital':
        return new PTZDigitalAction(context, frigateCardAction, options?.config);
      case 'ptz_multi':
        return new PTZMultiAction(context, frigateCardAction, options?.config);
      case 'ptz_controls':
        return new PTZControlsAction(context, frigateCardAction, options?.config);
      case 'log':
        return new LogAction(context, frigateCardAction, options?.config);
      case 'status_bar':
        return new StatusBarAction(context, frigateCardAction, options?.config);
    }

    /* istanbul ignore next: this path cannot be reached -- @preserve */
    console.warn(
      `Frigate card received unknown card action: ${frigateCardAction['frigate_card_action']}`,
    );
    /* istanbul ignore next: this path cannot be reached -- @preserve */
    return null;
  }
}
