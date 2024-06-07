import merge from 'lodash-es/merge';
import { Action, TargetedActionContext } from '../types';
import { ActionContext } from 'action';

export const stopInProgressForThisTarget = (
  targetID: string,
  context?: TargetedActionContext,
): void => {
  context?.[targetID]?.inProgressAction?.stop();
};

export const setInProgressForThisTarget = (
  targetID: string,
  context: ActionContext,
  contextKey: keyof ActionContext,
  action: Action,
) => {
  merge(context, {
    [contextKey]: {
      [targetID]: {
        inProgressAction: action,
      },
    },
  });
};
