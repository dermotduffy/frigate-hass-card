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
import { MEDIA_PLAYER_SUPPORT_BROWSE_MEDIA, REPO_URL } from './const.js';
import { getLanguage, loadLanguages, localize } from './localize/localize.js';
import cardStyle from './scss/card.scss';
import {
  Actions,
  ActionType,
  CameraConfig,
  CardWideConfig,
  ExtendedHomeAssistant,
  FRIGATE_CARD_VIEW_DEFAULT,
  FRIGATE_CARD_VIEWS_USER_SPECIFIED,
  FrigateCardConfig,
  frigateCardConfigSchema,
  FrigateCardCustomAction,
  FrigateCardError,
  FrigateCardView,
  MediaLoadedInfo,
  MenuButton,
  MESSAGE_TYPE_PRIORITIES,
  Message,
  RawFrigateCardConfig,
} from './types.js';
import {
  convertActionToFrigateCardCustomAction,
  createFrigateCardCustomAction,
  frigateCardHandleAction,
  frigateCardHasAction,
  getActionConfigGivenAction,
} from './utils/action.js';
import { errorToConsole } from './utils/basic.js';
import {
  getEntityIcon,
  getEntityTitle,
  getHassDifferences,
  isCardInPanel,
  isHassDifferent,
  isTriggeredState,
  sideLoadHomeAssistantElements,
} from './utils/ha';
import { DeviceList, getAllDevices } from './utils/ha/device-registry.js';
import { ResolvedMediaCache } from './utils/ha/resolved-media.js';
import { supportsFeature } from './utils/ha/update.js';
import { isValidMediaLoadedInfo } from './utils/media-info.js';
import { View } from './view/view.js';
import pkg from '../package.json';
import { ViewContext } from 'view';
import { CameraManager } from './camera-manager/manager.js';
import { setLowPerformanceProfile, setPerformanceCSSStyles } from './performance.js';
import { CameraManagerEngineFactory } from './camera-manager/engine-factory.js';
import { log } from './utils/debug.js';
import { EntityRegistryManager } from './utils/ha/entity-registry/index.js';
import { EntityCache } from './utils/ha/entity-registry/cache.js';
import { Entity } from './utils/ha/entity-registry/types.js';
import { getAllDependentCameras } from './utils/camera.js';
import cloneDeep from 'lodash-es/cloneDeep';
import isEqual from 'lodash-es/isEqual';
import merge from 'lodash-es/merge';
import { FrigateCardInitializer } from './utils/initializer.js';
import 'web-dialog';
import { downloadMedia } from './utils/download.js';

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

enum InitializationAspect {
  LANGUAGES = 'languages',
  SIDE_LOAD_ELEMENTS = 'side-load-elements',
  MEDIA_PLAYERS = 'media-players',
  CAMERAS = 'cameras',
}

/**
 * Main FrigateCard class.
 */
@customElement('frigate-card')
class FrigateCard extends LitElement {
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

  @state()
  protected _expand?: boolean = false;

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

  // Error/info message to render.
  protected _message: Message | null = null;

  // A cache of resolved media URLs/mimetypes for use in the whole card.
  protected _resolvedMediaCache = new ResolvedMediaCache();

  protected _cameraManager?: CameraManager;

  protected _entityRegistryManager: EntityRegistryManager;

  // The mouse handler may be called continually, throttle it to at most once
  // per second for performance reasons.
  protected _boundMouseHandler = throttle(this._mouseHandler.bind(this), 1 * 1000);

  protected _triggers: Map<string, Date> = new Map();
  protected _untriggerTimerID: number | null = null;

  protected _conditionManager: CardConditionManager | null = null;

  protected _mediaPlayers?: string[];

  protected _initializer = new FrigateCardInitializer();

