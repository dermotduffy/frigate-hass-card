import { HASSDomEvent, HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { CameraManager } from '../../camera-manager/manager';
import { dispatchActionExecutionRequest } from '../../card-controller/actions/utils/execution-request';
import { PTZAction } from '../../config/ptz';
import { Actions, ActionsConfig, PTZControlsConfig } from '../../config/types';
import { createPTZMultiAction, getActionConfigGivenAction } from '../../utils/action';
import { PTZActionNameToMultiAction, PTZActionPresence } from './types';

export class PTZController {
  private _host: HTMLElement;

  private _config: PTZControlsConfig | null = null;
  private _hass: HomeAssistant | null = null;
  private _cameraManager: CameraManager | null = null;
  private _cameraID: string | null = null;

  private _forceVisibility?: boolean;

  constructor(host: HTMLElement) {
    this._host = host;
  }

  public setConfig(config?: PTZControlsConfig) {
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

  public getConfig(): PTZControlsConfig | null {
    return this._config;
  }

  public setCamera(cameraManager?: CameraManager, cameraID?: string): void {
    this._cameraManager = cameraManager ?? null;
    this._cameraID = cameraID ?? null;
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
    if (action) {
      dispatchActionExecutionRequest(this._host, {
        action: action,
        ...(config && { config: config }),
      });
    }
  }

  public hasUsefulAction(): PTZActionPresence {
    const allUsefulActions = {
      pt: true,
      z: true,
      home: true,
    };
    if (!this._cameraID) {
      // Will use digital PTZ.
      return allUsefulActions;
    }
    const capabilities = this._cameraManager?.getCameraCapabilities(this._cameraID);
    if (!capabilities || !capabilities.hasPTZCapability()) {
      // Will use digital PTZ.
      return allUsefulActions;
    }

    const ptzCapabilities = capabilities.getPTZCapabilities();
    return {
      pt:
        !!ptzCapabilities?.up ||
        !!ptzCapabilities?.down ||
        !!ptzCapabilities?.left ||
        !!ptzCapabilities?.right,
      z: !!ptzCapabilities?.zoomIn || !!ptzCapabilities?.zoomOut,
      home: !!ptzCapabilities?.presets?.length,
    };
  }

  public shouldDisplay(): boolean {
    return this._forceVisibility !== undefined
      ? this._forceVisibility
      : this._config?.mode === 'auto'
        ? !!this._cameraID &&
          !!this._cameraManager
            ?.getCameraCapabilities(this._cameraID)
            ?.hasPTZCapability()
        : this._config?.mode === 'on';
  }

  public getPTZActions(): PTZActionNameToMultiAction {
    const getDefaultActions = (options?: {
      ptzAction?: PTZAction;
      preset?: string;
    }): Actions => ({
      start_tap_action: createPTZMultiAction({
        ptzAction: options?.ptzAction,
        ptzPhase: 'start',
        ptzPreset: options?.preset,
      }),
      end_tap_action: createPTZMultiAction({
        ptzAction: options?.ptzAction,
        ptzPhase: 'stop',
        ptzPreset: options?.preset,
      }),
    });

    const actions: PTZActionNameToMultiAction = {};
    actions.up = getDefaultActions({
      ptzAction: 'up',
    });
    actions.down = getDefaultActions({
      ptzAction: 'down',
    });
    actions.left = getDefaultActions({
      ptzAction: 'left',
    });
    actions.right = getDefaultActions({
      ptzAction: 'right',
    });
    actions.zoom_in = getDefaultActions({
      ptzAction: 'zoom_in',
    });
    actions.zoom_out = getDefaultActions({
      ptzAction: 'zoom_out',
    });
    actions.home = {
      tap_action: createPTZMultiAction(),
    };
    return actions;
  }
}
