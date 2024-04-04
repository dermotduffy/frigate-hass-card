import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { StyleInfo } from 'lit/directives/style-map';
import { CameraManager } from '../camera-manager/manager';
import { MediaPlayerManager } from '../card-controller/media-player-manager';
import { MicrophoneManager } from '../card-controller/microphone-manager';
import { ViewManager } from '../card-controller/view-manager';
import {
  FrigateCardConfig,
  FrigateCardCustomAction,
  FRIGATE_CARD_VIEWS_USER_SPECIFIED,
  MenuItem,
} from '../config/types';
import { FRIGATE_BUTTON_MENU_ICON } from '../const';
import { localize } from '../localize/localize.js';
import { MediaLoadedInfo } from '../types';
import {
  createFrigateCardCameraAction,
  createFrigateCardDisplayModeAction,
  createFrigateCardMediaPlayerAction,
  createFrigateCardShowPTZAction,
  createFrigateCardSimpleAction,
} from '../utils/action';
import { isTruthy } from '../utils/basic';
import { getEntityIcon, getEntityTitle } from '../utils/ha';
import { hasUsablePTZ } from '../utils/ptz';
import { hasSubstream } from '../utils/substream';
import { View } from '../view/view';
import { getCameraIDsForViewName } from '../view/view-to-cameras';

export interface MenuButtonControllerOptions {
  currentMediaLoadedInfo?: MediaLoadedInfo | null;
  showCameraUIButton?: boolean;
  inFullscreenMode?: boolean;
  inExpandedMode?: boolean;
  microphoneManager?: MicrophoneManager | null;
  mediaPlayerController?: MediaPlayerManager | null;
  viewManager?: ViewManager | null;
}

export class MenuButtonController {
  // Array of dynamic menu buttons to be added to menu.
  protected _dynamicMenuButtons: MenuItem[] = [];

  public addDynamicMenuButton(button: MenuItem): void {
    if (!this._dynamicMenuButtons.includes(button)) {
      this._dynamicMenuButtons.push(button);
    }
  }

  public removeDynamicMenuButton(button: MenuItem): void {
    this._dynamicMenuButtons = this._dynamicMenuButtons.filter(
      (existingButton) => existingButton != button,
    );
  }

  /**
   * Get the menu buttons to display.
   * @returns An array of menu buttons.
   */
  public calculateButtons(
    hass: HomeAssistant,
    config: FrigateCardConfig,
    cameraManager: CameraManager,
    view: View,
    options?: MenuButtonControllerOptions,
  ): MenuItem[] {
    return [
      this._getFrigateButton(config),
      this._getCamerasButton(config, cameraManager, view),
      this._getSubstreamsButton(config, cameraManager, view),
      this._getLiveButton(config, view, options?.viewManager),
      this._getClipsButton(config, view, options?.viewManager),
      this._getSnapshotsButton(config, view, options?.viewManager),
      this._getRecordingsButton(config, view, options?.viewManager),
      this._getImageButton(config, view, options?.viewManager),
      this._getTimelineButton(config, view, options?.viewManager),
      this._getDownloadButton(config, cameraManager, view),
      this._getCameraUIButton(config, options?.showCameraUIButton),
      this._getMicrophoneButton(
        config,
        options?.microphoneManager,
        options?.currentMediaLoadedInfo,
      ),
      this._getExpandButton(config, options?.inExpandedMode),
      this._getFullscreenButton(config, options?.inFullscreenMode),
      this._getCastButton(
        hass,
        config,
        cameraManager,
        view,
        options?.mediaPlayerController,
      ),
      this._getPlayPauseButton(config, options?.currentMediaLoadedInfo),
      this._getMuteUnmuteButton(config, options?.currentMediaLoadedInfo),
      this._getScreenshotButton(config, options?.currentMediaLoadedInfo),
      this._getDisplayModeButton(config, cameraManager, view),
      this._getPTZButton(config, cameraManager, view),

      ...this._dynamicMenuButtons.map((button) => ({
        style: this._getStyleFromActions(config, view, button, options),
        ...button,
      })),
    ].filter(isTruthy);
  }

