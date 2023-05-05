import { HomeAssistant } from 'custom-card-helpers';
import { AutomationActions, FrigateCardError } from './types.js';
import { ConditionController } from './conditions.js';
import { Automation, Automations } from './types.js';
import { frigateCardHandleAction } from './utils/action.js';
import { localize } from './localize/localize.js';

const MAX_NESTED_AUTOMATION_EXECUTIONS = 10;

export class AutomationsControllerError extends FrigateCardError {}

export class AutomationsController {
  protected _automations: Automations;
  protected _priorEvaluations: Map<Automation, boolean> = new Map();

  // A counter to avoid infinite loops, increases every time actions are run,
  // decreases every time actions are complete.
  protected _nestedAutomationExecutions = 0;

  constructor(automations: Automations) {
    this._automations = automations;
  }

  public execute(
    element: HTMLElement,
    hass: HomeAssistant,
    conditionController: ConditionController,
  ): void {
    const actionsToRun: AutomationActions[] = [];
    for (const automation of this._automations ?? []) {
      const shouldExecute = conditionController.evaluateCondition(automation.conditions);
      const actions = shouldExecute ? automation.actions : automation.actions_not;
      const priorEvaluation = this._priorEvaluations.get(automation);
      this._priorEvaluations.set(automation, shouldExecute);
      if (shouldExecute !== priorEvaluation && actions) {
        actionsToRun.push(actions);
      }
    }

    ++this._nestedAutomationExecutions;
    if (this._nestedAutomationExecutions > MAX_NESTED_AUTOMATION_EXECUTIONS) {
      throw new AutomationsControllerError(localize('error.too_many_automations'));
    }

    actionsToRun.forEach((actions) => {
      frigateCardHandleAction(element, hass, {}, actions);
    });
    --this._nestedAutomationExecutions;
  }
}
