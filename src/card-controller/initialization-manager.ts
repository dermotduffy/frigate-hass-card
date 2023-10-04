import { loadLanguages } from '../localize/localize';
import { sideLoadHomeAssistantElements } from '../utils/ha';
import { Initializer } from '../utils/initializer/initializer';
import { CardInitializerAPI } from './types';

export enum InitializationAspect {
  LANGUAGES = 'languages',
  SIDE_LOAD_ELEMENTS = 'side-load-elements',
  MEDIA_PLAYERS = 'media-players',
  CAMERAS = 'cameras',
  MICROPHONE_CONNECT = 'microphone-connect',
}

export class InitializationManager {
  protected _api: CardInitializerAPI;
  protected _initializer;

  constructor(api: CardInitializerAPI, initializer?: Initializer) {
    this._api = api;
    this._initializer = initializer ?? new Initializer();
  }

  public isInitializedMandatory(): boolean {
    return this._initializer.isInitializedMultiple([
      InitializationAspect.LANGUAGES,
      InitializationAspect.SIDE_LOAD_ELEMENTS,
      InitializationAspect.CAMERAS,
    ]);
  }

  /**
   * Initialize the hard requirements for rendering anything.
   * @returns `true` if card rendering can continue.
   */
  public async initializeMandatory(): Promise<boolean> {
    const hass = this._api.getHASSManager().getHASS();
    if (!hass) {
      return false;
    }

    if (
      !(await this._initializer.initializeMultipleIfNecessary({
        // Caution: Ensure nothing in this set of initializers requires
        // config or languages since they will not yet have been initialized.
        [InitializationAspect.LANGUAGES]: async () => await loadLanguages(hass),
        [InitializationAspect.SIDE_LOAD_ELEMENTS]: async () =>
          await sideLoadHomeAssistantElements(),
      }))
    ) {
      return false;
    }

    if (!this._api.getConfigManager().hasConfig()) {
      return false;
    }

    if (
      !(await this._initializer.initializeIfNecessary(
        InitializationAspect.CAMERAS,
        async () => await this._api.getCameraManager().initializeCamerasFromConfig(),
      ))
    ) {
      return false;
    }

    if (!this._api.getMessageManager().hasMessage()) {
      // Set a view on initial load. However, if the query string contains a
      // view related action, we don't set any view here and allow that content
      // to be triggered by the firstUpdated() call that runs query string
      // actions. To do otherwise may cause a race condition between the default
      // view and the querystring view, see:
      // https://github.com/dermotduffy/frigate-hass-card/issues/1200
      const hasViewRelatedActions = this._api
        .getQueryStringManager()
        .hasViewRelatedActions();
      if (hasViewRelatedActions) {
        this._api.getQueryStringManager().executeViewRelated();
      } else {
        this._api.getViewManager().setViewDefault();
      }
    }

    this._api.getCardElementManager().update();
    return true;
  }

  /**
   * Initialize aspects of the card that can load in the 'background'.
   * @returns `true` if card rendering can continue.
   */
  public async initializeBackgroundIfNecessary(): Promise<boolean> {
    const hass = this._api.getHASSManager().getHASS();
    const config = this._api.getConfigManager().getConfig();

    if (!hass || !config) {
      return false;
    }

    if (
      this._initializer.isInitializedMultiple([
        ...(config.menu.buttons.media_player.enabled
          ? [InitializationAspect.MEDIA_PLAYERS]
          : []),
        ...(config.live.microphone.always_connected
          ? [InitializationAspect.MICROPHONE_CONNECT]
          : []),
      ])
    ) {
      return true;
    }

    if (
      !(await this._initializer.initializeMultipleIfNecessary({
        ...(config.menu.buttons.media_player.enabled && {
          [InitializationAspect.MEDIA_PLAYERS]: async () =>
            await this._api.getMediaPlayerManager().initialize(),
        }),
        ...(config.live.microphone.always_connected && {
          [InitializationAspect.MICROPHONE_CONNECT]: async () =>
            await this._api.getMicrophoneManager().connect(),
        }),
      }))
    ) {
      return false;
    }

    this._api.getCardElementManager().update();
    return true;
  }

  public uninitialize(aspect: InitializationAspect) {
    return this._initializer.uninitialize(aspect);
  }
}
