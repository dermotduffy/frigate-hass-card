import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import orderBy from 'lodash-es/orderBy';
import { getHassDifferences, isTriggeredState } from '../utils/ha';
import { Timer } from '../utils/timer';
import { CardTriggersAPI } from './types';

export class TriggersManager {
  protected _api: CardTriggersAPI;

  protected _triggers: Map<string, Date> = new Map();
  protected _untriggerTimer = new Timer();

  constructor(api: CardTriggersAPI) {
    this._api = api;
  }

  public isTriggered(): boolean {
    return !!this._triggers.size || this._untriggerTimer.isRunning();
  }

  public updateTriggeredCameras(oldHass?: HomeAssistant | null): boolean {
    if (!this._shouldTrackTriggers()) {
      return false;
    }

    const hass = this._api.getHASSManager().getHASS();

    const now = new Date();
    let triggerChanges = false;

    const cameras = this._api.getCameraManager().getStore().getVisibleCameras();
    for (const [cameraID, config] of cameras?.entries()) {
      const triggerEntities = config.triggers.entities;
      const diffs = getHassDifferences(hass, oldHass, triggerEntities, {
        stateOnly: true,
      });
      const shouldTrigger = diffs.some((diff) => isTriggeredState(diff.newState));
      const shouldUntrigger = triggerEntities.every(
        (entity) => !isTriggeredState(hass?.states[entity]),
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
      const targetCameraID = this._getMostRecentTrigger();
      if (targetCameraID) {
        this._triggerAction(targetCameraID);
        return true;
      } else {
        this._startUntriggerTimer();
      }
    }
    return false;
  }

  public untrigger(): void {
    const wasTriggered = this.isTriggered();
    this._triggers.clear();
    this._untriggerTimer.stop();

    if (wasTriggered) {
      this._untriggerAction();
    }
  }

  protected _triggerAction(cameraID: string): void {
    const view = this._api.getViewManager().getView();
    if (
      this._isAutomatedViewUpdateAllowed() &&
      (view?.camera !== cameraID || !view?.is('live'))
    ) {
      this._api.getViewManager().setViewByParameters({
        viewName: 'live',
        cameraID: cameraID,
      });
    }
  }

  protected _untriggerAction(): void {
    if (
      !this.isTriggered() &&
      this._isAutomatedViewUpdateAllowed() &&
      this._api.getConfigManager().getConfig()?.view.scan.untrigger_reset
    ) {
      this._api.getViewManager().setViewDefault();
    }
  }

  protected _isAutomatedViewUpdateAllowed(): boolean {
    return (
      this._api.getConfigManager().getConfig()?.view.update_force ||
      !this._api.getInteractionManager().hasInteraction()
    );
  }

  protected _shouldTrackTriggers(): boolean {
    return !!this._api.getConfigManager().getConfig()?.view.scan.enabled;
  }

  protected _startUntriggerTimer(): void {
    this._untriggerTimer.start(
      /* istanbul ignore next: the case of config being null here cannot be
         reached, as there's no way to have the untrigger call happen without
         a config. -- @preserve */
      this._api.getConfigManager().getConfig()?.view.scan.untrigger_seconds ?? 0,
      () => {
        this._untriggerAction();
      },
    );
  }

  protected _getMostRecentTrigger(): string | null {
    const sorted = orderBy(
      [...this._triggers.entries()],
      (entry) => entry[1].getTime(),
      'desc',
    );
    return sorted.length ? sorted[0][0] : null;
  }
}