  protected _getFrigateButton(config: FrigateCardConfig): MenuItem {
    return {
      // Use a magic icon value that the menu will use to render the custom
      // Frigate icon.
      icon: FRIGATE_BUTTON_MENU_ICON,
      ...config.menu.buttons.frigate,
      type: 'custom:frigate-card-menu-icon',
      title: localize('config.menu.buttons.frigate'),
      tap_action:
        config.menu?.style === 'hidden'
          ? (createFrigateCardSimpleAction('menu_toggle') as FrigateCardCustomAction)
          : (createFrigateCardSimpleAction('default') as FrigateCardCustomAction),
      hold_action: createFrigateCardSimpleAction(
        'diagnostics',
      ) as FrigateCardCustomAction,
    };
  }

  protected _getCamerasButton(
    config: FrigateCardConfig,
    cameraManager: CameraManager,
    view: View,
  ): MenuItem | null {
    // Show all cameras in the menu rather than just cameras that support the
    // current view for a less surprising UX.
    const menuCameraIDs = cameraManager.getStore().getCameraIDsWithCapability('menu');
    if (menuCameraIDs.size) {
      const menuItems = Array.from(
        cameraManager.getStore().getCameraConfigEntries(menuCameraIDs),
        ([cameraID, config]) => {
          const action = createFrigateCardCameraAction('camera_select', cameraID);
          const metadata = cameraManager.getCameraMetadata(cameraID);

          return {
            enabled: true,
            icon: metadata?.icon,
            entity: config.camera_entity,
            state_color: true,
            title: metadata?.title,
            selected: view.camera === cameraID,
            ...(action && { tap_action: action }),
          };
        },
      );

      return {
        icon: 'mdi:video-switch',
        ...config.menu.buttons.cameras,
        type: 'custom:frigate-card-menu-submenu',
        title: localize('config.menu.buttons.cameras'),
        items: menuItems,
      };
    }
    return null;
  }

  protected _getSubstreamsButton(
    config: FrigateCardConfig,
    cameraManager: CameraManager,
    view: View,
  ): MenuItem | null {
    const substreamCameraIDs = cameraManager
      .getStore()
      .getAllDependentCameras(view.camera, 'substream');

    if (substreamCameraIDs.size && view.is('live')) {
      const substreams = [...substreamCameraIDs].filter(
        (cameraID) => cameraID !== view.camera,
      );
      const streams = [view.camera, ...substreams];
      const substreamAwareCameraID = this._getSubstreamAwareCameraID(view);

      if (streams.length === 2) {
        // If there are only two dependencies (the main camera, and 1 other)
        // then use a button not a menu to toggle.
        return {
          icon: 'mdi:video-input-component',
          style:
            substreamAwareCameraID !== view.camera ? this._getEmphasizedStyle() : {},
          title: localize('config.menu.buttons.substreams'),
          ...config.menu.buttons.substreams,
          type: 'custom:frigate-card-menu-icon',
          tap_action: createFrigateCardSimpleAction(
            hasSubstream(view) ? 'live_substream_off' : 'live_substream_on',
          ) as FrigateCardCustomAction,
        };
      } else if (streams.length > 2) {
        const menuItems = Array.from(streams, (streamID) => {
          const action = createFrigateCardCameraAction(
            'live_substream_select',
            streamID,
          );
          const metadata = cameraManager.getCameraMetadata(streamID) ?? undefined;
          const cameraConfig = cameraManager.getStore().getCameraConfig(streamID);
          return {
            enabled: true,
            icon: metadata?.icon,
            entity: cameraConfig?.camera_entity,
            state_color: true,
            title: metadata?.title,
            selected: substreamAwareCameraID === streamID,
            ...(action && { tap_action: action }),
          };
        });

        return {
          icon: 'mdi:video-input-component',
          title: localize('config.menu.buttons.substreams'),
          style:
            substreamAwareCameraID !== view.camera ? this._getEmphasizedStyle() : {},
          ...config.menu.buttons.substreams,
          type: 'custom:frigate-card-menu-submenu',
          items: menuItems,
        };
      }
    }
    return null;
  }

