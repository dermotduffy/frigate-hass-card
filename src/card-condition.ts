import {
  FrigateCardCondition,
  FrigateCardConfig,
  frigateConditionalSchema,
  OverrideConfigurationKey,
  RawFrigateCardConfig,
} from './types';
import { HassEntities } from 'home-assistant-js-websocket';
import merge from 'lodash-es/merge';
import { copyConfig } from './config-mgmt';

export interface ConditionState {
  view?: string;
  fullscreen?: boolean;
  camera?: string;
  state?: HassEntities;
  mediaLoaded?: boolean;
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
  if (condition?.mediaLoaded !== undefined) {
    result &&=
      state.mediaLoaded !== undefined && condition.mediaLoaded == state.mediaLoaded;
  }
  if (condition?.media_query) {
    result &&= window.matchMedia(condition.media_query).matches;
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
  const output = copyConfig(config);
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

export class CardConditionManager {
  // Whether or not to include HA state in ConditionState. Doing so increases
  // CPU usage as HA state is pumped out very fast, so this is only enabled if
  // the configuration needs to consume it.
  protected _hasHAStateConditions = false;

  protected _callback: () => void;
  protected _mediaQueries: MediaQueryList[] = [];
  protected _boundTriggerChange = this._triggerChange.bind(this);

  constructor(config: FrigateCardConfig, callback: () => void) {
    this._initConditions(config);
    this._callback = callback;
  }

  /**
   * Destroy the object.
   */
  public destroy(): void {
    this._mediaQueries.forEach((mql) =>
      mql.removeEventListener('change', this._boundTriggerChange),
    );
    this._mediaQueries = [];
  }

  /**
   * Determine if the conditions have state conditions.
   */
  get hasHAStateConditions(): boolean {
    return this._hasHAStateConditions;
  }

  /**
   * Trigger the callback.
   * @param _ Ignored parameter.
   */
  protected _triggerChange(_): void {
    this._callback();
  }

  /**
   * Init the conditions.
   * @param config The card configuration.
   */
  protected _initConditions(config: FrigateCardConfig): void {
    const getAllConditions = (config: FrigateCardConfig): FrigateCardCondition[] => {
      const conditions: FrigateCardCondition[] = [];
      config.overrides?.forEach((override) => conditions.push(override.conditions));

      // Element conditions can be arbitrarily nested underneath conditionals and
      // custom elements that this card may not known. Here we recursively parse
      // down the elements tree, parsing as we go to find valid conditions.
      const getElementsConditions = (data: unknown): void => {
        const parseResult = frigateConditionalSchema.safeParse(data);
        if (parseResult.success) {
          conditions.push(parseResult.data.conditions);
          parseResult.data.elements?.forEach(getElementsConditions);
        } else if (data && typeof data === 'object') {
          Object.keys(data).forEach((key) => getElementsConditions(data[key]));
        }
      };
      config.elements?.forEach(getElementsConditions);
      return conditions;
    };

    const conditions = getAllConditions(config);
    this._hasHAStateConditions = conditions.some(
      (condition) => !!condition.state?.length,
    );
    conditions.forEach((condition) => {
      if (condition.media_query) {
        const mql = window.matchMedia(condition.media_query);
        mql.addEventListener('change', this._boundTriggerChange);
        this._mediaQueries.push(mql);
      }
    });
  }
}
