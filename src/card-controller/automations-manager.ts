import { Automation, AutomationActions } from '../config/types.js';
import { localize } from '../localize/localize.js';
import { CardAutomationsAPI, TaggedAutomations } from './types.js';

const MAX_NESTED_AUTOMATION_EXECUTIONS = 10;

export class AutomationsManager {
  protected _api: CardAutomationsAPI;

  protected _automations: TaggedAutomations = [];
  protected _priorEvaluations: Map<Automation, boolean> = new Map();

  // A counter to avoid infinite loops, increases every time actions are run,
  // decreases every time actions are complete.
  protected _nestedAutomationExecutions = 0;

  constructor(api: CardAutomationsAPI) {
    this._api = api;
  }

  public deleteAutomations(tag?: unknown) {
    this._automations = this._automations.filter((automation) => automation.tag !== tag);
  }

  public addAutomations(automations: TaggedAutomations): void {
    this._automations.push(...automations);
  }

  public execute(): void {
    const hass = this._api.getHASSManager().getHASS();

    // Never execute automations if there's an error (as our automation loop
    // avoidance -- which shows as an error -- would not work!).
    if (!hass || this._api.getMessageManager().hasErrorMessage()) {
      return;
    }

    const actionsToRun: AutomationActions = [];
    for (const automation of this._automations) {
      const shouldExecute = this._api
        .getConditionsManager()
        .evaluateConditions(automation.conditions);
      const actions = shouldExecute ? automation.actions : automation.actions_not;
      const priorEvaluation = this._priorEvaluations.get(automation);
      this._priorEvaluations.set(automation, shouldExecute);
      if (shouldExecute !== priorEvaluation && actions) {
        actionsToRun.push(...actions);
      }
    }

    if (!actionsToRun.length) {
      return;
    }

    const runActions = async (actions: AutomationActions): Promise<void> => {
      ++this._nestedAutomationExecutions;
      if (this._nestedAutomationExecutions > MAX_NESTED_AUTOMATION_EXECUTIONS) {
        this._api.getMessageManager().setMessageIfHigherPriority({
          type: 'error',
          message: localize('error.too_many_automations'),
        });
        return;
      }

      await this._api.getActionsManager().executeActions(actions);
      --this._nestedAutomationExecutions;
    };
    runActions(actionsToRun);
  }
}