  protected _getLiveButton(
    config: FrigateCardConfig,
    view: View,
    viewManager?: ViewManager | null,
  ): MenuItem | null {
    return viewManager?.isViewSupportedByCamera(view.camera, 'live')
      ? {
          icon: 'mdi:cctv',
          ...config.menu.buttons.live,
          type: 'custom:frigate-card-menu-icon',
          title: localize('config.view.views.live'),
          style: view.is('live') ? this._getEmphasizedStyle() : {},
          tap_action: createFrigateCardSimpleAction('live') as FrigateCardCustomAction,
        }
      : null;
  }

  protected _getClipsButton(
    config: FrigateCardConfig,
    view: View,
    viewManager?: ViewManager | null,
  ): MenuItem | null {
    return viewManager?.isViewSupportedByCamera(view.camera, 'clips')
      ? {
          icon: 'mdi:filmstrip',
          ...config.menu.buttons.clips,
          type: 'custom:frigate-card-menu-icon',
          title: localize('config.view.views.clips'),
          style: view?.is('clips') ? this._getEmphasizedStyle() : {},
          tap_action: createFrigateCardSimpleAction('clips') as FrigateCardCustomAction,
          hold_action: createFrigateCardSimpleAction('clip') as FrigateCardCustomAction,
        }
      : null;
  }

  protected _getSnapshotsButton(
    config: FrigateCardConfig,
    view: View,
    viewManager?: ViewManager | null,
  ): MenuItem | null {
    return viewManager?.isViewSupportedByCamera(view.camera, 'snapshots')
      ? {
          icon: 'mdi:camera',
          ...config.menu.buttons.snapshots,
          type: 'custom:frigate-card-menu-icon',
          title: localize('config.view.views.snapshots'),
          style: view?.is('snapshots') ? this._getEmphasizedStyle() : {},
          tap_action: createFrigateCardSimpleAction(
            'snapshots',
          ) as FrigateCardCustomAction,
          hold_action: createFrigateCardSimpleAction(
            'snapshot',
          ) as FrigateCardCustomAction,
        }
      : null;
  }

  protected _getRecordingsButton(
    config: FrigateCardConfig,
    view: View,
    viewManager?: ViewManager | null,
  ): MenuItem | null {
    return viewManager?.isViewSupportedByCamera(view.camera, 'recordings')
      ? {
          icon: 'mdi:album',
          ...config.menu.buttons.recordings,
          type: 'custom:frigate-card-menu-icon',
          title: localize('config.view.views.recordings'),
          style: view.is('recordings') ? this._getEmphasizedStyle() : {},
          tap_action: createFrigateCardSimpleAction(
            'recordings',
          ) as FrigateCardCustomAction,
          hold_action: createFrigateCardSimpleAction(
            'recording',
          ) as FrigateCardCustomAction,
        }
      : null;
  }

  protected _getImageButton(
    config: FrigateCardConfig,
    view: View,
    viewManager?: ViewManager | null,
  ): MenuItem | null {
    return viewManager?.isViewSupportedByCamera(view.camera, 'image')
      ? {
          icon: 'mdi:image',
          ...config.menu.buttons.image,
          type: 'custom:frigate-card-menu-icon',
          title: localize('config.view.views.image'),
          style: view?.is('image') ? this._getEmphasizedStyle() : {},
          tap_action: createFrigateCardSimpleAction('image') as FrigateCardCustomAction,
        }
      : null;
  }

