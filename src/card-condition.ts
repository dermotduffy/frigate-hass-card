import type {
  FrigateCardCondition,
  OverrideConfigurationKey,
  RawFrigateCardConfig,
} from './types';
import { merge, cloneDeep } from 'lodash-es';
import { HassEntities } from 'home-assistant-js-websocket';

export interface ConditionState {
  view?: string;
  fullscreen?: boolean;
  camera?: string;
  state?: HassEntities;
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
    result &&=
      state.fullscreen !== undefined && condition.fullscreen == state.fullscreen;
  }
  if (condition?.camera?.length) {
    result &&= !!state.camera && condition.camera.includes(state.camera);
  }
  if (condition?.state?.length) {
    for (const stateTest of condition?.state) {
      result &&=
        !!state.state &&
        ((!stateTest.state && !stateTest.state_not) ||
          (stateTest.entity in state.state &&
            (!stateTest.state ||
              state.state[stateTest.entity].state === stateTest.state) &&
            (!stateTest.state_not ||
              state.state[stateTest.entity].state !== stateTest.state_not)));
    }
  }
  return result;
}

/**
 * Evaluate whether a frigateCardCondition is met using an event to fetch state.
 * @returns A boolean indicating whether the condition is met.
 */
export function fetchStateAndEvaluateCondition(
  element: HTMLElement,
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
  element.dispatchEvent(stateEvent);
  return evaluateCondition(condition, stateEvent.conditionState);
}

export function conditionStateRequestHandler(
  ev: ConditionStateRequestEvent,
  conditionState?: ConditionState,
): void {
  ev.conditionState = conditionState;
}

type RawOverrides = {
  conditions: FrigateCardCondition;
  overrides: RawFrigateCardConfig;
}[];

export function getOverriddenConfig(
  config: Readonly<RawFrigateCardConfig>,
  overrides: Readonly<RawOverrides> | undefined,
  conditionState?: Readonly<ConditionState>,
): RawFrigateCardConfig {
  const output = cloneDeep(config);
  let overridden = false;
  if (overrides) {
    for (const override of overrides) {
      if (evaluateCondition(override.conditions, conditionState)) {
        merge(output, override.overrides);
        overridden = true;
      }
    }
  }
  // Attempt to return the same configuration object if it has not been
  // overridden (to reduce re-renders for a configuration that has not changed).
  return overridden ? output : config;
}

export function getOverridesByKey(
  overrides: Readonly<RawOverrides> | undefined,
  key: OverrideConfigurationKey,
): RawOverrides {
  return (
    overrides
      ?.filter((o) => key in o.overrides)
      .map((o) => ({
        conditions: o.conditions,
        overrides: o.overrides[key] as RawFrigateCardConfig,
      })) ?? []
  );
}
