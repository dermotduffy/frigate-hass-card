import { ActionContext } from 'action';
import { AdvancedCameraCardCustomAction } from '../../../config/types';
import { CardActionsAPI } from '../../types';
import { Action, AuxillaryActionConfig } from '../types';

export class BaseAction<T> implements Action {
  protected _context: ActionContext;
  protected _action: T;
  protected _config?: AuxillaryActionConfig;

  constructor(context: ActionContext, action: T, config?: AuxillaryActionConfig) {
    this._context = context;
    this._action = action;
    this._config = config;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async execute(_api: CardActionsAPI): Promise<void> {
    // Pass.
  }

  public async stop(): Promise<void> {
    // Pass.
  }
}

export class AdvancedCameraCardAction<
  T extends AdvancedCameraCardCustomAction,
> extends BaseAction<T> {}