  protected _getTimelineButton(
    config: FrigateCardConfig,
    view: View,
    viewManager?: ViewManager | null,
  ): MenuItem | null {
    return viewManager?.isViewSupportedByCamera(view.camera, 'timeline')
      ? {
          icon: 'mdi:chart-gantt',
          ...config.menu.buttons.timeline,
          type: 'custom:frigate-card-menu-icon',
          title: localize('config.view.views.timeline'),
          style: view.is('timeline') ? this._getEmphasizedStyle() : {},
          tap_action: createFrigateCardSimpleAction(
            'timeline',
          ) as FrigateCardCustomAction,
        }
      : null;
  }

  protected _getDownloadButton(
    config: FrigateCardConfig,
    cameraManager: CameraManager,
    view: View,
  ): MenuItem | null {
    const selectedMedia = view.queryResults?.getSelectedResult();
    const mediaCapabilities = selectedMedia
      ? cameraManager?.getMediaCapabilities(selectedMedia)
      : null;
    if (
      view.isViewerView() &&
      mediaCapabilities?.canDownload &&
      !this._isBeingCasted()
    ) {
      return {
        icon: 'mdi:download',
        ...config.menu.buttons.download,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.download'),
        tap_action: createFrigateCardSimpleAction('download') as FrigateCardCustomAction,
      };
    }
    return null;
  }

  protected _getCameraUIButton(
    config: FrigateCardConfig,
    showCameraUIButton?: boolean,
  ): MenuItem | null {
    return showCameraUIButton
      ? {
          icon: 'mdi:web',
          ...config.menu.buttons.camera_ui,
          type: 'custom:frigate-card-menu-icon',
          title: localize('config.menu.buttons.camera_ui'),
          tap_action: createFrigateCardSimpleAction(
            'camera_ui',
          ) as FrigateCardCustomAction,
        }
      : null;
  }

  protected _getMicrophoneButton(
    config: FrigateCardConfig,
    microphoneManager?: MicrophoneManager | null,
    currentMediaLoadedInfo?: MediaLoadedInfo | null,
  ): MenuItem | null {
    if (microphoneManager && currentMediaLoadedInfo?.capabilities?.supports2WayAudio) {
      const forbidden = microphoneManager.isForbidden();
      const muted = microphoneManager.isMuted();
      const buttonType = config.menu.buttons.microphone.type;
      return {
        icon: forbidden
          ? 'mdi:microphone-message-off'
          : muted
          ? 'mdi:microphone-off'
          : 'mdi:microphone',
        ...config.menu.buttons.microphone,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.microphone'),
        style: forbidden || muted ? {} : this._getEmphasizedStyle(true),
        ...(!forbidden &&
          buttonType === 'momentary' && {
            start_tap_action: createFrigateCardSimpleAction(
              'microphone_unmute',
            ) as FrigateCardCustomAction,
            end_tap_action: createFrigateCardSimpleAction(
              'microphone_mute',
            ) as FrigateCardCustomAction,
          }),
        ...(!forbidden &&
          buttonType === 'toggle' && {
            tap_action: createFrigateCardSimpleAction(
              muted ? 'microphone_unmute' : 'microphone_mute',
            ) as FrigateCardCustomAction,
          }),
      };
    }
    return null;
  }

  protected _getExpandButton(
    config: FrigateCardConfig,
    inExpandedMode?: boolean,
  ): MenuItem {
    return {
      icon: inExpandedMode ? 'mdi:arrow-collapse-all' : 'mdi:arrow-expand-all',
      ...config.menu.buttons.expand,
      type: 'custom:frigate-card-menu-icon',
      title: localize('config.menu.buttons.expand'),
      tap_action: createFrigateCardSimpleAction('expand') as FrigateCardCustomAction,
      style: inExpandedMode ? this._getEmphasizedStyle() : {},
    };
  }

  protected _getFullscreenButton(
    config: FrigateCardConfig,
    inFullscreenMode?: boolean,
  ): MenuItem | null {
    return !this._isBeingCasted()
      ? {
          icon: inFullscreenMode ? 'mdi:fullscreen-exit' : 'mdi:fullscreen',
          ...config.menu.buttons.fullscreen,
          type: 'custom:frigate-card-menu-icon',
          title: localize('config.menu.buttons.fullscreen'),
          tap_action: createFrigateCardSimpleAction(
            'fullscreen',
          ) as FrigateCardCustomAction,
          style: inFullscreenMode ? this._getEmphasizedStyle() : {},
        }
      : null;
  }

