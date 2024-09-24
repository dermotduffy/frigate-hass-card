import PQueue from 'p-queue';
import { loadLanguages } from '../localize/localize';
import { sideLoadHomeAssistantElements } from '../utils/ha';
import { Initializer } from '../utils/initializer/initializer';
import { CardInitializerAPI } from './types';

export enum InitializationAspect {
  LANGUAGES = 'languages',
  SIDE_LOAD_ELEMENTS = 'side-load-elements',
  CAMERAS = 'cameras',
  MICROPHONE_CONNECT = 'microphone-connect',
  VIEW = 'view',
}

// =========================================================================
// Rules for initialization. Initializers must be reentrant as these situations
// may occur:
//
// 1. Multiple JS async contexts may execute these functions at the same time.
// 2. At any point, something may uninitialize a part of the card (including
//    while a different async context is in the middle of running the
//    initialization method).
// =========================================================================

export class InitializationManager {
  protected _api: CardInitializerAPI;

  // A concurrency limit is placed to ensure that on card load multiple async
  // contexts do not attempt to initialize the card at the same time. This is
  // not strictly necessary, just more efficient, as long as the "Rules for
  // initialization" (above) are followed.
  protected _initializationQueue = new PQueue({ concurrency: 1 });
  protected _initializer: Initializer;
  protected _everInitialized = false;

  constructor(api: CardInitializerAPI, initializer?: Initializer) {
    this._api = api;
    this._initializer = initializer ?? new Initializer();
  }

  public wasEverInitialized(): boolean {
    return this._everInitialized;
  }

  public isInitializedMandatory(): boolean {
    const config = this._api.getConfigManager().getConfig();
    if (!config) {
      return false;
    }

    return this._initializer.isInitializedMultiple([
      InitializationAspect.LANGUAGES,
      InitializationAspect.SIDE_LOAD_ELEMENTS,
      InitializationAspect.CAMERAS,
      ...(this._api.getMicrophoneManager().shouldConnectOnInitialization()
        ? [InitializationAspect.MICROPHONE_CONNECT]
        : []),
      InitializationAspect.VIEW,
    ]);
  }

  /**
   * Initialize the hard requirements for rendering anything.
   * @returns `true` if card rendering can continue.
   */
  public async initializeMandatory(): Promise<void> {
    await this._initializationQueue.add(() => this._initializeMandatory());
  }

  protected async _initializeMandatory(): Promise<void> {
    const hass = this._api.getHASSManager().getHASS();
    if (!hass || this.isInitializedMandatory()) {
      return;
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
      return;
    }

    const config = this._api.getConfigManager().getConfig();
    if (!config) {
      return;
    }

    if (
      !(await this._initializer.initializeMultipleIfNecessary({
        [InitializationAspect.CAMERAS]: async () =>
          await this._api.getCameraManager().initializeCamerasFromConfig(),

        // Connecting the microphone (if configured) is considered mandatory to
        // avoid issues with some cameras that only allow 2-way audio on the
        // first stream initialized. See:
        // https://github.com/dermotduffy/frigate-hass-card/issues/1235
        ...(this._api.getMicrophoneManager().shouldConnectOnInitialization() && {
          [InitializationAspect.MICROPHONE_CONNECT]: async () =>
            await this._api.getMicrophoneManager().connect(),
        }),
      }))
    ) {
      return;
    }

    if (
      this._api.getMessageManager().hasMessage() ||
      !(await this._initializer.initializeIfNecessary(
        InitializationAspect.VIEW,
        this._api.getViewManager().initialize,
      ))
    ) {
      return;
    }

    this._everInitialized = true;
    this._api.getCardElementManager().update();
  }

  public uninitialize(aspect: InitializationAspect): void {
    this._initializer.uninitialize(aspect);
  }
}
