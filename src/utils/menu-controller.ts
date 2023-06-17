import { HomeAssistant } from 'custom-card-helpers';
import { StyleInfo } from 'lit/directives/style-map';
import screenfull from 'screenfull';
import { CameraManager } from '../camera-manager/manager';
import { FRIGATE_BUTTON_MENU_ICON } from '../const';
import { localize } from '../localize/localize.js';
import {
    FRIGATE_CARD_VIEWS_USER_SPECIFIED,
    FrigateCardConfig,
    FrigateCardCustomAction,
    MediaLoadedInfo,
    MenuButton,
} from '../types';
import { View } from '../view/view';
import { createFrigateCardCustomAction } from './action';
import { getAllDependentCameras } from './camera';
import { getEntityIcon, getEntityTitle } from './ha';
import { MicrophoneController } from './microphone';
import { hasSubstream } from './substream';

export class MenuButtonController {
  // Array of dynamic menu buttons to be added to menu.
  protected _dynamicMenuButtons: MenuButton[] = [];

  public addDynamicMenuButton(button: MenuButton): void {
    if (!this._dynamicMenuButtons.includes(button)) {
      this._dynamicMenuButtons.push(button);
    }
  }

  public removeDynamicMenuButton(button: MenuButton): void {
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
    expanded: boolean,
    options?: {
      currentMediaLoadedInfo?: MediaLoadedInfo | null;
      mediaPlayers?: string[];
      cameraURL?: string | null;
      microphoneController?: MicrophoneController;
    },
  ): MenuButton[] {
    const visibleCameras = cameraManager.getStore().getVisibleCameras();
    const selectedCameraID = view.camera;
    const selectedCameraConfig = cameraManager
      .getStore()
      .getCameraConfig(selectedCameraID);
    const allSelectedCameraIDs = getAllDependentCameras(cameraManager, selectedCameraID);
    const selectedMedia = view.queryResults?.getSelectedResult();

    const cameraCapabilities =
      cameraManager.getAggregateCameraCapabilities(allSelectedCameraIDs);
    const mediaCapabilities = selectedMedia
      ? cameraManager?.getMediaCapabilities(selectedMedia)
      : null;

    const buttons: MenuButton[] = [];
    buttons.push({
      // Use a magic icon value that the menu will use to render the custom
      // Frigate icon.
      icon: FRIGATE_BUTTON_MENU_ICON,
      ...config.menu.buttons.frigate,
      type: 'custom:frigate-card-menu-icon',
      title: localize('config.menu.buttons.frigate'),
      tap_action:
        config.menu?.style === 'hidden'
          ? (createFrigateCardCustomAction('menu_toggle') as FrigateCardCustomAction)
          : (createFrigateCardCustomAction('default') as FrigateCardCustomAction),
      hold_action: createFrigateCardCustomAction(
        'diagnostics',
      ) as FrigateCardCustomAction,
    });

    if (visibleCameras) {
      const menuItems = Array.from(visibleCameras, ([cameraID, config]) => {
        const action = createFrigateCardCustomAction('camera_select', {
          camera: cameraID,
        });
        const metadata = cameraManager.getCameraMetadata(hass, cameraID) ?? undefined;

        return {
          enabled: true,
          icon: metadata?.icon,
          entity: config.camera_entity,
          state_color: true,
          title: metadata?.title,
          selected: selectedCameraID === cameraID,
          ...(action && { tap_action: action }),
        };
      });

      buttons.push({
        icon: 'mdi:video-switch',
        ...config.menu.buttons.cameras,
        type: 'custom:frigate-card-menu-submenu',
        title: localize('config.menu.buttons.cameras'),
        items: menuItems,
      });
    }

    if (selectedCameraID && allSelectedCameraIDs && view.is('live')) {
      const dependencies = [...allSelectedCameraIDs];
      const override = view.context?.live?.overrides?.get(selectedCameraID);

      if (dependencies.length === 2) {
        // If there are only two dependencies (the main camera, and 1 other)
        // then use a button not a menu to toggle.
        buttons.push({
          icon: 'mdi:video-input-component',
          style:
            override && override !== selectedCameraID ? this._getEmphasizedStyle() : {},
          title: localize('config.menu.buttons.substreams'),
          ...config.menu.buttons.substreams,
          type: 'custom:frigate-card-menu-icon',
          tap_action: createFrigateCardCustomAction(
            hasSubstream(view) ? 'live_substream_off' : 'live_substream_on',
          ) as FrigateCardCustomAction,
        });
      } else if (dependencies.length > 2) {
        const menuItems = Array.from(dependencies, (cameraID) => {
          const action = createFrigateCardCustomAction('live_substream_select', {
            camera: cameraID,
          });
          const metadata = cameraManager.getCameraMetadata(hass, cameraID) ?? undefined;
          const cameraConfig = cameraManager.getStore().getCameraConfig(cameraID);
          return {
            enabled: true,
            icon: metadata?.icon,
            entity: cameraConfig?.camera_entity,
            state_color: true,
            title: metadata?.title,
            selected:
              (view.context?.live?.overrides?.get(selectedCameraID) ??
                selectedCameraID) === cameraID,
            ...(action && { tap_action: action }),
          };
        });

        buttons.push({
          icon: 'mdi:video-input-component',
          title: localize('config.menu.buttons.substreams'),
          style:
            override && override !== selectedCameraID ? this._getEmphasizedStyle() : {},
          ...config.menu.buttons.substreams,
          type: 'custom:frigate-card-menu-submenu',
          items: menuItems,
        });
      }
    }

    buttons.push({
      icon: 'mdi:cctv',
      ...config.menu.buttons.live,
      type: 'custom:frigate-card-menu-icon',
      title: localize('config.view.views.live'),
      style: view.is('live') ? this._getEmphasizedStyle() : {},
      tap_action: createFrigateCardCustomAction('live') as FrigateCardCustomAction,
    });

    if (cameraCapabilities?.supportsClips) {
      buttons.push({
        icon: 'mdi:filmstrip',
        ...config.menu.buttons.clips,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.view.views.clips'),
        style: view?.is('clips') ? this._getEmphasizedStyle() : {},
        tap_action: createFrigateCardCustomAction('clips') as FrigateCardCustomAction,
        hold_action: createFrigateCardCustomAction('clip') as FrigateCardCustomAction,
      });
    }

    if (cameraCapabilities?.supportsSnapshots) {
      buttons.push({
        icon: 'mdi:camera',
        ...config.menu.buttons.snapshots,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.view.views.snapshots'),
        style: view?.is('snapshots') ? this._getEmphasizedStyle() : {},
        tap_action: createFrigateCardCustomAction(
          'snapshots',
        ) as FrigateCardCustomAction,
        hold_action: createFrigateCardCustomAction(
          'snapshot',
        ) as FrigateCardCustomAction,
      });
    }

    if (cameraCapabilities?.supportsRecordings) {
      buttons.push({
        icon: 'mdi:album',
        ...config.menu.buttons.recordings,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.view.views.recordings'),
        style: view.is('recordings') ? this._getEmphasizedStyle() : {},
        tap_action: createFrigateCardCustomAction(
          'recordings',
        ) as FrigateCardCustomAction,
        hold_action: createFrigateCardCustomAction(
          'recording',
        ) as FrigateCardCustomAction,
      });
    }

    buttons.push({
      icon: 'mdi:image',
      ...config.menu.buttons.image,
      type: 'custom:frigate-card-menu-icon',
      title: localize('config.view.views.image'),
      style: view?.is('image') ? this._getEmphasizedStyle() : {},
      tap_action: createFrigateCardCustomAction('image') as FrigateCardCustomAction,
    });

    // Don't show the timeline button unless there's at least one non-birdseye
    // camera with a Frigate camera name.
    if (cameraCapabilities?.supportsTimeline) {
      buttons.push({
        icon: 'mdi:chart-gantt',
        ...config.menu.buttons.timeline,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.view.views.timeline'),
        style: view.is('timeline') ? this._getEmphasizedStyle() : {},
        tap_action: createFrigateCardCustomAction('timeline') as FrigateCardCustomAction,
      });
    }

    if (mediaCapabilities?.canDownload && !this._isBeingCasted()) {
      buttons.push({
        icon: 'mdi:download',
        ...config.menu.buttons.download,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.download'),
        tap_action: createFrigateCardCustomAction('download') as FrigateCardCustomAction,
      });
    }

    if (options?.cameraURL) {
      buttons.push({
        icon: 'mdi:web',
        ...config.menu.buttons.camera_ui,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.camera_ui'),
        tap_action: createFrigateCardCustomAction(
          'camera_ui',
        ) as FrigateCardCustomAction,
      });
    }

    if (
      options?.microphoneController &&
      options?.currentMediaLoadedInfo?.capabilities?.supports2WayAudio
    ) {
      const forbidden = options.microphoneController.isForbidden();
      const muted = options.microphoneController.isMuted();
      const buttonType = config.menu.buttons.microphone.type;
      buttons.push({
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
            start_tap_action: createFrigateCardCustomAction(
              'microphone_unmute',
            ) as FrigateCardCustomAction,
            end_tap_action: createFrigateCardCustomAction(
              'microphone_mute',
            ) as FrigateCardCustomAction,
          }),
        ...(!forbidden &&
          buttonType === 'toggle' && {
            tap_action: createFrigateCardCustomAction(
              options.microphoneController.isMuted()
                ? 'microphone_unmute'
                : 'microphone_mute',
            ) as FrigateCardCustomAction,
          }),
      });
    }

    if (screenfull.isEnabled && !this._isBeingCasted()) {
      buttons.push({
        icon: screenfull.isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen',
        ...config.menu.buttons.fullscreen,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.fullscreen'),
        tap_action: createFrigateCardCustomAction(
          'fullscreen',
        ) as FrigateCardCustomAction,
        style: screenfull.isFullscreen ? this._getEmphasizedStyle() : {},
      });
    }

    buttons.push({
      icon: expanded ? 'mdi:arrow-collapse-all' : 'mdi:arrow-expand-all',
      ...config.menu.buttons.expand,
      type: 'custom:frigate-card-menu-icon',
      title: localize('config.menu.buttons.expand'),
      tap_action: createFrigateCardCustomAction('expand') as FrigateCardCustomAction,
      style: expanded ? this._getEmphasizedStyle() : {},
    });

    if (
      options?.mediaPlayers?.length &&
      (view?.isViewerView() || (view.is('live') && selectedCameraConfig?.camera_entity))
    ) {
      const mediaPlayerItems = options.mediaPlayers.map((playerEntityID) => {
        const title = getEntityTitle(hass, playerEntityID) || playerEntityID;
        const state = hass.states[playerEntityID];
        const playAction = createFrigateCardCustomAction('media_player', {
          media_player: playerEntityID,
          media_player_action: 'play',
        });
        const stopAction = createFrigateCardCustomAction('media_player', {
          media_player: playerEntityID,
          media_player_action: 'stop',
        });
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

      buttons.push({
        icon: 'mdi:cast',
        ...config.menu.buttons.media_player,
        type: 'custom:frigate-card-menu-submenu',
        title: localize('config.menu.buttons.media_player'),
        items: mediaPlayerItems,
      });
    }

    if (options?.currentMediaLoadedInfo && options.currentMediaLoadedInfo.player) {
      if (options.currentMediaLoadedInfo.capabilities?.supportsPause) {
        const paused = options.currentMediaLoadedInfo.player.isPaused();
        buttons.push({
          icon: paused ? 'mdi:play' : 'mdi:pause',
          ...config.menu.buttons.play,
          type: 'custom:frigate-card-menu-icon',
          title: localize('config.menu.buttons.play'),
          tap_action: createFrigateCardCustomAction(
            paused ? 'play' : 'pause',
          ) as FrigateCardCustomAction,
        });
      }

      if (options.currentMediaLoadedInfo.capabilities?.hasAudio) {
        const muted = options.currentMediaLoadedInfo.player.isMuted();
        buttons.push({
          icon: muted ? 'mdi:volume-off' : 'mdi:volume-high',
          ...config.menu.buttons.mute,
          type: 'custom:frigate-card-menu-icon',
          title: localize('config.menu.buttons.mute'),
          tap_action: createFrigateCardCustomAction(
            muted ? 'unmute' : 'mute',
          ) as FrigateCardCustomAction,
        });
      }
    }

    if (options?.currentMediaLoadedInfo && options.currentMediaLoadedInfo.player) {
      buttons.push({
        icon: 'mdi:monitor-screenshot',
        ...config.menu.buttons.screenshot,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.screenshot'),
        tap_action: createFrigateCardCustomAction('screenshot') as FrigateCardCustomAction,
      });
    }

    const styledDynamicButtons = this._dynamicMenuButtons.map((button) => ({
      style: this._getStyleFromActions(config, view, button),
      ...button,
    }));

    return buttons.concat(styledDynamicButtons);
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
    button: MenuButton,
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
            screenfull.isEnabled &&
            screenfull.isFullscreen) ||
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
