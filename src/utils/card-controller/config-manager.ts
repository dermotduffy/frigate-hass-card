import isEqual from 'lodash-es/isEqual';
import { isConfigUpgradeable } from '../../config-mgmt';
import { localize } from '../../localize/localize';
import { setLowPerformanceProfile } from '../../performance.js';
import {
  CardWideConfig,
  FrigateCardConfig,
  frigateCardConfigSchema,
  RawFrigateCardConfig,
} from '../../types';
import { getParseErrorPaths } from '../zod.js';
import { getOverriddenConfig } from './conditions-manager';
import { InitializationAspect } from './initialization-manager';
import { CardConfigAPI } from './types';

export class ConfigManager {
  protected _api: CardConfigAPI;

  // The main base configuration object. For most usecases use getConfig() to
  // get the correct configuration (which will return overrides as appropriate).
  // This variable must be called `_config` or `config` to be compatible with
  // card-mod.
  protected _config: FrigateCardConfig | null = null;
  protected _overriddenConfig: FrigateCardConfig | null = null;
  protected _rawConfig: RawFrigateCardConfig | null = null;
  protected _cardWideConfig: CardWideConfig | null = null;

  constructor(api) {
    this._api = api;
  }

  public hasConfig(): boolean {
    return !!this.getConfig();
  }

  public getConfig(): FrigateCardConfig | null {
    return this._overriddenConfig ?? this._config;
  }

  public getCardWideConfig(): CardWideConfig | null {
    return this._cardWideConfig;
  }

  public getNonOverriddenConfig(): FrigateCardConfig | null {
    return this._config;
  }

  public getRawConfig(): RawFrigateCardConfig | null {
    return this._rawConfig;
  }

  public setConfig(inputConfig?: RawFrigateCardConfig): void {
    if (!inputConfig) {
      throw new Error(localize('error.invalid_configuration'));
    }

    const parseResult = frigateCardConfigSchema.safeParse(inputConfig);
    if (!parseResult.success) {
      const configUpgradeable = isConfigUpgradeable(inputConfig);
      const hint = getParseErrorPaths(parseResult.error);
      let upgradeMessage = '';
      if (configUpgradeable) {
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

    this._rawConfig = inputConfig;
    if (isEqual(this._config, config)) {
      return;
    }

    this._config = config;
    this._cardWideConfig = {
      performance: config.performance,
      debug: config.debug,
    };

    this._api.getConditionsManager().setConditionsFromConfig();
    this._api.getConditionsManager().setState({
      view: undefined,
      displayMode: undefined,
      camera: undefined,
    });
    this._api.getMediaLoadedInfoManager().clear();
    this._api.getViewManager().reset();
    this._api.getMessageManager().reset();
    this._api.getAutomationsManager().setAutomationsFromConfig();
    this._api.getStyleManager().setPerformance();
    this._api.getCardElementManager().update();

    this.computeOverrideConfig();
  }

  public computeOverrideConfig(): void {
    const conditionsManager = this._api.getConditionsManager();
    if (!this._config) {
      return;
    }
    const overriddenConfig = getOverriddenConfig(
      conditionsManager,
      this._config,
      this._config.overrides,
    ) as FrigateCardConfig;

    // Save on Lit re-rendering costs by only updating the configuration if it
    // actually changes.
    if (isEqual(overriddenConfig, this._overriddenConfig)) {
      return;
    }

    const previousConfig = this._overriddenConfig;
    this._overriddenConfig = overriddenConfig;

    this._api.getStyleManager().setMinMaxHeight();

    if (
      previousConfig &&
      (!isEqual(previousConfig?.cameras, this._overriddenConfig?.cameras) ||
        !isEqual(previousConfig?.cameras_global, this._overriddenConfig?.cameras_global))
    ) {
      this._api.getInitializationManager().uninitialize(InitializationAspect.CAMERAS);
    }

    if (
      previousConfig &&
      previousConfig?.live.microphone.always_connected !==
        this._overriddenConfig?.live.microphone.always_connected
    ) {
      this._api
        .getInitializationManager()
        .uninitialize(InitializationAspect.MICROPHONE_CONNECT);
    }

    this._api.getCardElementManager().update();
  }
}