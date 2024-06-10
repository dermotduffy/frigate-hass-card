import { ActionType } from '../../config/types';
import { CardActionsAPI } from '../types';

export interface AuxillaryActionConfig {
  camera_image?: string;
  entity?: string;
}

export interface Action {
  execute(api: CardActionsAPI): Promise<void>;
  stop(): Promise<void>;
}

export interface ActionExecutionRequest {
  action: ActionType[] | ActionType;
  config?: AuxillaryActionConfig;
}

export interface TargetedActionContext {
  [targetID: string]: {
    inProgressAction?: Action;
  };
}
