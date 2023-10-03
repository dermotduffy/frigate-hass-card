import {
  Actions,
  ActionsConfig,
  FrigateCardCustomAction,
  FRIGATE_CARD_VIEW_DEFAULT,
} from '../../config/types.js';
import {
  convertActionToFrigateCardCustomAction,
  frigateCardHandleActionConfig,
  getActionConfigGivenAction,
} from '../action.js';
import { getStreamCameraID } from '../substream.js';
import { CardActionsManagerAPI } from './types.js';

export class ActionsManager {
  protected _api: CardActionsManagerAPI;

  constructor(api: CardActionsManagerAPI) {
    this._api = api;
  }

  /**
   * Merge card-wide and view-specific actions.
   * @returns A combined set of action.
   */
  public getMergedActions(): ActionsConfig {
    const view = this._api.getViewManager().getView();
    if (this._api.getMessageManager().hasMessage()) {
      return {};
    }

    const config = this._api.getConfigManager().getConfig();
    let specificActions: Actions | undefined = undefined;
    if (view?.is('live')) {
      specificActions = config?.live.actions;
    } else if (view?.isGalleryView()) {
      specificActions = config?.media_gallery?.actions;
    } else if (view?.isViewerView()) {
      specificActions = config?.media_viewer.actions;
    } else if (view?.is('image')) {
      specificActions = config?.image?.actions;
    } else {
      return {};
    }
    return { ...config?.view.actions, ...specificActions };
  }

  /**
   * Handle an human interaction called on an element (e.g. 'tap').
   */
  public handleInteraction(interaction: string): void {
    const hass = this._api.getHASSManager().getHASS();
    const config = this.getMergedActions();
    const actionConfig = getActionConfigGivenAction(interaction, config);
    if (
      hass &&
      config &&
      interaction &&
      // Don't call frigateCardHandleActionConfig() unless there is explicitly an
      // action defined (as it uses a default that is unhelpful for views that
      // have default tap/click actions).
      actionConfig
    ) {
      frigateCardHandleActionConfig(
        this._api.getCardElementManager().getElement(),
        hass,
        config,
        interaction,
        actionConfig,
      );
    }
  }

  public handleActionEvent = (ev: Event): void => {
    if (!('detail' in ev)) {
      // The event may not actually be a CustomEvent object, but may still have a
      // detail field. See:
      // https://github.com/custom-cards/custom-card-helpers/blob/master/src/fire-event.ts#L70
      return;
    }

    const frigateCardAction = convertActionToFrigateCardCustomAction(ev.detail);
    if (frigateCardAction) {
      this.executeAction(frigateCardAction);
    }
  };

  /**
   * Execute a card action.
   * @param frigateCardAction
   * @returns `true` if an action is executed.
   */
  public async executeAction(frigateCardAction: FrigateCardCustomAction): Promise<void> {
    const config = this._api.getConfigManager().getConfig();
    const mediaLoadedInfoManager = this._api.getMediaLoadedInfoManager();

    if (
      // Command not intended for this card (e.g. query string command).
      frigateCardAction.card_id &&
      config?.card_id !== frigateCardAction.card_id
    ) {
      return;
    }

    // Note: This function needs to process (view-related) commands even when
    // _view has not yet been initialized (since it may be used to set a view
    // via the querystring).
    const view = this._api.getViewManager().getView();

    const action = frigateCardAction.frigate_card_action;

    switch (action) {
      case 'default':
        this._api.getViewManager().setViewDefault();
        break;
      case 'clip':
      case 'clips':
      case 'image':
      case 'live':
      case 'recording':
      case 'recordings':
      case 'snapshot':
      case 'snapshots':
      case 'timeline':
        this._api.getViewManager().setViewByParameters({
          viewName: action,
          cameraID: view?.camera,
        });
        break;
      case 'download':
        await this._api.getDownloadManager().downloadViewerMedia();
        break;
      case 'camera_ui':
        this._api.getCameraURLManager().openURL();
        break;
      case 'expand':
        this._api.getExpandManager().toggleExpanded();
        break;
      case 'fullscreen':
        this._api.getFullscreenManager().toggleFullscreen();
        break;
      case 'menu_toggle':
        // This is a rare code path: this would only be used if someone has a
        // menu toggle action configured outside of the menu itself (e.g.
        // picture elements).
        this._api.getCardElementManager().toggleMenu();
        break;
      case 'camera_select':
        const selectCameraID = frigateCardAction.camera;
        if (view) {
          const viewOnCameraSelect = config?.view.camera_select ?? 'current';
          const targetViewName =
            viewOnCameraSelect === 'current' ? view.view : viewOnCameraSelect;
          const verifiedViewName = this._api
            .getViewManager()
            .isViewSupportedByCamera(selectCameraID, targetViewName)
            ? targetViewName
            : FRIGATE_CARD_VIEW_DEFAULT;
          this._api.getViewManager().setViewByParameters({
            viewName: verifiedViewName,
            cameraID: selectCameraID,
          });
        }
        break;
      case 'live_substream_select': {
        this._api.getViewManager().setViewWithSubstream(frigateCardAction.camera);
        break;
      }
      case 'live_substream_off': {
        this._api.getViewManager().setViewWithoutSubstream();
        break;
      }
      case 'live_substream_on': {
        this._api.getViewManager().setViewWithSubstream();
        break;
      }
      case 'media_player':
        const mediaPlayer = frigateCardAction.media_player;
        const mediaPlayerController = this._api.getMediaPlayerManager();
        const media = view?.queryResults?.getSelectedResult() ?? null;

        if (frigateCardAction.media_player_action === 'stop') {
          await mediaPlayerController.stop(mediaPlayer);
        } else if (view?.is('live')) {
          await mediaPlayerController.playLive(mediaPlayer, getStreamCameraID(view));
        } else if (view?.isViewerView() && media) {
          await mediaPlayerController.playMedia(mediaPlayer, media);
        }
        break;
      case 'diagnostics':
        this._api.getViewManager().setViewByParameters({ viewName: 'diagnostics' });
        break;
      case 'microphone_mute':
        this._api.getMicrophoneManager().mute();
        break;
      case 'microphone_unmute':
        await this._api.getMicrophoneManager().unmute();
        break;
      case 'mute':
        await mediaLoadedInfoManager.get()?.player?.mute();
        break;
      case 'unmute':
        await mediaLoadedInfoManager.get()?.player?.unmute();
        break;
      case 'play':
        await mediaLoadedInfoManager.get()?.player?.play();
        break;
      case 'pause':
        await mediaLoadedInfoManager.get()?.player?.pause();
        break;
      case 'screenshot':
        await this._api.getDownloadManager().downloadScreenshot();
        break;
      case 'display_mode_select':
        this._api
          .getViewManager()
          .setViewWithNewDisplayMode(frigateCardAction.display_mode);
        break;
      default:
        console.warn(`Frigate card received unknown card action: ${action}`);
    }
  }
}
