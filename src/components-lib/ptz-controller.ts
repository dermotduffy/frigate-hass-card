import { HASSDomEvent, HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { CameraManager } from '../camera-manager/manager';
import {
  Actions,
  ActionsConfig,
  FrigateCardPTZAction,
  FrigateCardPTZActions,
  FrigateCardPTZConfig,
  PTZAction,
  PTZControlAction,
  PTZ_CONTROL_ACTIONS,
} from '../config/types';
import {
  frigateCardHandleActionConfig,
  getActionConfigGivenAction,
} from '../utils/action';

export class PTZController {
  private _host: HTMLElement;

  private _config: FrigateCardPTZConfig | null = null;
  private _hass: HomeAssistant | null = null;
  private _cameraManager: CameraManager | null = null;
  private _cameraID: string | null = null;
  private _actions: FrigateCardPTZActions | null = null;
  private _forceVisibility?: boolean;

  constructor(host: HTMLElement) {
    this._host = host;
  }

  public setConfig(config?: FrigateCardPTZConfig) {
    this._config = config ?? null;

    this._host.setAttribute('data-orientation', config?.orientation ?? 'horizontal');
    this._host.setAttribute('data-position', config?.position ?? 'bottom-right');
    this._host.setAttribute(
      'style',
      Object.entries(config?.style ?? {})
        .map(([k, v]) => `${k}:${v}`)
        .join(';'),
    );
  }

  public getConfig(): FrigateCardPTZConfig | null {
    return this._config;
  }

  public setHASS(hass?: HomeAssistant) {
    this._hass = hass ?? null;
  }

  public setCamera(cameraManager?: CameraManager, cameraID?: string) {
    this._cameraManager = cameraManager ?? null;
    this._cameraID = cameraID ?? null;

    this._calculateActions();
  }

  public setForceVisibility(forceVisibility?: boolean): void {
    this._forceVisibility = forceVisibility;
  }

  public handleAction(
    ev: HASSDomEvent<{ action: string }>,
    config?: ActionsConfig | null,
  ): void {
    // Nothing else has the configuration for this action, so don't let it
    // propagate further.
    ev.stopPropagation();

    const interaction: string = ev.detail.action;
    const action = getActionConfigGivenAction(interaction, config);
    if (config && action && this._hass) {
      frigateCardHandleActionConfig(this._host, this._hass, config, interaction, action);
    }
  }

  public getPTZActions(actionName: PTZControlAction): Actions | null {
    const propertyName = 'actions_' + actionName;
    return this._config?.[propertyName] ?? this._actions?.[propertyName] ?? null;
  }

  private _hasAnyAction(): boolean {
    for (const actionName of PTZ_CONTROL_ACTIONS) {
      if ('actions_' + actionName in (this._actions ?? {})) {
        return true;
      }
    }
    return false;
  }

  public shouldDisplay(): boolean {
    return this._forceVisibility === false
      ? false
      : this._config?.mode === 'on' && this._hasAnyAction();
  }

  private _calculateActions(): void {
    const getDefaultAction = (
      ptzAction: PTZAction,
      options?: {
        phase?: 'start' | 'stop';
        preset?: string;
      },
    ): FrigateCardPTZAction => ({
      action: 'fire-dom-event',
      frigate_card_action: 'ptz',
      ptz_action: ptzAction,
      ...(options?.phase && { ptz_phase: options.phase }),
      ...(options?.preset && { ptz_preset: options.preset }),
    });

    const getDefaultActions = (
      ptzAction: PTZAction,
      continuous: boolean,
      preset?: string,
    ): Actions =>
      continuous
        ? {
            start_tap_action: getDefaultAction(ptzAction, {
              phase: 'start',
              preset: preset,
            }),
            end_tap_action: getDefaultAction(ptzAction, {
              phase: 'stop',
              preset: preset,
            }),
          }
        : {
            tap_action: getDefaultAction(ptzAction, { preset: preset }),
          };

    if (!this._cameraManager || !this._cameraID) {
      return;
    }

    const ptzCapabilities = this._cameraManager.getCameraCapabilities(
      this._cameraID,
    )?.getPTZCapabilities();

    const defaultActions: FrigateCardPTZActions = {};
    const panTilt = ptzCapabilities?.panTilt;
    const zoom = ptzCapabilities?.zoom;
    const presets = ptzCapabilities?.presets;

    if (panTilt?.length) {
      const continuous = panTilt.includes('continuous');
      defaultActions.actions_up = getDefaultActions('up', continuous);
      defaultActions.actions_down = getDefaultActions('down', continuous);
      defaultActions.actions_left = getDefaultActions('left', continuous);
      defaultActions.actions_right = getDefaultActions('right', continuous);
    }

    if (zoom?.length) {
      const continuous = zoom.includes('continuous');
      defaultActions.actions_zoom_in = getDefaultActions('zoom_in', continuous);
      defaultActions.actions_zoom_out = getDefaultActions('zoom_out', continuous);
    }

    if (presets?.length) {
      defaultActions.actions_home = getDefaultActions('preset', false, presets[0]);
    }

    this._actions = {
      ...defaultActions,
      ...this._config,
    };
  }
}
