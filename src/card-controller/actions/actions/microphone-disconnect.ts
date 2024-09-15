import { GeneralActionConfig } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { FrigateCardAction } from './base';

export class MicrophoneDisconnectAction extends FrigateCardAction<GeneralActionConfig> {
  public async execute(api: CardActionsAPI): Promise<void> {
    api.getMicrophoneManager().disconnect();
  }
}
