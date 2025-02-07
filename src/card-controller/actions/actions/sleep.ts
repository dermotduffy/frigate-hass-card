import { SleepActionConfig } from '../../../config/types';
import { sleep } from '../../../utils/basic';
import { CardActionsAPI } from '../../types';
import { timeDeltaToSeconds } from '../utils/time-delta';
import { AdvancedCameraCardAction } from './base';

export class SleepAction extends AdvancedCameraCardAction<SleepActionConfig> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async execute(_api: CardActionsAPI): Promise<void> {
    await sleep(timeDeltaToSeconds(this._action.duration));
  }
}
