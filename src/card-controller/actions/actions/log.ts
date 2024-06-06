import { LogActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { FrigateCardAction } from './base';

export class LogAction extends FrigateCardAction<LogActionConfig> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async execute(_api: CardActionsAPI): Promise<void> {
    console[this._action.level](this._action.message);
  }
}
