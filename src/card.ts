import { getLovelace, HomeAssistant, LovelaceCardEditor } from 'custom-card-helpers';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { StyleInfo, styleMap } from 'lit/directives/style-map.js';
import { until } from 'lit/directives/until.js';
import throttle from 'lodash-es/throttle';
import screenfull from 'screenfull';
import { z } from 'zod';
import { actionHandler } from './action-handler-directive.js';
import {
  CardConditionManager,
  ConditionState,
  conditionStateRequestHandler,
  getOverriddenConfig,
  getOverridesByKey,
} from './card-condition.js';
import './components/elements.js';
import { FrigateCardElements } from './components/elements.js';
import type { FrigateCardImage } from './components/image.js';
import type { FrigateCardLive } from './components/live/live.js';
import './components/menu.js';
import { FrigateCardMenu, FRIGATE_BUTTON_MENU_ICON } from './components/menu.js';
import './components/message.js';
import { renderMessage, renderProgressIndicator } from './components/message.js';
import './components/thumbnail-carousel.js';
import { isConfigUpgradeable } from './config-mgmt.js';
import {
  CAMERA_BIRDSEYE,
  MEDIA_PLAYER_SUPPORT_BROWSE_MEDIA,
  REPO_URL,
} from './const.js';
import { getLanguage, loadLanguages, localize } from './localize/localize.js';
import cardStyle from './scss/card.scss';
import {
  Actions,
  ActionType,
  CameraConfig,
  EntityList,
  ExtendedEntity,
  ExtendedHomeAssistant,
  FrigateCardConfig,
  frigateCardConfigSchema,
  FrigateCardCustomAction,
  FrigateCardView,
  FRIGATE_CARD_VIEWS_USER_SPECIFIED,
  MediaLoadedInfo,
  MESSAGE_TYPE_PRIORITIES,
  MenuButton,
  Message,
  RawFrigateCardConfig,
  CardWideConfig,
} from './types.js';
import {
  convertActionToFrigateCardCustomAction,
  createFrigateCardCustomAction,
  frigateCardHandleAction,
  frigateCardHasAction,
  getActionConfigGivenAction,
} from './utils/action.js';
import { contentsChanged, errorToConsole } from './utils/basic.js';
import { getCameraID } from './utils/camera.js';
import {
  getEntityIcon,
  getEntityTitle,
  getHassDifferences,
  homeAssistantSignPath,
  isCardInPanel,
  isHassDifferent,
  isTriggeredState,
  sideLoadHomeAssistantElements,
} from './utils/ha';
import { DeviceList, getAllDevices } from './utils/ha/device-registry.js';
import {
  ExtendedEntityCache,
  getAllEntities,
  getExtendedEntities,
  getExtendedEntity,
} from './utils/ha/entity-registry.js';
import { ResolvedMediaCache } from './utils/ha/resolved-media.js';
import { supportsFeature } from './utils/ha/update.js';
import { isValidMediaLoadedInfo } from './utils/media-info.js';
import { View } from './view/view.js';
import pkg from '../package.json';
import { ViewContext } from 'view';
import { CameraManager } from './camera/manager.js';
import { setLowPerformanceProfile, setPerformanceCSSStyles } from './performance.js';
import { CameraManagerEngineFactory } from './camera/engine-factory.js';
import { log } from './utils/debug.js';

/** A note on media callbacks:
 *
 * Media elements (e.g. <video>, <img> or <canvas>) need to callback when:
 *  - Metadata is loaded / dimensions are known (for aspect-ratio)
 *  - Media is playing / paused (to avoid reloading)
 *
 * A number of different approaches used to attach event handlers to
 * get these callbacks (which need to be attached directly to the media
 * elements, which may be 'buried' down the DOM):
 *  - Extend the `ha-hls-player` and `ha-camera-stream` to specify the required
 *    hooks (as querySelecting the media elements after rendering was a fight
 *    with the Lit rendering engine and was very fragile) .
 *  - For non-Lit elements (e.g. WebRTC) query selecting after rendering.
 *  - Library provided hooks (e.g. JSMPEG)
 *  - Directly specifying hooks (e.g. for snapshot viewing with simple <img> tags)
 */

/** A note on action/menu/ll-custom events:
 *
 * The card supports actions being configured in a number of places (e.g. tap on an
 * element, double_tap on a menu item, hold on the live view). These actions are
 * handled frigateCardHandleAction(). For Frigate-card specific actions,
 * frigateCardHandleAction() call will result in an ll-custom DOM event being
 * fired, which needs to be caught at the card level to handle.
 */

/* eslint no-console: 0 */
console.info(
  `%c FRIGATE-HASS-CARD \n` +
    `%c ${localize('common.version')} ` +
    `${pkg.version} ` +
    `${process.env.NODE_ENV === 'development' ? `(${pkg['buildDate']})` : ''}`,
  'color: pink; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).customCards = (window as any).customCards || [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).customCards.push({
  type: 'frigate-card',
  name: localize('common.frigate_card'),
  description: localize('common.frigate_card_description'),
  preview: true,
  documentationURL: REPO_URL,
});

type InitializedType = 'initialized' | 'initializing';

/**
 * Main FrigateCard class.
 */
@customElement('frigate-card')
export class FrigateCard extends LitElement {
  @state()
  protected _hass?: ExtendedHomeAssistant;

  // The main base configuration object. For most usecases use getConfig() to
  // get the correct configuration (which will return overrides as appropriate).
  // This variable must be called `_config` or `config` to be compatible with
  // card-mod.
  @state()
  protected _config!: FrigateCardConfig;
  protected _rawConfig?: RawFrigateCardConfig;

  @state()
  protected _cardWideConfig?: CardWideConfig;

  @state()
  protected _overriddenConfig?: FrigateCardConfig;

  @state()
  protected _view?: View;

  // Whether or not the card is in panel mode on the dashboard.
  @property({ attribute: 'panel', type: Boolean, reflect: true })
  protected _panel = false;

  protected _conditionState?: ConditionState;

  protected _refMenu: Ref<FrigateCardMenu> = createRef();
  protected _refMain: Ref<HTMLElement> = createRef();
  protected _refElements: Ref<FrigateCardElements> = createRef();
  protected _refImage: Ref<FrigateCardImage> = createRef();
  protected _refLive: Ref<FrigateCardLive> = createRef();

  // user interaction timer ("screensaver" functionality, return to default
  // view after user interaction).
  protected _interactionTimerID: number | null = null;

  // Automated refreshes of the default view.
  protected _updateTimerID: number | null = null;

  // Information about loaded media items.
  protected _currentMediaLoadedInfo: MediaLoadedInfo | null = null;
  protected _lastValidMediaLoadedInfo: MediaLoadedInfo | null = null;

  // Array of dynamic menu buttons to be added to menu.
  protected _dynamicMenuButtons: MenuButton[] = [];

  @state()
  protected _cameras?: Map<string, CameraConfig>;

  // Error/info message to render.
  protected _message: Message | null = null;

  // A cache of resolved media URLs/mimetypes for use in the whole card.
  protected _resolvedMediaCache = new ResolvedMediaCache();

  protected _cameraManager?: CameraManager;

  // The mouse handler may be called continually, throttle it to at most once
  // per second for performance reasons.
  protected _boundMouseHandler = throttle(this._mouseHandler.bind(this), 1 * 1000);

  // Whether the card has been successfully initialized.
  protected _initialized?: InitializedType;

  protected _triggers: Map<string, Date> = new Map();
  protected _untriggerTimerID: number | null = null;

  protected _conditionManager: CardConditionManager | null = null;

  /**
   * Set the Home Assistant object.
   */
  set hass(hass: ExtendedHomeAssistant) {
    this._hass = hass;

    // Manually set hass in the menu, elements and image. This is to allow these
    // to update, without necessarily re-rendering the entire card (re-rendering
    // is expensive).
    if (this._hass) {
      if (this._refMenu.value) {
        this._refMenu.value.hass = this._hass;
      }
      if (this._refElements.value) {
        this._refElements.value.hass = this._hass;
      }
      if (this._refImage.value) {
        this._refImage.value.hass = this._hass;
      }
    }

    if (this._conditionManager?.hasHAStateConditions) {
      // HA entity state is part of the condition state.
      this._generateConditionState();
    }

    // Dark mode may depend on HASS.
    this._setLightOrDarkMode();
  }

