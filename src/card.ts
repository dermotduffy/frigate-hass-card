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
import { styleMap } from 'lit/directives/style-map.js';
import cloneDeep from 'lodash-es/cloneDeep';
import isEqual from 'lodash-es/isEqual';
import merge from 'lodash-es/merge';
import throttle from 'lodash-es/throttle';
import screenfull from 'screenfull';
import { ViewContext } from 'view';
import 'web-dialog';
import pkg from '../package.json';
import { actionHandler } from './action-handler-directive.js';
import { AutomationsController } from './automations';
import { CameraManagerEngineFactory } from './camera-manager/engine-factory.js';
import { CameraManager } from './camera-manager/manager.js';
import './components/elements.js';
import { FrigateCardElements } from './components/elements.js';
import './components/menu.js';
import { FrigateCardMenu } from './components/menu.js';
import './components/message.js';
import { renderMessage, renderProgressIndicator } from './components/message.js';
import './components/thumbnail-carousel.js';
import './components/views.js';
import { FrigateCardViews } from './components/views.js';
import {
  ConditionController,
  ConditionEvaluateRequestEvent,
  getOverriddenConfig,
} from './conditions.js';
import { isConfigUpgradeable } from './config-mgmt.js';
import { MEDIA_PLAYER_SUPPORT_BROWSE_MEDIA, REPO_URL } from './const.js';
import { getLanguage, loadLanguages, localize } from './localize/localize.js';
import { setLowPerformanceProfile, setPerformanceCSSStyles } from './performance.js';
import cardStyle from './scss/card.scss';
import {
  Actions,
  ActionsConfig,
  CameraConfig,
  CardWideConfig,
  ExtendedHomeAssistant,
  FrigateCardConfig,
  frigateCardConfigSchema,
  FrigateCardCustomAction,
  FrigateCardError,
  FrigateCardView,
  FRIGATE_CARD_VIEW_DEFAULT,
  MediaLoadedInfo,
  MenuButton,
  Message,
  MESSAGE_TYPE_PRIORITIES,
  RawFrigateCardConfig,
} from './types.js';
import {
  convertActionToFrigateCardCustomAction,
  frigateCardHandleActionConfig,
  frigateCardHasAction,
  getActionConfigGivenAction,
  isViewAction,
} from './utils/action.js';
import { errorToConsole } from './utils/basic.js';
import { log } from './utils/debug.js';
import { downloadMedia, downloadURL } from './utils/download.js';
import {
  getHassDifferences,
  isCardInPanel,
  isHassDifferent,
  isTriggeredState,
  sideLoadHomeAssistantElements,
} from './utils/ha';
import { DeviceList, getAllDevices } from './utils/ha/device-registry.js';
import { EntityCache } from './utils/ha/entity-registry/cache.js';
import { EntityRegistryManager } from './utils/ha/entity-registry/index.js';
import { Entity } from './utils/ha/entity-registry/types.js';
import { ResolvedMediaCache } from './utils/ha/resolved-media.js';
import { supportsFeature } from './utils/ha/update.js';
import { FrigateCardInitializer } from './utils/initializer.js';
import { MediaLoadedInfoController } from './utils/media-info-controller';
import { isValidMediaLoadedInfo } from './utils/media-info.js';
import { MenuButtonController } from './utils/menu-controller';
import { MicrophoneController } from './utils/microphone';
import { getActionsFromQueryString } from './utils/querystring.js';
import { generateScreenshotTitle } from './utils/screenshot';
import {
  createViewWithNextStream,
  createViewWithoutSubstream,
  createViewWithSelectedSubstream,
} from './utils/substream';
import { Timer } from './utils/timer';
import { getParseErrorPaths } from './utils/zod.js';
import { View } from './view/view.js';

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
 * The card supports actions being configured in a number of places (e.g. tap on
 * an element, double_tap on a menu item, hold on the live view). These actions
 * are handled by frigateCardHandleActionConfig(). For Frigate-card specific
 * actions, the frigateCardHandleActionConfig() call will result in an ll-custom
 * DOM event being fired, which needs to be caught at the card level to handle.
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
  MICROPHONE = 'microphone',
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
  protected _expand = false;

  protected _microphoneController?: MicrophoneController;
  protected _conditionController?: ConditionController;
  protected _automationsController?: AutomationsController;
  protected _menuButtonController = new MenuButtonController();
  protected _mediaLoadedInfoController = new MediaLoadedInfoController();

  protected _refMenu: Ref<FrigateCardMenu> = createRef();
  protected _refMain: Ref<HTMLElement> = createRef();
  protected _refElements: Ref<FrigateCardElements> = createRef();
  protected _refViews: Ref<FrigateCardViews> = createRef();

  protected _interactionTimer = new Timer();
  protected _updateTimer = new Timer();
  protected _untriggerTimer = new Timer();

  // Error/info message to render.
  protected _message: Message | null = null;

  // A cache of resolved media URLs/mimetypes for use in the whole card.
  protected _resolvedMediaCache = new ResolvedMediaCache();

  protected _cameraManager?: CameraManager;

  protected _entityRegistryManager: EntityRegistryManager;

  // The mouse handler may be called continually, throttle it to at most once
  // per second for performance reasons.
  protected _boundMouseHandler = throttle(this._mouseHandler.bind(this), 1 * 1000);
  protected _boundCardActionEventHandler = this._cardActionEventHandler.bind(this);
  protected _boundFullscreenHandler = this._fullscreenHandler.bind(this);

  protected _triggers: Map<string, Date> = new Map();

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
      if (this._refViews.value) {
        this._refViews.value.hass = this._hass;
      }
    }

    if (this._conditionController?.hasHAStateConditions) {
      this._conditionController.setState({ state: this._hass.states });
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

  protected _requestUpdateForComponentsThatUseConditions(): void {
    // Update the components that need to know about condition changes. Trigger
    // updates directly on them to them to avoid the performance hit of a entire
    // card re-render (esp. when using card-mod).
    // https://github.com/dermotduffy/frigate-hass-card/issues/678
    if (this._refViews.value) {
      this._refViews.value.conditionControllerEpoch =
        this._conditionController?.getEpoch();
    }
    if (this._refElements.value) {
      this._refElements.value.conditionControllerEpoch =
        this._conditionController?.getEpoch();
    }
  }

  protected _overrideConfig(): void {
    if (!this._conditionController) {
      return;
    }

    const overriddenConfig = getOverriddenConfig(
      this._conditionController,
      this._config,
      this._config.overrides,
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
      const hint = getParseErrorPaths(parseResult.error);
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

    this._setupConditionController();

    this._automationsController = new AutomationsController(this._config.automations);
    this._setLightOrDarkMode();
    this._setPropertiesForMinMaxHeight();
    this._untrigger();
  }

  protected _setupConditionController(): void {
    this._conditionController?.destroy();
    this._conditionController = new ConditionController(this._config);
    this._conditionController.addStateListener(this._overrideConfig.bind(this));
    this._conditionController.addStateListener(
      this._requestUpdateForComponentsThatUseConditions.bind(this),
    );
    this._conditionController.addStateListener(this._executeAutomations.bind(this));

    this._conditionController.setState({
      view: undefined,
      fullscreen: this._isInFullscreen(),
      expand: this._expand,
      camera: undefined,
      ...(this._hass &&
        this._conditionController?.hasHAStateConditions && {
          state: this._hass.states,
        }),
      media_loaded: this._mediaLoadedInfoController.has(),
    });
  }

  protected _executeAutomations(): void {
    // Never execute automations if there's an error (as our automation loop
    // avoidance -- which shows as an error -- does not work).
    if (this._message?.type !== 'error' && this._hass && this._conditionController) {
      try {
        this._automationsController?.execute(
          this,
          this._hass,
          this._conditionController,
        );
      } catch (e: unknown) {
        this._handleThrownError(e);
      }
    }
  }

  /**
   * Card the card config, prioritizing the overriden config if present.
   * @returns A FrigateCardConfig.
   */
  protected _getConfig(): FrigateCardConfig {
    return this._overriddenConfig || this._config;
  }

  protected _changeView(args?: {
    view?: View;
    viewName?: FrigateCardView;
    cameraID?: string;
    resetMessage?: boolean;
  }): void {
    log(
      this._cardWideConfig,
      `Frigate Card view change: `,
      args?.view ?? args?.viewName ?? '[default]',
    );
    const changeView = (view: View): void => {
      if (View.isMajorMediaChange(this._view, view)) {
        this._mediaLoadedInfoController.clear();
      }
      if (this._view?.view !== view.view) {
        this._resetMainScroll();
      }

      View.adoptFromViewIfAppropriate(view, this._view);

      this._view = view;
      this._conditionController?.setState({
        view: this._view.view,
        camera: this._view.camera,
      });
    };

    if (args?.resetMessage ?? true) {
      this._message = null;
    }

    if (!args?.view) {
      let cameraID: string | null = null;
      if (this._cameraManager) {
        const cameras = this._cameraManager.getStore().getVisibleCameras();
        if (cameras) {
          if (args?.cameraID && cameras.has(args.cameraID)) {
            cameraID = args.cameraID;
          } else if (this._view?.camera && this._getConfig().view.update_cycle_camera) {
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
            view: args?.viewName ?? this._getConfig().view.default,
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
        (!this._interactionTimer.isRunning() || this._hass?.themes.darkMode));

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

    if (changedProps.has('_view')) {
      this._setPropertiesForExpandedMode();
    }

    const oldConfig: FrigateCardConfig | undefined =
      changedProps.get('_overriddenConfig') ?? changedProps.get('_config');
    const newConfig = this._getConfig();
    if (
      (!this._microphoneController ||
        changedProps.has('_overriddenConfig') ||
        changedProps.has('_config')) &&
      oldConfig?.live.microphone.disconnect_seconds !==
        newConfig.live.microphone.disconnect_seconds
    ) {
      const config = this._getConfig();
      this._microphoneController = new MicrophoneController(
        config.live.microphone.always_connected
          ? undefined
          : config.live.microphone.disconnect_seconds,
      );
    }

    // Must be called after the microphoneController is created.
    this._initializeBackground();
  }

  protected _setPropertiesForMinMaxHeight(): void {
    this.style.setProperty(
      '--frigate-card-max-height',
      this._getConfig().dimensions.max_height,
    );

    this.style.setProperty(
      '--frigate-card-min-height',
      this._getConfig().dimensions.min_height,
    );
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
    return !!this._triggers.size || this._untriggerTimer.isRunning();
  }

  /**
   * Untrigger the card.
   */
  protected _untrigger(): void {
    const wasTriggered = this._isTriggered();
    this._triggers.clear();
    this._untriggerTimer.stop();

    if (wasTriggered) {
      this.requestUpdate();
    }
  }

  /**
   * Start the untrigger timer.
   */
  protected _startUntriggerTimer(): void {
    this._untriggerTimer.start(this._getConfig().view.scan.untrigger_seconds, () => {
      this._untrigger();
      if (
        this._isAutomatedViewUpdateAllowed() &&
        this._getConfig().view.scan.untrigger_reset
      ) {
        this._changeView();
      }
    });
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
      new CameraManagerEngineFactory(
        this._entityRegistryManager,
        this._resolvedMediaCache,
        cardWideConfig,
      ),
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

    // Set a view on initial load. However, if the query string contains an
    // action that needs to render content (e.g. a view action or diagnostics),
    // we don't set any view here and allow that content to be triggered by the
    // firstUpdated() call. To do otherwise may cause a race condition between
    // the default view and the querystring view, see:
    // https://github.com/dermotduffy/frigate-hass-card/issues/1200
    if (!this._view) {
      const querystringActions = getActionsFromQueryString();
      if (
        !querystringActions.find(
          (action) =>
            isViewAction(action) || action.frigate_card_action === 'diagnostics',
        )
      ) {
        this._changeView({
          // Don't reset the message which may be set to an error above. This sets the
          // first view using the newly loaded cameras.
          resetMessage: false,
        });
      }
    }
  }

  protected async _initializeMicrophone(): Promise<void> {
    await this._microphoneController?.connect();
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
    this._mediaPlayers = mediaPlayers.filter((entityID) => {
      // Specifically allow for media players that are not found in the entity registry:
      // See: https://github.com/dermotduffy/frigate-hass-card/issues/1016
      const entity = mediaPlayerEntities.get(entityID);
      return !entity || !entity.hidden_by;
    });
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
        [InitializationAspect.LANGUAGES]: async () => await loadLanguages(hass),
        [InitializationAspect.SIDE_LOAD_ELEMENTS]: async () =>
          await sideLoadHomeAssistantElements(),
      })
      .then((initialized) => {
        if (!initialized) {
          return false;
        }
        return this._initializer.initializeIfNecessary(
          InitializationAspect.CAMERAS,
          async () => await this._initializeCameras(hass, config, cardWideConfig),
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
    const hass = this._hass;
    const config = this._getConfig();
    if (!hass || !config) {
      return;
    }

    if (
      this._initializer.isInitializedMultiple([
        ...(config.menu.buttons.media_player.enabled
          ? [InitializationAspect.MEDIA_PLAYERS]
          : []),
        ...(config.live.microphone.always_connected
          ? [InitializationAspect.MICROPHONE]
          : []),
      ])
    ) {
      return;
    }

    this._initializer
      .initializeMultipleIfNecessary({
        ...(config.menu.buttons.media_player.enabled && {
          [InitializationAspect.MEDIA_PLAYERS]: async () =>
            await this._initializeMediaPlayers(hass),
        }),
        ...(config.live.microphone.always_connected && {
          [InitializationAspect.MICROPHONE]: async () =>
            await this._initializeMicrophone(),
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

  protected _cardActionEventHandler(ev: Event): void {
    // The event may not actually be a CustomEvent object, but may still have a
    // detail field (see:
    // https://github.com/custom-cards/custom-card-helpers/blob/master/src/fire-event.ts#L70
    // )
    if ('detail' in ev) {
      const frigateCardAction = convertActionToFrigateCardCustomAction(ev.detail);
      if (frigateCardAction) {
        this._cardActionHandler(frigateCardAction);
      }
    }
  }

  protected _cardActionHandler(frigateCardAction: FrigateCardCustomAction): void {
    // Note: This function needs to process (view-related) commands even when
    // _view has not yet been initialized (since it may be used to set a view
    // via the querystring).
    if (!this._cameraManager) {
      return;
    }

    if (
      frigateCardAction.card_id &&
      this._getConfig().card_id !== frigateCardAction.card_id
    ) {
      // Command not intended for this card (e.g. query string command).
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
          viewName: action,
          cameraID: this._view?.camera,
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
      case 'expand':
        this._setExpand(!this._expand);
        break;
      case 'fullscreen':
        screenfull.toggle(this);
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
      case 'live_substream_select': {
        if (this._view) {
          const view = createViewWithSelectedSubstream(
            this._view,
            frigateCardAction.camera,
          );
          view && this._changeView({ view: view });
        }
        break;
      }
      case 'live_substream_off': {
        if (this._view) {
          const view = createViewWithoutSubstream(this._view);
          view && this._changeView({ view: view });
        }
        break;
      }
      case 'live_substream_on': {
        if (this._view) {
          const view = createViewWithNextStream(this._cameraManager, this._view);
          view && this._changeView({ view: view });
        }
        break;
      }
      case 'media_player':
        this._mediaPlayerAction(
          frigateCardAction.media_player,
          frigateCardAction.media_player_action,
        );
        break;
      case 'diagnostics':
        this._diagnostics();
        break;
      case 'microphone_mute':
        this._microphoneController?.mute();
        this.requestUpdate();
        break;
      case 'microphone_unmute':
        if (
          !this._microphoneController?.isConnected() &&
          !this._microphoneController?.isForbidden()
        ) {
          // The connect() call is async and make take an arbitrary amount of
          // time for the user to grant access to their microphone. With a
          // momentary microphone button the mute call (on mouse release) may
          // arrive before the connection is even granted, so we unmute first
          // before the connection is made, so the mute call on release will not
          // be 'overwritten' incorrectly.
          this._microphoneController?.unmute();

          // Must requestUpdate to show the correct microphone state in the
          // menu.
          this._initializeMicrophone().then(() => this.requestUpdate());
        } else if (this._microphoneController?.isConnected()) {
          this._microphoneController.unmute();
          this.requestUpdate();
        }
        break;
      case 'mute':
        this._mediaLoadedInfoController.get()?.player?.mute();
        break;
      case 'unmute':
        this._mediaLoadedInfoController.get()?.player?.unmute();
        break;
      case 'play':
        this._mediaLoadedInfoController.get()?.player?.play();
        break;
      case 'pause':
        this._mediaLoadedInfoController.get()?.player?.pause();
        break;
      case 'screenshot':
        this._mediaLoadedInfoController
          .get()
          ?.player?.getScreenshotURL()
          .then((url: string | null) => {
            if (url) {
              downloadURL(url, generateScreenshotTitle(this._view));
            }
          });
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
  protected _actionHandler(ev: CustomEvent, config?: ActionsConfig): void {
    const interaction = ev.detail.action;
    const node: HTMLElement | null = ev.currentTarget as HTMLElement | null;
    const actionConfig = getActionConfigGivenAction(interaction, config);
    if (
      this._hass &&
      config &&
      node &&
      interaction &&
      // Don't call frigateCardHandleActionConfig() unless there is explicitly an
      // action defined (as it uses a default that is unhelpful for views that
      // have default tap/click actions).
      actionConfig
    ) {
      frigateCardHandleActionConfig(
        node,
        this._hass,
        config,
        ev.detail.action,
        actionConfig,
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
   * Start the user interaction ('screensaver') timer to reset the view to
   * default `view.timeout_seconds` after user interaction.
   */
  protected _startInteractionTimer(): void {
    this._interactionTimer.stop();

    // Interactions reset the trigger state.
    this._untrigger();

    if (this._getConfig().view.timeout_seconds) {
      this._interactionTimer.start(this._getConfig().view.timeout_seconds, () => {
        if (this._isAutomatedViewUpdateAllowed()) {
          this._changeView();
          this._setLightOrDarkMode();
        }
      });
    }
    this._setLightOrDarkMode();
  }

  /**
   * Set the update timer to trigger an update refresh every
   * `view.update_seconds`.
   */
  protected _startUpdateTimer(): void {
    this._updateTimer.stop();
    if (this._getConfig().view.update_seconds) {
      this._updateTimer.start(this._getConfig().view.update_seconds, () => {
        if (this._isAutomatedViewUpdateAllowed()) {
          this._changeView();
        } else {
          // Not allowed to update this time around, but try again at the next
          // interval.
          this._startUpdateTimer();
        }
      });
    }
  }

  /**
   * Determine if an automated view update is allowed.
   * @returns `true` if it's allowed, `false` otherwise.
   */
  protected _isAutomatedViewUpdateAllowed(ignoreTriggers?: boolean): boolean {
    return (
      (ignoreTriggers || !this._isTriggered()) &&
      (this._getConfig().view.update_force || !this._interactionTimer.isRunning())
    );
  }

  /**
   * Render the card menu.
   * @returns A rendered template.
   */
  protected _renderMenu(): TemplateResult | void {
    if (!this._hass || !this._cameraManager || !this._view) {
      return;
    }
    return html`
      <frigate-card-menu
        ${ref(this._refMenu)}
        .hass=${this._hass}
        .menuConfig=${this._getConfig().menu}
        .buttons=${this._menuButtonController.calculateButtons(
          this._hass,
          this._getConfig(),
          this._cameraManager,
          this._view,
          this._expand,
          {
            currentMediaLoadedInfo: this._mediaLoadedInfoController.get(),
            mediaPlayers: this._mediaPlayers,
            cameraURL: this._getCameraURLFromContext(),
            microphoneController: this._microphoneController,
          },
        )}
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

    this._mediaLoadedInfoController.set(mediaLoadedInfo);

    this._setPropertiesForExpandedMode();

    this._conditionController?.setState({
      media_loaded: this._mediaLoadedInfoController.has(),
    });

    this.requestUpdate();
  }

  protected _setPropertiesForExpandedMode(): void {
    // When a new media loads, set the aspect ratio for when the card is
    // expanded/popped-up. This is based exclusively on last media content,
    // as dimension configuration does not apply in fullscreen or expanded mode.
    const lastKnown = this._mediaLoadedInfoController.getLastKnown();
    this.style.setProperty(
      '--frigate-card-expand-aspect-ratio',
      this._view?.isAnyMediaView() && lastKnown
        ? `${lastKnown.width} / ${lastKnown.height}`
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
    this._mediaLoadedInfoController.clear();
    this._conditionController?.setState({ media_loaded: false });
  }

  protected _locationChangeHandler = (): void => {
    // Only execute actions when the card has rendered at least once.
    if (this.hasUpdated) {
      getActionsFromQueryString().forEach((action) => this._cardActionHandler(action));
    }
  };

  protected firstUpdated(): void {
    // Execute query string actions after first render is complete.
    this._locationChangeHandler();
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    if (screenfull.isEnabled) {
      screenfull.on('change', this._boundFullscreenHandler);
    }
    this.addEventListener('mousemove', this._boundMouseHandler);
    this.addEventListener('ll-custom', this._boundCardActionEventHandler);
    this._panel = isCardInPanel(this);

    // Listen for HA `navigate` actions.
    // See: https://github.com/home-assistant/frontend/blob/273992c8e9c3062c6e49481b6d7d688a07067232/src/common/navigate.ts#L43
    window.addEventListener('location-changed', this._locationChangeHandler);

    // Listen for history state changes (i.e. user using the browser
    // back/forward controls).
    window.addEventListener('popstate', this._locationChangeHandler);

    // Manually call the location change handler as the card will be
    // disconnected/reconnected when dashboard 'tab' changes happen within HA.
    this._locationChangeHandler();
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    // When the dashboard 'tab' is changed, the media is effectively unloaded.
    this._mediaUnloadedHandler();

    if (screenfull.isEnabled) {
      screenfull.off('change', this._boundFullscreenHandler);
    }
    this.removeEventListener('mousemove', this._boundMouseHandler);
    this.removeEventListener('ll-custom', this._boundCardActionEventHandler);

    window.removeEventListener('location-changed', this._locationChangeHandler);
    window.removeEventListener('popstate', this._locationChangeHandler);

    super.disconnectedCallback();
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
    if (!this._isAspectRatioEnforced()) {
      return 'auto';
    }

    const aspectRatioMode = this._getConfig().dimensions.aspect_ratio_mode;

    const lastKnown = this._mediaLoadedInfoController.getLastKnown();
    if (lastKnown && aspectRatioMode === 'dynamic') {
      return `${lastKnown.width} / ${lastKnown.height}`;
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

  protected _isInFullscreen(): boolean {
    return screenfull.isEnabled && screenfull.isFullscreen;
  }

  protected _setExpand(expand: boolean): void {
    if (expand && this._isInFullscreen()) {
      // Fullscreen and expanded mode are mutually exclusive.
      screenfull.exit();
    }

    this._expand = expand;
    this._conditionController?.setState({
      expand: this._expand,
    });
  }

  protected _fullscreenHandler(): void {
    if (this._isInFullscreen()) {
      this._expand = false;
    }

    this._conditionController?.setState({
      fullscreen: this._isInFullscreen(),
      expand: this._expand,
    });

    // Re-render after a change to fullscreen mode to take advantage of
    // the expanded screen real-estate (vs staying in aspect-ratio locked
    // modes).
    this.requestUpdate();
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
      @frigate-card:message=${this._messageHandler.bind(this)}
      @frigate-card:view:change=${this._changeViewHandler.bind(this)}
      @frigate-card:view:change-context=${this._addViewContextHandler.bind(this)}
      @frigate-card:media:loaded=${this._mediaLoadedHandler.bind(this)}
      @frigate-card:media:unloaded=${this._mediaUnloadedHandler.bind(this)}
      @frigate-card:media:volumechange=${
        () => this.requestUpdate() /* Refresh mute menu button */
      }
      @frigate-card:media:play=${
        () => this.requestUpdate() /* Refresh play/pause menu button */
      }
      @frigate-card:media:pause=${
        () => this.requestUpdate() /* Refresh play/pause menu button */
      }
      @frigate-card:render=${() => this.requestUpdate()}
    >
      ${renderMenuAbove ? this._renderMenu() : ''}
      <div ${ref(this._refMain)} class="${classMap(mainClasses)}">
        ${!this._cameraManager?.isInitialized() && !this._message
          ? renderProgressIndicator({ cardWideConfig: this._cardWideConfig })
          : // Always want to call render even if there's a message, to
            // ensure live preload is always present (even if not displayed).
            html`<frigate-card-views
              ${ref(this._refViews)}
              .hass=${this._hass}
              .view=${this._view}
              .cardWideConfig=${this._cardWideConfig}
              .cameraManager=${this._cameraManager}
              .resolvedMediaCache=${this._resolvedMediaCache}
              .config=${this._getConfig()}
              .nonOverriddenConfig=${this._config}
              .conditionControllerEpoch=${this._conditionController?.getEpoch()}
              .hide=${!!this._message}
              .microphoneStream=${this._microphoneController?.getStream()}
            ></frigate-card-views>`}
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
            .conditionControllerEpoch=${this._conditionController?.getEpoch()}
            @frigate-card:menu-add=${(ev: CustomEvent<MenuButton>) => {
              this._menuButtonController.addDynamicMenuButton(ev.detail);
              this.requestUpdate();
            }}
            @frigate-card:menu-remove=${(ev: CustomEvent<MenuButton>) => {
              this._menuButtonController.removeDynamicMenuButton(ev.detail);
              this.requestUpdate();
            }}
            @frigate-card:condition:evaluate=${(ev: ConditionEvaluateRequestEvent) => {
              ev.evaluation = this._conditionController?.evaluateCondition(ev.condition);
            }}
          >
          </frigate-card-elements>`
        : ``}
    </ha-card>`);
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
    const lastKnown = this._mediaLoadedInfoController.getLastKnown();
    if (lastKnown) {
      return lastKnown.height / 50;
    }
    return 6;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card': FrigateCard;
  }
}
