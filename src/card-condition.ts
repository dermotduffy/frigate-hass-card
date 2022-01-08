import type {
  CameraConfig,
  FrigateCardCondition,
  RawFrigateCardConfig,
} from './types';
import { merge, cloneDeep } from 'lodash-es';

import { View } from './view';

export interface ConditionState {
  view?: Readonly<View>;
  fullscreen?: boolean;
  camera?: CameraConfig;
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
  if (condition?.view?.length && state.view) {
    result &&= condition?.view.includes(state.view.view);
  }
  if (condition?.fullscreen !== undefined && state.fullscreen !== undefined) {
    result &&= condition?.fullscreen == state.fullscreen;
  }

  const evaluateNested = (
    input: Readonly<RawFrigateCardConfig>,
    condition: Readonly<RawFrigateCardConfig>,
  ): boolean => {
    let result = true;

    for (const key of Object.keys(condition)) {
      if (typeof condition[key] === 'string') {
        // If the test is a literal, it must exactly match.
        result &&= input[key] === condition[key];
      } else if (Array.isArray(condition[key])) {
        // If the test is an array, it's a list of acceptable values.
        result &&= (condition[key] as unknown[]).includes(input[key]);
      } else if (typeof condition[key] === 'object' && typeof input[key] === 'object') {
        // If the test is an object, recursively navigate downwards.
        result &&= evaluateNested(
          input[key] as RawFrigateCardConfig,
          condition[key] as RawFrigateCardConfig,
        );
      } else if (input[key] === undefined) {
        return false;
      }
    }
    return result;
  };

  if (condition?.camera) {
    result &&= state.camera ? evaluateNested(state.camera, condition.camera) : false;
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