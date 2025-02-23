import { CurrentUser } from '@dermotduffy/custom-card-helpers';
import { HassEntities } from 'home-assistant-js-websocket';
import { AdvancedCameraCardConfig, ViewDisplayMode } from '../config/types';
import { MediaLoadedInfo } from '../types';
import { KeysState, MicrophoneState } from '../card-controller/types';

export interface ConditionState {
  camera?: string;
  config?: AdvancedCameraCardConfig;
  displayMode?: ViewDisplayMode;
  expand?: boolean;
  fullscreen?: boolean;
  initialized?: boolean;
  interaction?: boolean;
  keys?: KeysState;
  mediaLoadedInfo?: MediaLoadedInfo | null;
  microphone?: MicrophoneState;
  state?: HassEntities;
  triggered?: Set<string>;
  user?: CurrentUser;
  userAgent?: string;
  view?: string;
}

export interface ConditionStateChange {
  old: ConditionState;
  change: ConditionState;
  new: ConditionState;
}

export type ConditionStateListener = (change: ConditionStateChange) => void;

export interface ConditionStateManagerReadonlyInterface {
  addListener(listener: ConditionStateListener): void;
  removeListener(listener: ConditionStateListener): void;
  getState(): ConditionState;
}

interface ConditionsEvaluationDataFromTo {
  from?: string;
  to?: string;
}

interface ConditionsEvaluationDataState extends ConditionsEvaluationDataFromTo {
  entity: string;
}

interface ConditionsEvaluationDataConfig {
  from?: AdvancedCameraCardConfig;
  to?: AdvancedCameraCardConfig;
}

export interface ConditionsEvaluationData {
  camera?: ConditionsEvaluationDataFromTo;
  view?: ConditionsEvaluationDataFromTo;
  state?: ConditionsEvaluationDataState;
  config?: ConditionsEvaluationDataConfig;
}
export interface ConditionsEvaluationResult {
  result: boolean;
  data?: ConditionsEvaluationData;
}

export type ConditionsListener = (result: ConditionsEvaluationResult) => void;

export interface ConditionsManagerReadonlyInterface {
  addListener(listener: ConditionsListener): void;
  removeListener(listener: ConditionsListener): void;
  getEvaluation(): ConditionsEvaluationResult | null;
}
