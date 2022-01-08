import type {
  FrigateCardCondition,
  RawFrigateCardConfig,
} from './types';
import { merge, cloneDeep } from 'lodash-es';

export interface ConditionState {
  view?: string;
  fullscreen?: boolean;
  camera?: string;
}

class ConditionStateRequestEvent extends Event {
  public conditionState?: ConditionState;
}

export function evaluateCondition(
  condition?: Readonly<FrigateCardCondition>,
  state?: Readonly<ConditionState>,
): boolean {
  if (!state) {
    return false;
  }

  let result = true;
  if (condition?.view?.length) {
    result &&= !!state.view && condition.view.includes(state.view);
  }
  if (condition?.fullscreen !== undefined) {
    result &&= state.fullscreen !== undefined && condition.fullscreen == state.fullscreen;
  }
  if (condition?.camera?.length) {
    result &&= !!state.camera && condition.camera.includes(state.camera);
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

type Overrides = {
  conditions: FrigateCardCondition;
  overrides: RawFrigateCardConfig;
}[];

export function getOverriddenConfig(
  config: Readonly<RawFrigateCardConfig>,
  conditionState?: Readonly<ConditionState>,
  overrides?: Readonly<Overrides>,
): RawFrigateCardConfig {
  const overridesSource =
    overrides || (config['overrides'] as Readonly<Overrides> | undefined);
  if (!overridesSource) {
    return config;
  }

  const output = cloneDeep(config);
  let overridden = false;

  for (const override of overridesSource) {
    if (evaluateCondition(override.conditions, conditionState)) {
      merge(output, override.overrides);
      overridden = true;
    }
  }
  // Attempt to return the same configuration object if it has not been
  // overridden (to reduce re-renders for a configuration that has not changed).
  return overridden ? output : config;
}