  constructor() {
    super();
    this._entityRegistryManager = new EntityRegistryManager(new EntityCache());
  }

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
      expand: this._expand,
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
    if (!isEqual(overriddenConfig, this._overriddenConfig)) {
      if (
        !isEqual(overriddenConfig.cameras, this._overriddenConfig?.cameras) ||
        !isEqual(overriddenConfig.cameras_global, this._overriddenConfig?.cameras_global)
      ) {
        // Uninitialize the cameras (they will be re-initialized on the render
        // cycle triggered by updating the overridden config) below.
        this._initializer.uninitialize(InitializationAspect.CAMERAS);
      }
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

    const visibleCameras = this._cameraManager?.getStore().getVisibleCameras();
    const selectedCameraID = this._view?.camera;
    const selectedCameraConfig = this._getSelectedCameraConfig();
    const allSelectedCameraIDs = getAllDependentCameras(
      this._cameraManager,
      selectedCameraID,
    );
    const selectedMedia = this._view?.queryResults?.getSelectedResult();

    const cameraCapabilities = allSelectedCameraIDs
      ? this._cameraManager?.getAggregateCameraCapabilities(allSelectedCameraIDs)
      : null;
    const mediaCapabilities = selectedMedia
      ? this._cameraManager?.getMediaCapabilities(selectedMedia)
      : null;

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

    if (visibleCameras) {
      const menuItems = Array.from(visibleCameras, ([cameraID, config]) => {
        const action = createFrigateCardCustomAction('camera_select', {
          camera: cameraID,
        });
        const metadata = this._hass
          ? this._cameraManager?.getCameraMetadata(this._hass, cameraID) ?? undefined
          : undefined;

        return {
          enabled: true,
          icon: metadata?.icon,
          entity: config.camera_entity,
          state_color: true,
          title: metadata?.title,
          selected: this._view?.camera === cameraID,
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

    if (selectedCameraID && allSelectedCameraIDs && this._view?.is('live')) {
      const dependencies = [...allSelectedCameraIDs];
      const override = this._view?.context?.live?.overrides?.get(selectedCameraID);

      if (dependencies.length === 2) {
        // If there are only two dependencies (the main camera, and 1 other)
        // then use a button not a menu to toggle.
        buttons.push({
          icon: 'mdi:video-input-component',
          style:
            override && override !== selectedCameraID ? this._getEmphasizedStyle() : {},
          title: localize('config.menu.buttons.substreams'),
          ...this._getConfig().menu.buttons.substreams,
          type: 'custom:frigate-card-menu-icon',
          tap_action: createFrigateCardCustomAction('live_substream_select', {
            camera:
              override === undefined || override === dependencies[0]
                ? dependencies[1]
                : dependencies[0],
          }) as FrigateCardCustomAction,
        });
      } else if (dependencies.length > 2) {
        const menuItems = Array.from(dependencies, (cameraID) => {
          const action = createFrigateCardCustomAction('live_substream_select', {
            camera: cameraID,
          });
          const metadata = this._hass
            ? this._cameraManager?.getCameraMetadata(this._hass, cameraID) ?? undefined
            : undefined;
          const cameraConfig = this._cameraManager?.getStore().getCameraConfig(cameraID);
          return {
            enabled: true,
            icon: metadata?.icon,
            entity: cameraConfig?.camera_entity,
            state_color: true,
            title: metadata?.title,
            selected:
              (this._view?.context?.live?.overrides?.get(selectedCameraID) ??
                selectedCameraID) === cameraID,
            ...(action && { tap_action: action }),
          };
        });

        buttons.push({
          icon: 'mdi:video-input-component',
          title: localize('config.menu.buttons.substreams'),
          style:
            override && override !== selectedCameraID ? this._getEmphasizedStyle() : {},
          ...this._getConfig().menu.buttons.substreams,
          type: 'custom:frigate-card-menu-submenu',
          items: menuItems,
        });
      }
    }

    buttons.push({
      icon: 'mdi:cctv',
      ...this._getConfig().menu.buttons.live,
      type: 'custom:frigate-card-menu-icon',
      title: localize('config.view.views.live'),
      style: this._view?.is('live') ? this._getEmphasizedStyle() : {},
      tap_action: createFrigateCardCustomAction('live') as FrigateCardCustomAction,
    });

    if (cameraCapabilities?.supportsClips) {
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

    if (cameraCapabilities?.supportsSnapshots) {
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

    if (cameraCapabilities?.supportsRecordings) {
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
    if (cameraCapabilities?.supportsTimeline) {
      buttons.push({
        icon: 'mdi:chart-gantt',
        ...this._getConfig().menu.buttons.timeline,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.view.views.timeline'),
        style: this._view?.is('timeline') ? this._getEmphasizedStyle() : {},
        tap_action: createFrigateCardCustomAction('timeline') as FrigateCardCustomAction,
      });
    }

    if (mediaCapabilities?.canDownload && !this._isBeingCasted()) {
      buttons.push({
        icon: 'mdi:download',
        ...this._getConfig().menu.buttons.download,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.download'),
        tap_action: createFrigateCardCustomAction('download') as FrigateCardCustomAction,
      });
    }

    if (this._getCameraURLFromContext()) {
      buttons.push({
        icon: 'mdi:web',
        ...this._getConfig().menu.buttons.camera_ui,
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.camera_ui'),
        tap_action: createFrigateCardCustomAction(
          'camera_ui',
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

    buttons.push({
      icon: this._expand ? 'mdi:arrow-collapse-all' : 'mdi:arrow-expand-all',
      ...this._getConfig().menu.buttons.expand,
      type: 'custom:frigate-card-menu-icon',
      title: localize('config.menu.buttons.expand'),
      tap_action: createFrigateCardCustomAction(
        'expand_toggle',
      ) as FrigateCardCustomAction,
      style: this._expand ? this._getEmphasizedStyle() : {},
    });

    if (
      this._mediaPlayers?.length &&
      (this._view?.isViewerView() ||
        (this._view?.is('live') && selectedCameraConfig?.camera_entity))
    ) {
      const mediaPlayerItems = this._mediaPlayers.map((playerEntityID) => {
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
   * Get the camera configuration for the selected camera.
   * @returns The CameraConfig object or null if not found.
   */
  protected _getSelectedCameraConfig(): CameraConfig | null {
    if (!this._view || !this._cameraManager) {
      return null;
    }
    return this._cameraManager.getStore().getCameraConfig(this._view.camera);
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
    this._cameraManager = undefined;
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
      if (View.isMajorMediaChange(this._view, view)) {
        this._currentMediaLoadedInfo = null;
      }
      if (this._view?.view !== view.view) {
        this._resetMainScroll();
      }

      // Special case: If the user is currently using the viewer, and then
      // switches to the gallery (no matter how), make an attempt to keep the
      // query/queryResults the same so the gallery can be used to click bath
      // and forth to the viewer, and the selected media can be centered in the
      // gallery. See the matching code in `updated()` in `gallery.ts`.
      // See: https://github.com/dermotduffy/frigate-hass-card/issues/885
      if (
        this._view?.isViewerView() &&
        view.isGalleryView() &&
        (!view.query || !view.queryResults)
      ) {
        if (this._view?.query) {
          view.query = this._view.query;
        }
        if (this._view?.queryResults) {
          view.queryResults = this._view.queryResults;
        }
      }

      this._view = view;
      this._generateConditionState();
    };

    if (args?.resetMessage ?? true) {
      this._message = null;
    }

    if (!args?.view) {
      // Load the default view.
      let cameraID: string | null = null;
      if (this._cameraManager) {
        const cameras = this._cameraManager.getStore().getVisibleCameras();
        if (cameras) {
          if (this._view?.camera && this._getConfig().view.update_cycle_camera) {
            const keys = Array.from(cameras.keys());
            const currentIndex = keys.indexOf(this._view.camera);
            const targetIndex = currentIndex + 1 >= keys.length ? 0 : currentIndex + 1;
            cameraID = keys[targetIndex];
          } else {
            // Reset to the default camera.
            cameraID = cameras.keys().next().value;
          }
        }
      }

      if (cameraID) {
        changeView(
          new View({
            view: this._getConfig().view.default,
            camera: cameraID,
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
    if (changedProps.has('_cardWideConfig')) {
      setPerformanceCSSStyles(this, this._cardWideConfig?.performance);
    }

    this._initializeBackground();

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

    if (changedProps.has('_view')) {
      this._setPropertiesForExpandedMode();
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

    const cameras = this._cameraManager?.getStore().getVisibleCameras();
    for (const [cameraID, config] of cameras?.entries() ?? []) {
      const triggerEntities = config.triggers.entities ?? [];
      const diffs = getHassDifferences(this._hass, oldHass, triggerEntities, {
        stateOnly: true,
      });
      const shouldTrigger = diffs.some((diff) => isTriggeredState(diff.newState));
      const shouldUntrigger = triggerEntities.every(
        (entity) => !isTriggeredState(this._hass?.states[entity]),
      );
      if (shouldTrigger) {
        this._triggers.set(cameraID, now);
        triggerChanges = true;
      } else if (shouldUntrigger && this._triggers.has(cameraID)) {
        this._triggers.delete(cameraID);
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

  protected _handleThrownError(error: unknown) {
    if (error instanceof Error) {
      errorToConsole(error);
    }
    if (error instanceof FrigateCardError) {
      this._setMessageAndUpdate({
        message: error.message,
        type: 'error',
        context: error.context,
      });
    }
  }

  protected async _initializeCameras(
    hass: HomeAssistant,
    config: FrigateCardConfig,
    cardWideConfig: CardWideConfig,
  ): Promise<void> {
    this._cameraManager = new CameraManager(
      new CameraManagerEngineFactory(this._entityRegistryManager, cardWideConfig),
      this._cardWideConfig,
    );

    // For each camera merge the config (which has no defaults) into the camera
    // global config (which does have defaults). The merging must happen in this
    // order, to ensure that the defaults in the cameras global config do not
    // override the values specified in the per-camera config.
    const cameras = config.cameras.map((camera) =>
      merge(cloneDeep(config.cameras_global), camera),
    );

    try {
      await this._cameraManager.initializeCameras(
        hass,
        this._entityRegistryManager,
        cameras,
      );
    } catch (e: unknown) {
      this._handleThrownError(e);
    }

    // If there's no view set yet, set one. This will be the case on initial camera load.
    if (!this._view) {
      // Don't reset the message which may be set to an error above. This sets the
      // first view using the newly loaded cameras.
      this._changeView({ resetMessage: false });
    }
  }

  protected async _initializeMediaPlayers(hass: HomeAssistant): Promise<void> {
    const isValidMediaPlayer = (entityID: string): boolean => {
      if (entityID.startsWith('media_player.')) {
        const stateObj = this._hass?.states[entityID];
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
    let mediaPlayerEntities: Map<string, Entity>;
    try {
      mediaPlayerEntities = await this._entityRegistryManager.getEntities(
        hass,
        mediaPlayers,
      );
    } catch (e) {
      // Failing to fetch media player information is not considered
      // sufficiently serious to block card startup.
      errorToConsole(e as Error);
      return;
    }

    // Filter out entities that are marked as hidden (this information is not
    // available in the HA state, only in the registry).
    this._mediaPlayers = [...mediaPlayerEntities.values()]
      .filter((entity) => !entity.hidden_by)
      .map((entity) => entity.entity_id);
  }

  /**
   * Initialize the hard requirements for rendering anything.
   * @returns `true` if card rendering can continue.
   */
  protected _initializeMandatory(): boolean {
    if (
      this._initializer.isInitializedMultiple([
        InitializationAspect.LANGUAGES,
        InitializationAspect.SIDE_LOAD_ELEMENTS,
        InitializationAspect.CAMERAS,
      ])
    ) {
      return true;
    }

    const hass = this._hass;
    const config = this._getConfig();
    const cardWideConfig = this._cardWideConfig;
    if (!hass || !config || !cardWideConfig) {
      return false;
    }

    this._initializer
      .initializeMultipleIfNecessary({
        // Caution: Ensure nothing in this set of initializers requires
        // languages since they will not yet have been initialized.
        [InitializationAspect.LANGUAGES]: async () => loadLanguages(hass),
        [InitializationAspect.SIDE_LOAD_ELEMENTS]: async () =>
          sideLoadHomeAssistantElements,
      })
      .then(() => {
        return this._initializer.initializeIfNecessary(
          InitializationAspect.CAMERAS,
          async () => this._initializeCameras(hass, config, cardWideConfig),
        );
      })
      .then((initialized) => {
        if (initialized) {
          return this.requestUpdate();
        }
      });
    return false;
  }

  /**
   * Initialize aspects of the card that can load in the 'background'.
   * @returns `true` if card rendering can continue.
   */
  protected _initializeBackground(): void {
    if (this._initializer.isInitialized(InitializationAspect.MEDIA_PLAYERS)) {
      return;
    }
    const hass = this._hass;
    const config = this._getConfig();
    if (!hass || !config) {
      return;
    }

    this._initializer
      .initializeMultipleIfNecessary({
        ...(config.menu.buttons.media_player.enabled && {
          [InitializationAspect.MEDIA_PLAYERS]: async () =>
            this._initializeMediaPlayers(hass),
        }),
      })
      .then((initialized) => {
        if (initialized) {
          this.requestUpdate();
        }
      });
    return;
  }

  /**
   * Determine whether the element should be updated.
   * @param changedProps The changed properties if any.
   * @returns `true` if the element should be updated.
   */
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this._initializeMandatory()) {
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
        shouldUpdate ||= isHassDifferent(this._hass, oldHass, [
          ...(this._getConfig().view.render_entities ?? []),

          // Refresh the card if media player state changes:
          // https://github.com/dermotduffy/frigate-hass-card/issues/881
          ...(this._mediaPlayers ?? []),
        ]);
      }
    }
    return shouldUpdate;
  }

  /**
   * Download media being displayed in the viewer.
   */
  protected async _downloadViewerMedia(): Promise<void> {
    const media = this._view?.queryResults?.getSelectedResult();
    if (!this._hass || !this._cameraManager || !media) {
      return;
    }

    try {
      await downloadMedia(this._hass, this._cameraManager, media);
    } catch (error) {
      this._handleThrownError(error);
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

    if (this._view.isViewerView() && media) {
      media_content_id = media.getContentID();
      media_content_type = media.getContentType();
      title = media.getTitle();
      thumbnail = media.getThumbnail();
    } else if (this._view?.is('live') && cameraEntity) {
      media_content_id = `media-source://camera/${cameraEntity}`;
      media_content_type = 'application/vnd.apple.mpegurl';
      title =
        this._cameraManager.getCameraMetadata(this._hass, this._view.camera)?.title ??
        null;
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
    if (!this._view || !frigateCardAction) {
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
        this._changeView({
          view: new View({
            view: action,
            camera: this._view.camera,
          }),
        });
        break;
      case 'download':
        this._downloadViewerMedia();
        break;
      case 'camera_ui':
        const url = this._getCameraURLFromContext();
        if (url) {
          window.open(url);
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
        const selectCameraID = frigateCardAction.camera;
        if (
          this._view &&
          this._cameraManager?.getStore().hasVisibleCameraID(selectCameraID)
        ) {
          const viewOnCameraSelect = this._getConfig().view.camera_select;
          const targetView =
            viewOnCameraSelect === 'current' ? this._view.view : viewOnCameraSelect;
          const actualView = this.isViewSupportedByCamera(selectCameraID, targetView)
            ? targetView
            : FRIGATE_CARD_VIEW_DEFAULT;
          this._changeView({
            view: new View({ view: actualView, camera: selectCameraID }),
          });
        }
        break;
      case 'live_substream_select':
        const overrides: Map<string, string> =
          this._view.context?.live?.overrides ?? new Map();
        overrides.set(this._view.camera, frigateCardAction.camera);
        this._changeView({
          view: this._view.clone().mergeInContext({
            live: { overrides: overrides },
          }),
        });
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
      case 'expand_toggle':
        this._setExpand(!this._expand);
        break;
      default:
        console.warn(`Frigate card received unknown card action: ${action}`);
    }
  }

  public isViewSupportedByCamera(cameraID: string, view: FrigateCardView): boolean {
    const capabilities = this._cameraManager?.getCameraCapabilities(cameraID);
    switch (view) {
      case 'live':
      case 'image':
        return true;
      case 'clip':
      case 'clips':
        return !!capabilities?.supportsClips;
      case 'snapshot':
      case 'snapshots':
        return !!capabilities?.supportsSnapshots;
      case 'recording':
      case 'recordings':
        return !!capabilities?.supportsRecordings;
      case 'timeline':
        return !!capabilities?.supportsTimeline;
      case 'media':
        return (
          !!capabilities?.supportsClips ||
          !!capabilities?.supportsSnapshots ||
          !!capabilities?.supportsRecordings
        );
    }
    return false;
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
  protected _getCameraURLFromContext(): string | null {
    if (!this._view) {
      return null;
    }

    const selectedCameraID = this._view.camera;
    const media = this._view.queryResults?.getSelectedResult() ?? null;
    const endpoints =
      this._cameraManager?.getCameraEndpoints(selectedCameraID, {
        view: this._view.view,
        ...(media && { media: media }),
      }) ?? null;
    return endpoints?.ui?.endpoint ?? null;
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
        .entityRegistryManager=${this._entityRegistryManager}
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

    log(this._cardWideConfig, `Frigate Card media load: `, mediaLoadedInfo);

    this._lastValidMediaLoadedInfo = this._currentMediaLoadedInfo = mediaLoadedInfo;

    this._setPropertiesForExpandedMode();

    // An update may be required to draw elements.
    this._generateConditionState();
    this.requestUpdate();
  }

  protected _setPropertiesForExpandedMode(): void {
    // When a new media loads, set the aspect ratio for when the card is
    // expanded/popped-up. This is based exclusively on last media content,
    // as dimension configuration does not apply in fullscreen or expanded mode.
    this.style.setProperty(
      '--frigate-card-expand-aspect-ratio',
      this._view?.isAnyMediaView() && this._lastValidMediaLoadedInfo
        ? `${this._lastValidMediaLoadedInfo.width} / ${this._lastValidMediaLoadedInfo.height}`
        : 'unset',
    );
    // Non-media mays have no intrinsic dimensions and so we need to explicit
    // request the dialog to use all available space.
    this.style.setProperty(
      '--frigate-card-expand-width',
      this._view?.isAnyMediaView() ? 'none' : 'var(--frigate-card-expand-max-width)',
    );
    this.style.setProperty(
      '--frigate-card-expand-height',
      this._view?.isAnyMediaView() ? 'none' : 'var(--frigate-card-expand-max-height)',
    );
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
    // - It's in expanded mode.
    // - Aspect ratio enforcement is disabled.
    // - Aspect ratio enforcement is dynamic and it's a media view (i.e. not the
    //   gallery) or timeline.

    return !(
      (screenfull.isEnabled && screenfull.isFullscreen) ||
      this._expand ||
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
    // In expanded mode we must always set the aspect ratio since there are no
    // constraints on the size.

    if (!this._isAspectRatioEnforced()) {
      return 'auto';
    }

    const aspectRatioMode = this._getConfig().dimensions.aspect_ratio_mode;

    if (this._lastValidMediaLoadedInfo && aspectRatioMode === 'dynamic') {
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
      specificActions = this._getConfig().media_gallery?.actions;
    } else if (this._view?.isViewerView()) {
      specificActions = this._getConfig().media_viewer.actions;
    } else if (this._view?.is('image')) {
      specificActions = this._getConfig().image?.actions;
    }
    return { ...this._getConfig().view.actions, ...specificActions };
  }

  protected _setExpand(expand: boolean): void {
    this._expand = expand;
    this._generateConditionState();
  }

  protected _renderInDialogIfNecessary(contents: TemplateResult): TemplateResult | void {
    if (this._expand) {
      return html` <web-dialog
        open
        center
        @close=${() => {
          this._setExpand(false);
        }}
      >
        ${contents}
      </web-dialog>`;
    } else {
      return contents;
    }
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
    return this._renderInDialogIfNecessary(html` <ha-card
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
        ${!this._cameraManager?.isInitialized() && !this._message
          ? renderProgressIndicator({ cardWideConfig: this._cardWideConfig })
          : // Always want to call render even if there's a message, to
            // ensure live preload is always present (even if not displayed).
            this._render()}
        ${
          // Keep message rendering to last to show messages that may have been
          // generated during the render.
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
    </ha-card>`);
  }

  /**
   * Sub-render method for the card.
   */
  protected _render(): TemplateResult | void {
    const cameraConfig = this._getSelectedCameraConfig();

    if (!this._hass || !this._view || !cameraConfig) {
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
            .galleryConfig=${this._getConfig().media_gallery}
            .cameraManager=${this._cameraManager}
            .cardWideConfig=${this._cardWideConfig}
          >
          </frigate-card-gallery>`
        : ``}
      ${!this._message && this._view.isViewerView()
        ? html` <frigate-card-viewer
            .hass=${this._hass}
            .view=${this._view}
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
            .timelineConfig=${this._getConfig().timeline}
            .cameraManager=${this._cameraManager}
            .cardWideConfig=${this._cardWideConfig}
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