  protected _getCastButton(
    hass: HomeAssistant,
    config: FrigateCardConfig,
    cameraManager: CameraManager,
    view: View,
    mediaPlayerController?: MediaPlayerManager | null,
  ): MenuItem | null {
    const selectedCameraConfig = cameraManager.getStore().getCameraConfig(view.camera);
    if (
      mediaPlayerController?.hasMediaPlayers() &&
      (view.isViewerView() || (view.is('live') && selectedCameraConfig?.camera_entity))
    ) {
      const mediaPlayerItems = mediaPlayerController
        .getMediaPlayers()
        .map((playerEntityID) => {
          const title = getEntityTitle(hass, playerEntityID) || playerEntityID;
          const state = hass.states[playerEntityID];
          const playAction = createFrigateCardMediaPlayerAction(playerEntityID, 'play');
          const stopAction = createFrigateCardMediaPlayerAction(playerEntityID, 'stop');
          const disabled = !state || state.state === 'unavailable';

          return {
            enabled: true,
            selected: false,
            icon: getEntityIcon(hass, playerEntityID),
            entity: playerEntityID,
            state_color: false,
            title: title,
            disabled: disabled,
            ...(!disabled && playAction && { tap_action: playAction }),
            ...(!disabled && stopAction && { hold_action: stopAction }),
          };
        });

      return {
        icon: 'mdi:cast',
        ...config.menu.buttons.media_player,
        type: 'custom:frigate-card-menu-submenu',
        title: localize('config.menu.buttons.media_player'),
        items: mediaPlayerItems,
      };
    }
    return null;
  }

  protected _getPlayPauseButton(
    config: FrigateCardConfig,
    currentMediaLoadedInfo?: MediaLoadedInfo | null,
  ): MenuItem | null {
    if (
      currentMediaLoadedInfo &&
      currentMediaLoadedInfo.player &&
      currentMediaLoadedInfo.capabilities?.supportsPause
    ) {
      const paused = currentMediaLoadedInfo.player.isPaused();
      return {
        icon: paused ? 'mdi:play' : 'mdi:pause',
        ...config.menu.buttons.play,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.play'),
        tap_action: createFrigateCardSimpleAction(
          paused ? 'play' : 'pause',
        ) as FrigateCardCustomAction,
      };
    }
    return null;
  }

  protected _getMuteUnmuteButton(
    config: FrigateCardConfig,
    currentMediaLoadedInfo?: MediaLoadedInfo | null,
  ): MenuItem | null {
    if (
      currentMediaLoadedInfo &&
      currentMediaLoadedInfo.player &&
      currentMediaLoadedInfo?.capabilities?.hasAudio
    ) {
      const muted = currentMediaLoadedInfo.player.isMuted();
      return {
        icon: muted ? 'mdi:volume-off' : 'mdi:volume-high',
        ...config.menu.buttons.mute,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.mute'),
        tap_action: createFrigateCardSimpleAction(
          muted ? 'unmute' : 'mute',
        ) as FrigateCardCustomAction,
      };
    }
    return null;
  }

  protected _getScreenshotButton(
    config: FrigateCardConfig,
    currentMediaLoadedInfo?: MediaLoadedInfo | null,
  ): MenuItem | null {
    if (currentMediaLoadedInfo && currentMediaLoadedInfo.player) {
      return {
        icon: 'mdi:monitor-screenshot',
        ...config.menu.buttons.screenshot,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.screenshot'),
        tap_action: createFrigateCardSimpleAction(
          'screenshot',
        ) as FrigateCardCustomAction,
      };
    }
    return null;
  }

