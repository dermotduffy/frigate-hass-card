import type { FrigateCardCondition } from './types';
import { View } from './view';

export interface ConditionState {
  view?: View;
  fullscreen?: boolean;
}

class ConditionStateRequestEvent extends Event {
  public conditionState?: ConditionState;
}

export function evaluateCondition(
  condition?: FrigateCardCondition,
  state?: ConditionState,
): boolean {
  let result = true;
  if (condition?.view?.length && state?.view) {
    result &&= condition?.view.includes(state?.view.view);
  }
  if (condition?.fullscreen !== undefined && state?.fullscreen !== undefined) {
    result &&= condition?.fullscreen == state?.fullscreen;
  }
  return result;
}

/**
 * Evaluate whether a frigateCardCondition is met using an event to fetch state.
 * @returns A boolean indicating whether the condition is met.
 */
export function fetchStateAndEvaluateCondition(
  node: HTMLElement,
  condition?: FrigateCardCondition,
): boolean {
  if (!condition) {
    return true;
  }

  const stateEvent = new ConditionStateRequestEvent(
    `frigate-card:condition-state-request`,
    {
      bubbles: true,
      composed: true,
    },
  );

  /* Special note on what's going on here:
   *
   * Some parts of the card (e.g. <frigate-card-elements>) may have arbitrary
   * complexity and layers (that this card doesn't control) between that master
   * element and the element that needs to evaluate the condition. In these
   * cases there's no clean way to pass state from the rest of card down
   * through these layers. Instead, an event is dispatched as a "request for
   * state" (StateRequestEvent) upwards which is caught by the outer card
   * and state added to the event object. Because event propagation is handled
   * synchronously, the state will be added to the event before the flow
   * proceeds.
   */
  node.dispatchEvent(stateEvent);
  return evaluateCondition(condition, stateEvent.conditionState);
}

export function conditionStateRequestHandler(
  ev: ConditionStateRequestEvent,
  conditionState?: ConditionState,
): void {
  ev.conditionState = conditionState;
}
