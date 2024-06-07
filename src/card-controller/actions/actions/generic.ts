import { ActionConfig, handleActionConfig } from '@dermotduffy/custom-card-helpers';
import { CardActionsAPI } from '../../types';
import { BaseAction } from './base';

/**
 * Handles generic HA (non-Frigate) actions (e.g. 'more-info')
 */
export class GenericAction extends BaseAction<ActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    const hass = api.getHASSManager().getHASS();
    if (hass) {
      handleActionConfig(
        api.getCardElementManager().getElement(),
        hass,
        this._config ?? {},
        this._action,
      );
    }
  }
}