  protected _getDisplayModeButton(
    config: FrigateCardConfig,
    cameraManager: CameraManager,
    view: View,
  ): MenuItem | null {
    const viewCameraIDs = getCameraIDsForViewName(cameraManager, view.view);
    if (view.supportsMultipleDisplayModes() && viewCameraIDs.size > 1) {
      const isGrid = view.isGrid();
      return {
        icon: isGrid ? 'mdi:grid-off' : 'mdi:grid',
        ...config.menu.buttons.display_mode,
        style: isGrid ? this._getEmphasizedStyle() : {},
        type: 'custom:frigate-card-menu-icon',
        title: isGrid
          ? localize('display_modes.single')
          : localize('display_modes.grid'),
        tap_action: createFrigateCardDisplayModeAction(isGrid ? 'single' : 'grid'),
      };
    }
    return null;
  }

  protected _getSubstreamAwareCameraID(view: View): string {
    return view.context?.live?.overrides?.get(view.camera) ?? view.camera;
  }

  protected _getPTZButton(
    config: FrigateCardConfig,
    cameraManager: CameraManager,
    view: View,
  ): MenuItem | null {
    const substreamAwareCameraCapabilities = cameraManager.getCameraCapabilities(
      this._getSubstreamAwareCameraID(view),
    );

    if (
      view.is('live') &&
      hasUsablePTZ(substreamAwareCameraCapabilities, config.live.controls.ptz)
    ) {
      const isOn =
        view.context?.live?.ptzVisible === false
          ? false
          : config.live.controls.ptz.mode === 'on';
      return {
        icon: 'mdi:pan',
        ...config.menu.buttons.ptz,
        style: isOn ? this._getEmphasizedStyle() : {},
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.ptz'),
        tap_action: createFrigateCardShowPTZAction(!isOn),
      };
    }
    return null;
  }

  /**
   * Get the style of emphasized menu items.
   * @returns A StyleInfo.
   */
  protected _getEmphasizedStyle(critical?: boolean): StyleInfo {
    if (critical) {
      return {
        animation: 'pulse 3s infinite',
        color: 'var(--error-color, white)',
      };
    }
    return {
      color: 'var(--primary-color, white)',
    };
  }

  /**
   * Given a button determine if the style should be emphasized by examining all
   * of the actions sequentially.
   * @param button The button to examine.
   * @returns A StyleInfo object.
   */
  protected _getStyleFromActions(
    config: FrigateCardConfig,
    view: View,
    button: MenuItem,
    options?: MenuButtonControllerOptions,
  ): StyleInfo {
    for (const actionSet of [
      button.tap_action,
      button.double_tap_action,
      button.hold_action,
      button.start_tap_action,
      button.end_tap_action,
    ]) {
      const actions = Array.isArray(actionSet) ? actionSet : [actionSet];
      for (const action of actions) {
        // All frigate card actions will have action of 'fire-dom-event' and
        // styling only applies to those.
        if (
          !action ||
          action.action !== 'fire-dom-event' ||
          !('frigate_card_action' in action)
        ) {
          continue;
        }
        const frigateCardAction = action as FrigateCardCustomAction;
        if (
          FRIGATE_CARD_VIEWS_USER_SPECIFIED.some(
            (viewName) =>
              viewName === frigateCardAction.frigate_card_action &&
              view?.is(frigateCardAction.frigate_card_action),
          ) ||
          (frigateCardAction.frigate_card_action === 'default' &&
            view.is(config.view.default)) ||
          (frigateCardAction.frigate_card_action === 'fullscreen' &&
            !!options?.inFullscreenMode) ||
          (frigateCardAction.frigate_card_action === 'camera_select' &&
            view.camera === frigateCardAction.camera)
        ) {
          return this._getEmphasizedStyle();
        }
      }
    }
    return {};
  }

  /**
   * Determine if the card is currently being casted.
   * @returns
   */
  protected _isBeingCasted(): boolean {
    return !!navigator.userAgent.match(/CrKey\//);
  }
}