  /**
   * Get the card editor element.
   * @returns A LovelaceCardEditor element.
   */
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    await import('./editor.js');
    return document.createElement('frigate-card-editor');
  }

  /**
   * Get a stub basic config using the first available camera of any kind.
   * @param _hass The Home Assistant object.
   * @param entities The entities available to Home Assistant.
   * @returns A valid stub card configuration.
   */
  public static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
  ): FrigateCardConfig {
    const cameraEntity = entities.find((element) => element.startsWith('camera.'));
    return {
      cameras: [
        {
          camera_entity: cameraEntity,
        },
      ],
      // Need to use 'as unknown' to convince Typescript that this really isn't a
      // mistake, despite the miniscule size of the configuration vs the full type
      // description.
    } as unknown as FrigateCardConfig;
  }

  /**
   * Generate the state used to evaluate conditions.
   */
  protected _generateConditionState(): void {
    this._conditionState = {
      view: this._view?.view,
      fullscreen: screenfull.isEnabled && screenfull.isFullscreen,
      camera: this._view?.camera,
      media_loaded: !!this._currentMediaLoadedInfo,
      ...(this._conditionManager?.hasHAStateConditions && {
        state: this._hass?.states,
      }),
    };

    // Update the components that need the new condition state. Passed directly
    // to them to avoid the performance hit of a entire card re-render (esp.
    // when using card-mod).
    // https://github.com/dermotduffy/frigate-hass-card/issues/678
    if (this._refLive.value) {
      this._refLive.value.conditionState = this._conditionState;
    }
    if (this._refElements.value) {
      this._refElements.value.conditionState = this._conditionState;
    }

    const overriddenConfig = getOverriddenConfig(
      this._config,
      this._config.overrides,
      this._conditionState,
    ) as FrigateCardConfig;

    // Save on Lit re-rendering costs by only updating the configuration if it
    // actually changes.
    if (contentsChanged(overriddenConfig, this._overriddenConfig)) {
      this._overriddenConfig = overriddenConfig;
    }
  }

  /**
   * Get the style of emphasized menu items.
   * @returns A StyleInfo.
   */
  protected _getEmphasizedStyle(): StyleInfo {
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
  protected _getStyleFromActions(button: MenuButton): StyleInfo {
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
            (view) =>
              view === frigateCardAction.frigate_card_action &&
              this._view?.is(frigateCardAction.frigate_card_action),
          ) ||
          (frigateCardAction.frigate_card_action === 'default' &&
            this._view?.is(this._getConfig().view.default)) ||
          (frigateCardAction.frigate_card_action === 'fullscreen' &&
            screenfull.isEnabled &&
            screenfull.isFullscreen) ||
          (frigateCardAction.frigate_card_action === 'camera_select' &&
            this._view?.camera === frigateCardAction.camera)
        ) {
          return this._getEmphasizedStyle();
        }
      }
    }
    return {};
  }

  /**
   * Get the menu buttons to display.
   * @returns An array of menu buttons.
   */
  protected _getMenuButtons(): MenuButton[] {
    const buttons: MenuButton[] = [];

    buttons.push({
      // Use a magic icon value that the menu will use to render the custom
      // Frigate icon.
      icon: FRIGATE_BUTTON_MENU_ICON,
      ...this._getConfig().menu.buttons.frigate,
      type: 'custom:frigate-card-menu-icon',
      title: localize('config.menu.buttons.frigate'),
      tap_action: FrigateCardMenu.isHidingMenu(this._getConfig().menu)
        ? (createFrigateCardCustomAction('menu_toggle') as FrigateCardCustomAction)
        : (createFrigateCardCustomAction('default') as FrigateCardCustomAction),
      hold_action: createFrigateCardCustomAction(
        'diagnostics',
      ) as FrigateCardCustomAction,
    });

    if (this._cameras && this._cameras.size > 1) {
      const menuItems = Array.from(this._cameras, ([camera, config]) => {
        const action = createFrigateCardCustomAction('camera_select', {
          camera: camera,
        });
        const metadata = this._hass
          ? this._cameraManager?.getCameraMetadata(this._hass, config) ?? undefined
          : undefined;

        return {
          enabled: true,
          icon: metadata?.icon,
          entity: config.camera_entity,
          state_color: true,
          title: metadata?.title,
          selected: this._view?.camera === camera,
          ...(action && { tap_action: action }),
        };
      });

      buttons.push({
        icon: 'mdi:video-switch',
        ...this._getConfig().menu.buttons.cameras,
        type: 'custom:frigate-card-menu-submenu',
        title: localize('config.menu.buttons.cameras'),
        items: menuItems,
      });
    }

    buttons.push({
      icon: 'mdi:cctv',
      ...this._getConfig().menu.buttons.live,
      type: 'custom:frigate-card-menu-icon',
      title: localize('config.view.views.live'),
      style: this._view?.is('live') ? this._getEmphasizedStyle() : {},
      tap_action: createFrigateCardCustomAction('live') as FrigateCardCustomAction,
    });

    const cameraConfig = this._getSelectedCameraConfig();

    // Don't show `clips` button if there's no `camera_name` (e.g. non-Frigate
    // cameras), or is birdseye (unless there are dependent cameras).
    if (
      cameraConfig?.frigate.camera_name &&
      (cameraConfig?.frigate.camera_name !== CAMERA_BIRDSEYE ||
        cameraConfig.dependencies.cameras.length ||
        cameraConfig.dependencies.all_cameras)
    ) {
      buttons.push({
        icon: 'mdi:filmstrip',
        ...this._getConfig().menu.buttons.clips,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.view.views.clips'),
        style: this._view?.is('clips') ? this._getEmphasizedStyle() : {},
        tap_action: createFrigateCardCustomAction('clips') as FrigateCardCustomAction,
        hold_action: createFrigateCardCustomAction('clip') as FrigateCardCustomAction,
      });
    }

    // Don't show `snapshots` button if there's no `camera_name` (e.g. non-Frigate
    // cameras), or is birdseye (unless there are dependent cameras).
    if (
      cameraConfig?.frigate.camera_name &&
      (cameraConfig?.frigate.camera_name !== CAMERA_BIRDSEYE ||
        cameraConfig?.dependencies.cameras.length ||
        cameraConfig?.dependencies.all_cameras)
    ) {
      buttons.push({
        icon: 'mdi:camera',
        ...this._getConfig().menu.buttons.snapshots,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.view.views.snapshots'),
        style: this._view?.is('snapshots') ? this._getEmphasizedStyle() : {},
        tap_action: createFrigateCardCustomAction(
          'snapshots',
        ) as FrigateCardCustomAction,
        hold_action: createFrigateCardCustomAction(
          'snapshot',
        ) as FrigateCardCustomAction,
      });
    }

    // Don't show `recordings` button if there's no `camera_name` (e.g. non-Frigate
    // cameras), or is birdseye (unless there are dependent cameras).
    if (
      cameraConfig?.frigate.camera_name &&
      (cameraConfig?.frigate.camera_name !== CAMERA_BIRDSEYE ||
        cameraConfig?.dependencies.cameras.length ||
        cameraConfig?.dependencies.all_cameras)
    ) {
      buttons.push({
        icon: 'mdi:album',
        ...this._getConfig().menu.buttons.recordings,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.view.views.recordings'),
        style: this._view?.is('recordings') ? this._getEmphasizedStyle() : {},
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
      ...this._getConfig().menu.buttons.image,
      type: 'custom:frigate-card-menu-icon',
      title: localize('config.view.views.image'),
      style: this._view?.is('image') ? this._getEmphasizedStyle() : {},
      tap_action: createFrigateCardCustomAction('image') as FrigateCardCustomAction,
    });

    // Don't show the timeline button unless there's at least one non-birdseye
    // camera with a Frigate camera name.
    if (
      this._cameras &&
      [...this._cameras.values()].some(
        (config) =>
          config.frigate.camera_name && config.frigate.camera_name !== CAMERA_BIRDSEYE,
      )
    ) {
      buttons.push({
        icon: 'mdi:chart-gantt',
        ...this._getConfig().menu.buttons.timeline,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.view.views.timeline'),
        style: this._view?.is('timeline') ? this._getEmphasizedStyle() : {},
        tap_action: createFrigateCardCustomAction('timeline') as FrigateCardCustomAction,
      });
    }

    if (
      !this._isBeingCasted() &&
      (this._view?.isViewerView() ||
        (this._view?.is('timeline') && !!this._view?.queryResults?.hasSelectedResult()))
    ) {
      buttons.push({
        icon: 'mdi:download',
        ...this._getConfig().menu.buttons.download,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.download'),
        tap_action: createFrigateCardCustomAction('download') as FrigateCardCustomAction,
      });
    }

    if (cameraConfig?.frigate.url) {
      buttons.push({
        icon: 'mdi:web',
        ...this._getConfig().menu.buttons.frigate_ui,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.frigate_ui'),
        tap_action: createFrigateCardCustomAction(
          'frigate_ui',
        ) as FrigateCardCustomAction,
      });
    }

    if (screenfull.isEnabled && !this._isBeingCasted()) {
      buttons.push({
        icon: screenfull.isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen',
        ...this._getConfig().menu.buttons.fullscreen,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.fullscreen'),
        tap_action: createFrigateCardCustomAction(
          'fullscreen',
        ) as FrigateCardCustomAction,
        style: screenfull.isFullscreen ? this._getEmphasizedStyle() : {},
      });
    }

    const isValidMediaPlayer = (entity: string): boolean => {
      if (entity.startsWith('media_player.')) {
        const stateObj = this._hass?.states[entity];
        if (
          stateObj &&
          stateObj.state !== 'unavailable' &&
          supportsFeature(stateObj, MEDIA_PLAYER_SUPPORT_BROWSE_MEDIA)
        ) {
          return true;
        }
      }
      return false;
    };

    const mediaPlayers = Object.keys(this._hass?.states || {}).filter(
      isValidMediaPlayer,
    );
    if (
      mediaPlayers.length &&
      (this._view?.isViewerView() ||
        (this._view?.is('live') && cameraConfig?.camera_entity))
    ) {
      const mediaPlayerItems = mediaPlayers.map((playerEntityID) => {
        const title = getEntityTitle(this._hass, playerEntityID) || playerEntityID;
        const state = this._hass?.states[playerEntityID];
        const playAction = createFrigateCardCustomAction('media_player', {
          media_player: playerEntityID,
          media_player_action: 'play',
        });
        const stopAction = createFrigateCardCustomAction('media_player', {
          media_player: playerEntityID,
          media_player_action: 'stop',
        });

        return {
          enabled: true,
          selected: false,
          icon: getEntityIcon(this._hass, playerEntityID) || 'mdi:cast',
          entity: playerEntityID,
          state_color: false,
          title: title,
          disabled: !state || state.state === 'unavailable',
          ...(playAction && { tap_action: playAction }),
          ...(stopAction && { hold_action: stopAction }),
        };
      });

      buttons.push({
        icon: 'mdi:cast',
        ...this._getConfig().menu.buttons.media_player,
        type: 'custom:frigate-card-menu-submenu',
        title: localize('config.menu.buttons.media_player'),
        items: mediaPlayerItems,
      });
    }

    const styledDynamicButtons = this._dynamicMenuButtons.map((button) => ({
      style: this._getStyleFromActions(button),
      ...button,
    }));

    return buttons.concat(styledDynamicButtons);
  }

  /**
   * Add a dynamic (elements) menu button.
   * @param button The button to add.
   */
  public _addDynamicMenuButton(button: MenuButton): void {
    if (!this._dynamicMenuButtons.includes(button)) {
      this._dynamicMenuButtons = [...this._dynamicMenuButtons, button];
    }
    if (this._refMenu.value) {
      this._refMenu.value.buttons = this._getMenuButtons();
    }
  }

  /**
   * Remove a dynamic (elements) menu button that was previously added.
   * @param target The button to remove.
   */
  public _removeDynamicMenuButton(target: MenuButton): void {
    this._dynamicMenuButtons = this._dynamicMenuButtons.filter(
      (button) => button != target,
    );
    if (this._refMenu.value) {
      this._refMenu.value.buttons = this._getMenuButtons();
    }
  }

  /**
   * Get the motion sensor entity for a given camera.
   * @param cache The ExtendedEntityCache of entity registry information.
   * @param cameraConfig The camera config in question.
   * @returns The entity id of the motion sensor or null.
   */
  protected _getMotionSensor(
    cache: ExtendedEntityCache,
    cameraConfig: CameraConfig,
  ): string | null {
    if (cameraConfig.frigate.camera_name) {
      return (
        cache.getMatch(
          (ent) =>
            !!ent.unique_id?.match(
              new RegExp(
                `:motion_sensor:${
                  cameraConfig.frigate.zone || cameraConfig.frigate.camera_name
                }`,
              ),
            ),
        )?.entity_id ?? null
      );
    }
    return null;
  }

  /**
   * Get the occupancy sensor entity for a given camera.
   * @param cache The ExtendedEntityCache of entity registry information.
   * @param cameraConfig The camera config in question.
   * @returns The entity id of the occupancy sensor or null.
   */
  protected _getOccupancySensor(
    cache: ExtendedEntityCache,
    cameraConfig: CameraConfig,
  ): string | null {
    if (cameraConfig.frigate.camera_name) {
      return (
        cache.getMatch(
          (ent) =>
            !!ent.unique_id?.match(
              new RegExp(
                `:occupancy_sensor:${
                  cameraConfig.frigate.zone || cameraConfig.frigate.camera_name
                }_${cameraConfig.frigate.label || 'all'}`,
              ),
            ),
        )?.entity_id ?? null
      );
    }
    return null;
  }

  /**
   * Fully load the configured cameras.
   */
  protected async _loadCameras(): Promise<void> {
    if (!this._hass) {
      return;
    }

    const hasAutoTriggers = (config: CameraConfig): boolean => {
      return config.triggers.motion || config.triggers.occupancy;
    };
    const hasAnyTriggers = (config: CameraConfig): boolean => {
      return hasAutoTriggers(config) || !!config.triggers.entities.length;
    };
    const hasCameraName = (config: CameraConfig): boolean => {
      return !!config.frigate?.camera_name;
    };

    // Loading cameras may require a number of calls to Home Assistant.
    //
    // - getAllEntities: Required if any camera has auto-triggers (motion or
    //   occupancy sensors).
    // - getExtendedEntity: Per camera entity to autodetect the Frigate camera
    //   name or to compute auto-triggers (motion or occupancy sensors).
    // - getExtendedEntities: Per binary sensor associated with a Frigate config
    //   entry, to compute auto-triggers (motion or occupancy sensors).
    //
    // For loading performance these are only called when absolutely needed.

    let entityList: EntityList | undefined;
    const cache = new ExtendedEntityCache();
    const loadedCameras: CameraConfig[] = [];

    const addCameraConfig = async (config: CameraConfig, index: number) => {
      if (!this._hass) {
        return;
      }

      let entity: ExtendedEntity | null = null;
      if (config.camera_entity && (hasAnyTriggers(config) || !hasCameraName(config))) {
        try {
          entity = await getExtendedEntity(this._hass, config.camera_entity, cache);
        } catch (e) {
          // Silently ignore errors here, as non-Frigate camera entities may not
          // necessarily have a registry entry and otherwise this would cause
          // log spam for those cases.
        }
      }

      if (entity && !hasCameraName(config)) {
        const resolvedName = this._getFrigateCameraNameFromEntity(entity);
        if (resolvedName) {
          config.frigate.camera_name = resolvedName;
        }
      }

      if (entity && entityList && hasAnyTriggers(config)) {
        if (hasAutoTriggers(config)) {
          // Try to find the correct entities for the motion & occupancy sensors.
          // We know they are binary_sensors, and that they'll have the same
          // config entry ID as the camera. Searching via unique_id ensures this
          // search still works if the user renames the entity_id.
          const binarySensorEntities = entityList.filter(
            (ent) =>
              ent.config_entry_id === entity?.config_entry_id &&
              !ent.disabled_by &&
              ent.entity_id.startsWith('binary_sensor.'),
          );

          try {
            await getExtendedEntities(
              this._hass,
              binarySensorEntities.map((ent) => ent.entity_id),
              cache,
            );
          } catch (e) {
            errorToConsole(e as Error);
          }

          if (config.triggers.motion) {
            const motionEntity = this._getMotionSensor(cache, config);
            if (motionEntity) {
              config.triggers.entities.push(motionEntity);
            }
          }

          if (config.triggers.occupancy) {
            const occupancyEntity = this._getOccupancySensor(cache, config);
            if (occupancyEntity) {
              config.triggers.entities.push(occupancyEntity);
            }
          }
        }

        config.triggers.entities = [...new Set(config.triggers.entities)];
      }

      loadedCameras[index] = config;
    };

    let errorFree = true;
    const cameras: Map<string, CameraConfig> = new Map();
    const configCameras = this._getConfig().cameras;

    if (configCameras && Array.isArray(configCameras)) {
      if (configCameras.some((config) => hasAutoTriggers(config))) {
        try {
          entityList = await getAllEntities(this._hass);
        } catch (e) {
          errorToConsole(e as Error);
        }
      }

      // Load all cameras in parallel, but remember the order they were provided
      // (they must be added to the cameraMap in this same order).
      await Promise.all(
        configCameras.map((configCamera, index) => addCameraConfig(configCamera, index)),
      );

      loadedCameras.forEach((loadedCamera: CameraConfig) => {
        const id = getCameraID(loadedCamera);
        if (!id) {
          this._setMessageAndUpdate({
            message: localize('error.no_camera_id'),
            type: 'error',
            context: loadedCamera,
          });
          errorFree = false;
        } else if (cameras.has(id)) {
          this._setMessageAndUpdate({
            message: localize('error.duplicate_camera_id'),
            type: 'error',
            context: loadedCamera,
          });
          errorFree = false;
        } else {
          cameras.set(id, loadedCamera);
        }
      });
    }

    if (!cameras.size) {
      return this._setMessageAndUpdate({
        message: localize('error.no_cameras'),
        type: 'error',
      });
      errorFree = false;
    }

    if (errorFree) {
      this._cameras = cameras;
    }
  }

  /**
   * Get the camera configuration for the selected camera.
   * @returns The CameraConfig object or null if not found.
   */
  protected _getSelectedCameraConfig(): CameraConfig | null {
    if (!this._cameras || !this._cameras.size || !this._view?.camera) {
      return null;
    }
    return this._cameras.get(this._view.camera) || null;
  }

  /**
   * Get the Frigate camera name from an entity.
   * @returns The Frigate camera name or null if unavailable.
   */
  protected _getFrigateCameraNameFromEntity(entity: ExtendedEntity): string | null {
    if (entity.unique_id && entity.platform === 'frigate') {
      const match = entity.unique_id.match(/:camera:(?<camera>[^:]+)$/);
      if (match && match.groups) {
        return match.groups['camera'];
      }
    }
    return null;
  }

  /**
   * Get configuration parse errors.
   * @param error The ZodError object from parsing.
   * @returns An array of string error paths.
   */
  protected _getParseErrorPaths<T>(error: z.ZodError<T>): Set<string> | null {
    /* Zod errors involving unions are complex, as Zod may not be able to tell
     * where the 'real' error is vs simply a union option not matching. This
     * function finds all ZodError "issues" that don't have an error with 'type'
     * in that object ('type' is the union discriminator for picture elements,
     * the major union in the schema). An array of user-readable error
     * locations is returned, or an empty list if none is available. None being
     * available suggests the configuration has an error, but we can't tell
     * exactly why (or rather Zod simply says it doesn't match any of the
     * available unions). This usually suggests the user specified an incorrect
     * type name entirely. */
    const contenders = new Set<string>();
    if (error && error.issues) {
      for (let i = 0; i < error.issues.length; i++) {
        const issue = error.issues[i];
        if (issue.code == 'invalid_union') {
          const unionErrors = (issue as z.ZodInvalidUnionIssue).unionErrors;
          for (let j = 0; j < unionErrors.length; j++) {
            const nestedErrors = this._getParseErrorPaths(unionErrors[j]);
            if (nestedErrors && nestedErrors.size) {
              nestedErrors.forEach(contenders.add, contenders);
            }
          }
        } else if (issue.code == 'invalid_type') {
          if (issue.path[issue.path.length - 1] == 'type') {
            return null;
          }
          contenders.add(this._getParseErrorPathString(issue.path));
        } else if (issue.code != 'custom') {
          contenders.add(this._getParseErrorPathString(issue.path));
        }
      }
    }
    return contenders;
  }

  /**
   * Convert an array of strings and indices into a more user readable string,
   * e.g. [a, 1, b, 2] => 'a[1] -> b[2]'
   * @param path An array of strings and numbers.
   * @returns A single string.
   */
  protected _getParseErrorPathString(path: (string | number)[]): string {
    let out = '';
    for (let i = 0; i < path.length; i++) {
      const item = path[i];
      if (typeof item == 'number') {
        out += '[' + item + ']';
      } else if (out) {
        out += ' -> ' + item;
      } else {
        out = item;
      }
    }
    return out;
  }

  /**
   * Set the card configuration.
   * @param inputConfig The card configuration.
   */
  public setConfig(inputConfig: RawFrigateCardConfig): void {
    if (!inputConfig) {
      throw new Error(localize('error.invalid_configuration'));
    }

    const parseResult = frigateCardConfigSchema.safeParse(inputConfig);
    if (!parseResult.success) {
      const configUpgradeable = isConfigUpgradeable(inputConfig);
      const hint = this._getParseErrorPaths(parseResult.error);
      let upgradeMessage = '';
      if (configUpgradeable && getLovelace().mode !== 'yaml') {
        upgradeMessage = `${localize('error.upgrade_available')}. `;
      }
      throw new Error(
        upgradeMessage +
          `${localize('error.invalid_configuration')}: ` +
          (hint && hint.size
            ? JSON.stringify([...hint], null, ' ')
            : localize('error.invalid_configuration_no_hint')),
      );
    }
    const config =
      parseResult.data.performance.profile !== 'low'
        ? parseResult.data
        : setLowPerformanceProfile(inputConfig, parseResult.data);

    if (config.test_gui) {
      getLovelace().setEditMode(true);
    }

    this._rawConfig = inputConfig;
    this._config = config;
    this._cardWideConfig = {
      performance: config.performance,
      debug: config.debug,
    };

    this._overriddenConfig = undefined;
    this._cameras = undefined;
    this._view = undefined;
    this._message = null;

    this._conditionManager?.destroy();
    this._conditionManager = new CardConditionManager(
      config,
      this._generateConditionState.bind(this),
    );

    this._generateConditionState();
    this._setLightOrDarkMode();
    this._untrigger();
  }

  /**
   * Card the card config, prioritizing the overriden config if present.
   * @returns A FrigateCardConfig.
   */
  protected _getConfig(): FrigateCardConfig {
    return this._overriddenConfig || this._config;
  }

  protected _changeView(args?: { view?: View; resetMessage?: boolean }): void {
    log(this._cardWideConfig, `Frigate Card view change: `, args?.view ?? '[default]');
    const changeView = (view: View): void => {
      if (View.isMediaChange(this._view, view)) {
        this._currentMediaLoadedInfo = null;
      }
      if (this._view?.view !== view.view) {
        this._resetMainScroll();
      }
      this._view = view;
      this._generateConditionState();
    };

    if (args?.resetMessage ?? true) {
      this._message = null;
    }

    if (!args?.view) {
      // Load the default view.
      let camera;
      if (this._cameras?.size) {
        if (this._view?.camera && this._getConfig().view.update_cycle_camera) {
          const keys = Array.from(this._cameras.keys());
          const currentIndex = keys.indexOf(this._view.camera);
          const targetIndex = currentIndex + 1 >= keys.length ? 0 : currentIndex + 1;
          camera = keys[targetIndex];
        } else {
          // Reset to the default camera.
          camera = this._cameras.keys().next().value;
        }
      }

      if (camera) {
        changeView(
          new View({
            view: this._getConfig().view.default,
            camera: camera,
          }),
        );

        // Restart the update timer, so the default view is refreshed at a fixed
        // interval from now (if so configured).
        this._startUpdateTimer();
      }
    } else {
      changeView(args.view);
    }
  }

  /**
   * Set the light or dark mode.
   */
  protected _setLightOrDarkMode(): void {
    const needDarkMode =
      this._getConfig().view.dark_mode === 'on' ||
      (this._getConfig().view.dark_mode === 'auto' &&
        (!this._interactionTimerID || this._hass?.themes.darkMode));

    if (needDarkMode) {
      this.setAttribute('dark', '');
    } else {
      this.removeAttribute('dark');
    }
  }

  /**
   * Handle a change view event.
   * @param e The change view event.
   */
  protected _changeViewHandler(e: CustomEvent<View>): void {
    this._changeView({ view: e.detail });
  }

  /**
   * Add view context to the current view.
   * @param ev A ViewContext event.
   */
  protected _addViewContextHandler(ev: CustomEvent<ViewContext>): void {
    this._changeView({
      view: this._view?.clone().mergeInContext(ev.detail),
    });
  }

  /**
   * Called before each update.
   */
  protected willUpdate(changedProps: PropertyValues): void {
    if (
      this._cameras &&
      this._cardWideConfig &&
      (changedProps.has('_config') ||
        changedProps.has('_cameras') ||
        changedProps.has('_cardWideConfig'))
    ) {
      this._cameraManager = new CameraManager(
        new CameraManagerEngineFactory(this._cardWideConfig),
        this._cameras,
        this._cardWideConfig,
      );
    }

    if (changedProps.has('_cardWideConfig')) {
      setPerformanceCSSStyles(this, this._cardWideConfig?.performance);
    }

    if (this._view?.is('live')) {
      import('./components/live/live.js');
    } else if (this._view?.isGalleryView()) {
      import('./components/gallery.js');
    } else if (this._view?.isViewerView()) {
      import('./components/viewer.js');
    } else if (this._view?.is('image')) {
      import('./components/image.js');
    } else if (this._view?.is('timeline')) {
      import('./components/timeline.js');
    }
  }

  /**
   * Get the most recent triggered camera.
   */
  protected _getMostRecentTrigger(): string | null {
    const sorted = [...this._triggers.entries()].sort(
      (a: [string, Date], b: [string, Date]) => b[1].getTime() - a[1].getTime(),
    );
    return sorted.length ? sorted[0][0] : null;
  }

  /**
   * Determine if a camera has been triggered.
   * @param oldHass The old HA object.
   * @returns A boolean indicating whether the camera was changed.
   */
  protected _updateTriggeredCameras(oldHass: HomeAssistant): boolean {
    if (!this._view || !this._isAutomatedViewUpdateAllowed(true)) {
      return false;
    }

    const now = new Date();
    let changedCamera = false;
    let triggerChanges = false;

    for (const [camera, config] of this._cameras?.entries() ?? []) {
      const triggerEntities = config.triggers.entities ?? [];
      const diffs = getHassDifferences(this._hass, oldHass, triggerEntities, {
        stateOnly: true,
      });
      const shouldTrigger = diffs.some((diff) => isTriggeredState(diff.newState));
      const shouldUntrigger = triggerEntities.every(
        (entity) => !isTriggeredState(this._hass?.states[entity]),
      );
      if (shouldTrigger) {
        this._triggers.set(camera, now);
        triggerChanges = true;
      } else if (shouldUntrigger && this._triggers.has(camera)) {
        this._triggers.delete(camera);
        triggerChanges = true;
      }
    }

    if (triggerChanges) {
      if (!this._triggers.size) {
        this._startUntriggerTimer();
      } else {
        const targetCamera = this._getMostRecentTrigger();
        if (
          targetCamera &&
          (this._view.camera !== targetCamera || !this._view.is('live'))
        ) {
          this._changeView({ view: new View({ view: 'live', camera: targetCamera }) });
          changedCamera = true;
        }
      }
    }
    return changedCamera;
  }

  /**
   * Determine if the scan mode is currently triggered.
   * @returns
   */
  protected _isTriggered(): boolean {
    return !!this._triggers.size || !!this._untriggerTimerID;
  }

  /**
   * Untrigger the card.
   */
  protected _untrigger(): void {
    const wasTriggered = this._isTriggered();
    this._triggers.clear();
    this._clearUntriggerTimer();

    if (wasTriggered) {
      this.requestUpdate();
    }
  }

  /**
   * Start the untrigger timer.
   */
  protected _startUntriggerTimer(): void {
    this._clearUntriggerTimer();

    this._untriggerTimerID = window.setTimeout(() => {
      this._untrigger();
      if (
        this._isAutomatedViewUpdateAllowed() &&
        this._getConfig().view.scan.untrigger_reset
      ) {
        this._changeView();
      }
    }, this._getConfig().view.scan.untrigger_seconds * 1000);
  }

  /**
   * Clear the user interaction ('screensaver') timer.
   */
  protected _clearUntriggerTimer(): void {
    if (this._untriggerTimerID) {
      window.clearTimeout(this._untriggerTimerID);
      this._untriggerTimerID = null;
    }
  }

  /**
   * Initialize the card.
   */
  protected async _initialize(): Promise<void> {
    await Promise.all([sideLoadHomeAssistantElements(), loadLanguages()]);
  }
  /**
   * Determine whether the element should be updated.
   * @param changedProps The changed properties if any.
   * @returns `true` if the element should be updated.
   */
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    // Load the relevant languages. Cannot do anything until then.
    if (this._initialized !== 'initialized') {
      if (this._initialized !== 'initializing') {
        this._initialize().then(() => {
          this._initialized = 'initialized';
          this.requestUpdate();
        });
      }
      return false;
    }

    const oldHass = changedProps.get('_hass') as HomeAssistant | undefined;
    let shouldUpdate = !oldHass || changedProps.size != 1;

    // If this is the first HA state and it is disconnected, or there's been a
    // change in connection state, then show the reconnection message.
    if (
      (!oldHass && !this._hass?.connected) ||
      (!!oldHass && oldHass.connected !== !!this._hass?.connected)
    ) {
      if (!this._hass?.connected) {
        this._setMessageAndUpdate(
          {
            message: localize('error.reconnecting'),
            icon: 'mdi:lan-disconnect',
            type: 'connection',
            dotdotdot: true,
          },
          true,
        );
      } else {
        this._changeView();
      }
      return true;
    }

    if (oldHass) {
      const selectedCamera = this._getSelectedCameraConfig();
      if (this._getConfig().view.scan.enabled && this._updateTriggeredCameras(oldHass)) {
        shouldUpdate = true;
      } else if (
        // Home Assistant pumps a lot of updates through. Re-rendering the card is
        // necessary at times (e.g. to update the 'clip' view as new clips
        // arrive), but also is a jarring experience for the user (e.g. if they
        // are browsing the mini-gallery). Do not allow re-rendering from a Home
        // Assistant update if there's been recent interaction (e.g. clicks on the
        // card) or if there is media active playing.
        this._isAutomatedViewUpdateAllowed() &&
        isHassDifferent(this._hass, oldHass, [
          ...(this._getConfig().view.update_entities || []),
          ...(selectedCamera?.triggers.entities || []),
        ])
      ) {
        // If entities being monitored have changed then reset the view to the
        // default. Note that as per the Lit lifecycle, the setting of the view
        // itself will not trigger an *additional* re-render here.
        this._changeView();
        shouldUpdate = true;
      } else {
        shouldUpdate ||= isHassDifferent(
          this._hass,
          oldHass,
          this._getConfig().view.render_entities || [],
        );
      }
    }
    return shouldUpdate;
  }

  /**
   * Download media being displayed in the viewer.
   */
  protected async _downloadViewerMedia(): Promise<void> {
    if (!this._hass || !(this._view?.isViewerView() || this._view?.is('timeline'))) {
      // Should not occur.
      return;
    }
    const media = this._view.queryResults?.getSelectedResult();

    if (!media) {
      this._setMessageAndUpdate({
        message: localize('error.download_no_media'),
        type: 'error',
      });
      return;
    }

    const cameraConfig = this._getSelectedCameraConfig();
    if (!cameraConfig || !cameraConfig.frigate.camera_name) {
      return;
    }

    const path = this._cameraManager?.getMediaDownloadPath(media);
    if (!path) {
      return;
    }

    let response: string | null | undefined;
    try {
      response = await homeAssistantSignPath(this._hass, path);
    } catch (e) {
      errorToConsole(e as Error);
    }

    if (!response) {
      this._setMessageAndUpdate({
        message: localize('error.download_sign_failed'),
        type: 'error',
      });
      return;
    }

    if (
      navigator.userAgent.startsWith('Home Assistant/') ||
      navigator.userAgent.startsWith('HomeAssistant/')
    ) {
      // Home Assistant companion apps cannot download files without opening a
      // new browser window.
      //
      // User-agents are specified here:
      //  - Android: https://github.com/home-assistant/android/blob/master/app/src/main/java/io/homeassistant/companion/android/webview/WebViewActivity.kt#L107
      //  - iOS: https://github.com/home-assistant/iOS/blob/master/Sources/Shared/API/HAAPI.swift#L75
      window.open(response, '_blank');
    } else {
      // Use the HTML5 download attribute to prevent a new window from
      // temporarily opening.
      const link = document.createElement('a');
      link.setAttribute('download', '');
      link.href = response;
      link.click();
      link.remove();
    }
  }

  /**
   * Take a media player action.
   * @param mediaPlayer The entity ID of the media player.
   * @param action The action to take (currently only 'play' is supported).
   * @returns
   */
  protected _mediaPlayerAction(mediaPlayer: string, action: 'play' | 'stop'): void {
    if (
      !['play', 'stop'].includes(action) ||
      !this._view ||
      !this._hass ||
      !this._cameraManager
    ) {
      return;
    }

    let media_content_id: string | null = null;
    let media_content_type: string | null = null;
    let title: string | null = null;
    let thumbnail: string | null = null;

    const cameraConfig = this._getSelectedCameraConfig();
    if (!cameraConfig) {
      return;
    }
    const cameraEntity = cameraConfig.camera_entity ?? null;
    const media = this._view.queryResults?.getSelectedResult();

    if (this._view.isViewerView() && media && this._cameras) {
      media_content_id = media.getContentID();
      media_content_type = media.getContentType();
      title = media.getTitle();
      thumbnail = media.getThumbnail();
    } else if (this._view?.is('live') && cameraEntity) {
      media_content_id = `media-source://camera/${cameraEntity}`;
      media_content_type = 'application/vnd.apple.mpegurl';
      title = this._cameraManager.getCameraMetadata(this._hass, cameraConfig)?.title ?? null;
      thumbnail = this._hass?.states[cameraEntity]?.attributes?.entity_picture ?? null;
    }

    if (!media_content_id || !media_content_type) {
      return;
    }

    if (action === 'play') {
      this._hass?.callService('media_player', 'play_media', {
        entity_id: mediaPlayer,
        media_content_id: media_content_id,
        media_content_type: media_content_type,
        extra: {
          ...(title && { title: title }),
          ...(thumbnail && { thumb: thumbnail }),
        },
      });
    } else if (action === 'stop') {
      this._hass?.callService('media_player', 'media_stop', {
        entity_id: mediaPlayer,
      });
    }
  }

  /**
   * Handle a request for a card action.
   * @param ev The action requested.
   */
  protected _cardActionHandler(ev: CustomEvent<ActionType>): void {
    const frigateCardAction = convertActionToFrigateCardCustomAction(ev.detail);
    if (!frigateCardAction) {
      return;
    }
    const action = frigateCardAction.frigate_card_action;

    switch (action) {
      case 'default':
        this._changeView();
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
        if (this._view) {
          this._changeView({
            view: new View({
              view: action,
              camera: this._view.camera,
            }),
          });
        }
        break;
      case 'download':
        this._downloadViewerMedia();
        break;
      case 'frigate_ui':
        const frigate_url = this._getFrigateURLFromContext();
        if (frigate_url) {
          window.open(frigate_url);
        }
        break;
      case 'fullscreen':
        if (screenfull.isEnabled) {
          screenfull.toggle(this);
        }
        break;
      case 'menu_toggle':
        // This is a rare code path: this would only be used if someone has a
        // menu toggle action configured outside of the menu itself (e.g.
        // picture elements).
        this._refMenu.value?.toggleMenu();
        break;
      case 'camera_select':
        const camera = frigateCardAction.camera;
        if (this._cameras?.has(camera) && this._view) {
          const targetView = View.selectBestViewForUserSpecified(
            this._getConfig().view.camera_select === 'current'
              ? this._view.view
              : (this._getConfig().view.camera_select as FrigateCardView),
          );
          this._changeView({
            view: new View({
              view: this._cameras?.get(camera)?.frigate.camera_name
                ? targetView
                : // Fallback to supported views for non-Frigate cameras.
                  View.selectBestViewForNonFrigateCameras(targetView),
              camera: camera,
            }),
          });
        }
        break;
      case 'media_player':
        this._mediaPlayerAction(
          frigateCardAction.media_player,
          frigateCardAction.media_player_action,
        );
        break;
      case 'diagnostics':
        this._diagnostics();
        break;
      default:
        console.warn(`Frigate card received unknown card action: ${action}`);
    }
  }

  /**
   * Generate diagnostics for issue reports.
   */
  protected async _diagnostics(): Promise<void> {
    if (this._hass) {
      let devices: DeviceList = [];
      try {
        devices = await getAllDevices(this._hass);
      } catch (e) {
        // Pass. This is optional.
      }

      // Get the Frigate devices in order to extract the Frigate integration and
      // server version numbers.
      const frigateDevices = devices.filter(
        (device) => device.manufacturer === 'Frigate',
      );
      const frigateVersionMap: Map<string, string> = new Map();
      frigateDevices.forEach((device) => {
        device.config_entries.forEach((configEntry) => {
          if (device.model) {
            frigateVersionMap.set(configEntry, device.model);
          }
        });
      });

      this._setMessageAndUpdate({
        message: localize('error.diagnostics'),
        type: 'diagnostics',
        icon: 'mdi:information',
        context: {
          ha_version: this._hass.config.version,
          card_version: pkg.version,
          browser: navigator.userAgent,
          date: new Date(),
          frigate_version: Object.fromEntries(frigateVersionMap),
          lang: getLanguage(),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          git: {
            ...(pkg['gitVersion'] && { build_version: pkg['gitVersion'] }),
            ...(pkg['buildDate'] && { build_date: pkg['buildDate'] }),
            ...(pkg['gitDate'] && { commit_date: pkg['gitDate'] }),
          },
          ...(this._rawConfig && { config: this._rawConfig }),
        },
      });
    }
  }

  /**
   * Get the Frigate UI URL from context.
   * @returns The URL or null if unavailable.
   */
  protected _getFrigateURLFromContext(): string | null {
    const cameraConfig = this._getSelectedCameraConfig();
    if (!cameraConfig || !cameraConfig.frigate.url || !this._view) {
      return null;
    }
    if (!cameraConfig.frigate.camera_name) {
      return cameraConfig.frigate.url;
    }
    if (this._view.isViewerView() || this._view.isGalleryView()) {
      return `${cameraConfig.frigate.url}/events?camera=${cameraConfig.frigate.camera_name}`;
    }
    return `${cameraConfig.frigate.url}/cameras/${cameraConfig.frigate.camera_name}`;
  }

  /**
   * Handle an action called on an element.
   * @param ev The actionHandler event.
   */
  protected _actionHandler(ev: CustomEvent, config?: Actions): void {
    const interaction = ev.detail.action;
    const node: HTMLElement | null = ev.currentTarget as HTMLElement | null;
    if (
      config &&
      node &&
      interaction &&
      // Don't call frigateCardHandleAction() unless there is explicitly an
      // action defined (as it uses a default that is unhelpful for views that
      // have default tap/click actions).
      getActionConfigGivenAction(interaction, config)
    ) {
      frigateCardHandleAction(
        node,
        this._hass as HomeAssistant,
        config,
        ev.detail.action,
      );
    }

    // Set the 'screensaver' timer.
    this._startInteractionTimer();
  }

  /**
   * Handle mouse movements.
   */
  protected _mouseHandler(): void {
    this._startInteractionTimer();
  }

  /**
   * Clear the user interaction ('screensaver') timer.
   */
  protected _clearInteractionTimer(): void {
    if (this._interactionTimerID) {
      window.clearTimeout(this._interactionTimerID);
      this._interactionTimerID = null;
    }
  }

  /**
   * Start the user interaction ('screensaver') timer to reset the view to
   * default `view.timeout_seconds` after user interaction.
   */
  protected _startInteractionTimer(): void {
    this._clearInteractionTimer();

    // Interactions reset the trigger state.
    this._untrigger();

    if (this._getConfig().view.timeout_seconds) {
      this._interactionTimerID = window.setTimeout(() => {
        this._clearInteractionTimer();
        if (this._isAutomatedViewUpdateAllowed()) {
          this._changeView();
          this._setLightOrDarkMode();
        }
      }, this._getConfig().view.timeout_seconds * 1000);
    }
    this._setLightOrDarkMode();
  }

  /**
   * Set the update timer to trigger an update refresh every
   * `view.update_seconds`.
   */
  protected _startUpdateTimer(): void {
    if (this._updateTimerID) {
      window.clearTimeout(this._updateTimerID);
      this._updateTimerID = null;
    }
    if (this._getConfig().view.update_seconds) {
      this._updateTimerID = window.setTimeout(() => {
        if (this._isAutomatedViewUpdateAllowed()) {
          this._changeView();
        } else {
          // Not allowed to update this time around, but try again at the next
          // interval.
          this._startUpdateTimer();
        }
      }, this._getConfig().view.update_seconds * 1000);
    }
  }

  /**
   * Determine if an automated view update is allowed.
   * @returns `true` if it's allowed, `false` otherwise.
   */
  protected _isAutomatedViewUpdateAllowed(ignoreTriggers?: boolean): boolean {
    return (
      (ignoreTriggers || !this._isTriggered()) &&
      (this._getConfig().view.update_force || !this._interactionTimerID)
    );
  }

  /**
   * Render the card menu.
   * @returns A rendered template.
   */
  protected _renderMenu(): TemplateResult | void {
    return html`
      <frigate-card-menu
        ${ref(this._refMenu)}
        .hass=${this._hass}
        .menuConfig=${this._getConfig().menu}
        .buttons=${this._getMenuButtons()}
      ></frigate-card-menu>
    `;
  }

  /**
   * Set the message to display and trigger an update.
   * @param message The message to display.
   * @param skipUpdate If true an update request is skipped.
   */
  protected _setMessageAndUpdate(message: Message, skipUpdate?: boolean): void {
    const currentPriority = this._message
      ? MESSAGE_TYPE_PRIORITIES[this._message.type] ?? 0
      : 0;
    const newPriority = MESSAGE_TYPE_PRIORITIES[message.type] ?? 0;

    if (!this._message || newPriority >= currentPriority) {
      this._message = message;

      // When a message is displayed it is effectively unloading the media.
      this._mediaUnloadedHandler();

      if (!skipUpdate) {
        this.requestUpdate();
        this._resetMainScroll();
      }
    }
  }

  /**
   * Reset the scroll of the main pane to the top (example usecase: scrolling
   * half way down the gallery, then viewing diagnostics should result in
   * diagnostics starting at the top).
   */
  protected _resetMainScroll(): void {
    // Reset the scroll on the main div to the top.
    this._refMain.value?.scroll({ top: 0 });
  }

  /**
   * Handle a message event to render to the user.
   * @param e The message event.
   */
  protected _messageHandler(e: CustomEvent<Message>): void {
    return this._setMessageAndUpdate(e.detail);
  }

  /**
   * Handle a new piece of media being shown.
   * @param ev Event with MediaLoadedInfo details for the media.
   */
  protected _mediaLoadedHandler(ev: CustomEvent<MediaLoadedInfo>): void {
    const mediaLoadedInfo = ev.detail;
    // In Safari, with WebRTC, 0x0 is occasionally returned during loading,
    // so treat anything less than a safety cutoff as bogus.
    if (!isValidMediaLoadedInfo(mediaLoadedInfo)) {
      return;
    }

    this._lastValidMediaLoadedInfo = this._currentMediaLoadedInfo = mediaLoadedInfo;

    // An update may be required to draw elements.
    this._generateConditionState();
    this.requestUpdate();
  }

  /**
   * Unload a media item.
   */
  protected _mediaUnloadedHandler(): void {
    this._currentMediaLoadedInfo = null;
    this._generateConditionState();
  }

  /**
   * Handler called when fullscreen is toggled.
   */
  protected _fullscreenHandler(): void {
    this._generateConditionState();
    // Re-render after a change to fullscreen mode to take advantage of
    // the expanded screen real-estate (vs staying in aspect-ratio locked
    // modes).
    this.requestUpdate();
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    if (screenfull.isEnabled) {
      screenfull.on('change', this._fullscreenHandler.bind(this));
    }
    this.addEventListener('mousemove', this._boundMouseHandler);
    this._panel = isCardInPanel(this);
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    // When the dashboard 'tab' is changed, the media is effectively unloaded.
    this._mediaUnloadedHandler();

    if (screenfull.isEnabled) {
      screenfull.off('change', this._fullscreenHandler.bind(this));
    }
    this.removeEventListener('mousemove', this._boundMouseHandler);
    super.disconnectedCallback();
  }

  /**
   * Determine if the card is currently being casted.
   * @returns
   */
  protected _isBeingCasted(): boolean {
    return !!navigator.userAgent.match(/CrKey\//);
  }

  /**
   * Determine if the aspect ratio should be enforced given the current view and
   * context.
   */
  protected _isAspectRatioEnforced(): boolean {
    const aspectRatioMode = this._getConfig().dimensions.aspect_ratio_mode;

    // Do not artifically constrain aspect ratio if:
    // - It's fullscreen.
    // - Aspect ratio enforcement is disabled.
    // - Aspect ratio enforcement is dynamic and it's a media view (i.e. not the
    //   gallery) or timeline.

    return !(
      (screenfull.isEnabled && screenfull.isFullscreen) ||
      aspectRatioMode == 'unconstrained' ||
      (aspectRatioMode == 'dynamic' &&
        (this._view?.isAnyMediaView() || this._view?.is('timeline')))
    );
  }

  /**
   * Get the aspect ratio padding required to enforce the aspect ratio (if it is
   * required).
   * @returns A padding percentage.
   */
  protected _getAspectRatioStyle(): string {
    if (!this._isAspectRatioEnforced()) {
      return 'auto';
    }

    const aspectRatioMode = this._getConfig().dimensions.aspect_ratio_mode;
    if (aspectRatioMode == 'dynamic' && this._lastValidMediaLoadedInfo) {
      return `${this._lastValidMediaLoadedInfo.width} / ${this._lastValidMediaLoadedInfo.height}`;
    }

    const defaultAspectRatio = this._getConfig().dimensions.aspect_ratio;
    if (defaultAspectRatio) {
      return `${defaultAspectRatio[0]} / ${defaultAspectRatio[1]}`;
    } else {
      return '16 / 9';
    }
  }

  /**
   * Merge card-wide and view-specific actions.
   * @returns A combined set of action.
   */
  protected _getMergedActions(): Actions {
    if (this._message || this._view?.is('timeline')) {
      // Timeline does not support actions as it is not possible to prevent
      // touch actions on the timeline surface from triggering card-wide actions
      // inappropriately, whilst also maintaining touch interaction with the
      // timeline itself (and almost the entire timeline surface can be
      // interacted with). This causes duplicate/inappropriate card-wide actions
      // on touch surfaces.
      return {};
    }

    let specificActions: Actions | undefined = undefined;
    if (this._view?.is('live')) {
      specificActions = this._getConfig().live.actions;
    } else if (this._view?.isGalleryView()) {
      specificActions = this._getConfig().event_gallery?.actions;
    } else if (this._view?.isViewerView()) {
      specificActions = this._getConfig().media_viewer.actions;
    } else if (this._view?.is('image')) {
      specificActions = this._getConfig().image?.actions;
    }
    return { ...this._getConfig().view.actions, ...specificActions };
  }

  /**
   * Master render method for the card.
   */
  protected render(): TemplateResult | void {
    if (!this._hass) {
      return;
    }

    const cardStyle = {
      'aspect-ratio': this._getAspectRatioStyle(),
    };
    const cardClasses = {
      triggered:
        !!this._isTriggered() && this._getConfig().view.scan.show_trigger_status,
    };

    const mainClasses = {
      main: true,
      'curve-top':
        this._getConfig().menu.style !== 'outside' ||
        this._getConfig().menu.position !== 'top',
      'curve-bottom':
        this._getConfig().menu.style !== 'outside' ||
        this._getConfig().menu.position === 'top',
    };

    const actions = this._getMergedActions();
    const renderMenuAbove =
      this._getConfig().menu.style === 'outside' &&
      this._getConfig().menu.position === 'top';

    // Caution: Keep the main div and the menu next to one another in order to
    // ensure the hover menu styling continues to work.

    return html` <ha-card
      id="ha-card"
      .actionHandler=${actionHandler({
        hasHold: frigateCardHasAction(actions.hold_action),
        hasDoubleClick: frigateCardHasAction(actions.double_tap_action),
      })}
      class="${classMap(cardClasses)}"
      style="${styleMap(cardStyle)}"
      @action=${(ev: CustomEvent) => this._actionHandler(ev, actions)}
      @ll-custom=${this._cardActionHandler.bind(this)}
      @frigate-card:message=${this._messageHandler.bind(this)}
      @frigate-card:view:change=${this._changeViewHandler.bind(this)}
      @frigate-card:view:change-context=${this._addViewContextHandler.bind(this)}
      @frigate-card:media:loaded=${this._mediaLoadedHandler.bind(this)}
      @frigate-card:media:unloaded=${this._mediaUnloadedHandler.bind(this)}
      @frigate-card:render=${() => this.requestUpdate()}
    >
      ${renderMenuAbove ? this._renderMenu() : ''}
      <div ${ref(this._refMain)} class="${classMap(mainClasses)}">
        ${this._cameras === undefined && !this._message
          ? until(
              (async () => {
                await this._loadCameras();
                // Don't reset messages as errors may have been generated
                // during the camera load.
                this._changeView({ resetMessage: false });
                return this._render();
              })(),
              renderProgressIndicator({ cardWideConfig: this._cardWideConfig }),
            )
          : // Always want to call render even if there's a message, to
            // ensure live preload is always present (even if not displayed).
            this._render()}
        ${
          // Keep message rendering to last to show messages that may have
          // been generated during the render.
          this._message ? renderMessage(this._message) : ''
        }
      </div>
      ${!renderMenuAbove ? this._renderMenu() : ''}
      ${this._getConfig().elements
        ? // Elements need to render after the main views so it can render 'on
          // top'.
          html` <frigate-card-elements
            ${ref(this._refElements)}
            .hass=${this._hass}
            .elements=${this._getConfig().elements}
            .conditionState=${this._conditionState}
            @frigate-card:menu-add=${(e) => {
              this._addDynamicMenuButton(e.detail);
            }}
            @frigate-card:menu-remove=${(e) => {
              this._removeDynamicMenuButton(e.detail);
            }}
            @frigate-card:condition-state-request=${(ev) => {
              conditionStateRequestHandler(ev, this._conditionState);
            }}
          >
          </frigate-card-elements>`
        : ``}
    </ha-card>`;
  }

  /**
   * Sub-render method for the card.
   */
  protected _render(): TemplateResult | void {
    const cameraConfig = this._getSelectedCameraConfig();

    if (!this._hass || !this._view || !cameraConfig || !this._cameras) {
      return html``;
    }

    // Render but hide the live view if there's a message, or if it's preload
    // mode and the view is not live.
    const liveClasses = {
      hidden:
        !!this._message || (this._getConfig().live.preload && !this._view.is('live')),
    };

    return html`
      ${!this._message && this._view.is('image')
        ? html` <frigate-card-image
            ${ref(this._refImage)}
            .imageConfig=${this._getConfig().image}
            .view=${this._view}
            .hass=${this._hass}
            .cameraConfig=${cameraConfig}
          >
          </frigate-card-image>`
        : ``}
      ${!this._message && this._view.isGalleryView()
        ? html` <frigate-card-gallery
            .hass=${this._hass}
            .view=${this._view}
            .cameras=${this._cameras}
            .galleryConfig=${this._getConfig().event_gallery}
            .cameraManager=${this._cameraManager}
            .cardWideConfig=${this._cardWideConfig}
          >
          </frigate-card-gallery>`
        : ``}
      ${!this._message && this._view.isViewerView()
        ? html` <frigate-card-viewer
            .hass=${this._hass}
            .view=${this._view}
            .cameras=${this._cameras}
            .viewerConfig=${this._getConfig().media_viewer}
            .resolvedMediaCache=${this._resolvedMediaCache}
            .cameraManager=${this._cameraManager}
            .cardWideConfig=${this._cardWideConfig}
          >
          </frigate-card-viewer>`
        : ``}
      ${!this._message && this._view.is('timeline')
        ? html` <frigate-card-timeline
            .hass=${this._hass}
            .view=${this._view}
            .cameras=${this._cameras}
            .timelineConfig=${this._getConfig().timeline}
            .cameraManager=${this._cameraManager}
          >
          </frigate-card-timeline>`
        : ``}
      ${
        // Note: Subtle difference in condition below vs the other views in order
        // to always render the live view for live.preload mode.

        // Note: <frigate-card-live> uses the underlying _config rather than the
        // overriden config (via getConfig), as it does it's own overriding as
        // part of the camera carousel.
        this._getConfig().live.preload || (!this._message && this._view.is('live'))
          ? html`
              <frigate-card-live
                ${ref(this._refLive)}
                .hass=${this._hass}
                .view=${this._view}
                .liveConfig=${this._config.live}
                .conditionState=${this._conditionState}
                .liveOverrides=${getOverridesByKey(this._getConfig().overrides, 'live')}
                .cameras=${this._cameras}
                .cameraManager=${this._cameraManager}
                .cardWideConfig=${this._cardWideConfig}
                class="${classMap(liveClasses)}"
              >
              </frigate-card-live>
            `
          : ``
      }
    `;
  }

  /**
   * Return compiled CSS styles (thus safe to use with unsafeCSS).
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(cardStyle);
  }

  /**
   * Get the Lovelace card size.
   * @returns The Lovelace card size in units of 50px.
   */
  public getCardSize(): number {
    if (this._lastValidMediaLoadedInfo) {
      return this._lastValidMediaLoadedInfo.height / 50;
    }
    return 6;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card': FrigateCard;
  }
}
