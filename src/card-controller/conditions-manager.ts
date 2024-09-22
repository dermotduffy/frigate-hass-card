import { CurrentUser } from '@dermotduffy/custom-card-helpers';
import { HassEntities } from 'home-assistant-js-websocket';
import isEqual from 'lodash-es/isEqual';
import merge from 'lodash-es/merge';
import { ZodSchema } from 'zod';
import {
  copyConfig,
  deleteConfigValue,
  getConfigValue,
  setConfigValue,
} from '../config/management';
import {
  FrigateCardCondition,
  frigateConditionalSchema,
  Overrides,
  RawFrigateCardConfig,
  ViewDisplayMode,
} from '../config/types';
import { localize } from '../localize/localize';
import { FrigateCardError } from '../types';
import { desparsifyArrays } from '../utils/basic';
import { CardConditionAPI, KeysState } from './types';

interface MicrophoneConditionState {
  connected?: boolean;
  muted?: boolean;
}

interface ConditionState {
  view?: string;
  fullscreen?: boolean;
  expand?: boolean;
  camera?: string;
  state?: HassEntities;
  media_loaded?: boolean;
  displayMode?: ViewDisplayMode;
  triggered?: Set<string>;
  interaction?: boolean;
  microphone?: MicrophoneConditionState;
  user?: CurrentUser;
  keys?: KeysState;
}

class OverrideConfigurationError extends FrigateCardError {}

export class ConditionsEvaluateRequestEvent extends Event {
  public conditions: FrigateCardCondition[];
  public evaluation?: boolean;

  constructor(conditions: FrigateCardCondition[], eventInitDict?: EventInit) {
    super('frigate-card:conditions:evaluate', eventInitDict);
    this.conditions = conditions;
  }
}

/**
 * Evaluate whether a frigateCardCondition is met using an event to evaluate.
 * @returns A boolean indicating whether the condition is met.
 */
export function evaluateConditionViaEvent(
  element: HTMLElement,
  conditions?: FrigateCardCondition[],
): boolean {
  if (!conditions) {
    return true;
  }

  const evaluateEvent = new ConditionsEvaluateRequestEvent(conditions, {
    bubbles: true,
    composed: true,
  });

  /* Special note on what's going on here:
   *
   * Some parts of the card (e.g. <frigate-card-elements>) may have arbitrary
   * complexity and layers (that this card doesn't control) between that master
   * element and the element that needs to evaluate the condition. In these
   * cases there's no clean way to pass state from the rest of card down through
   * these layers. Instead, an event is dispatched as a "request for evaluation"
   * (ConditionEvaluateRequestEvent) upwards which is caught by the outer card
   * and the evaluation result is added to the event object. Because event
   * propagation is handled synchronously, the result will be added to the event
   * before the flow proceeds.
   */
  element.dispatchEvent(evaluateEvent);
  return evaluateEvent.evaluation ?? false;
}

export function getOverriddenConfig<RT extends RawFrigateCardConfig>(
  manager: Readonly<ConditionsManager>,
  config: Readonly<RT>,
  options?: {
    configOverrides?: Readonly<Overrides>;
    stateOverrides?: Partial<ConditionState>;
    schema?: ZodSchema;
  },
): RT {
  let output = copyConfig(config);
  let overridden = false;
  if (options?.configOverrides) {
    for (const override of options.configOverrides) {
      if (manager.evaluateConditions(override.conditions, options?.stateOverrides)) {
        override.delete?.forEach((deletionKey) => {
          deleteConfigValue(output, deletionKey);
        });

        Object.keys(override.set ?? {}).forEach((setKey) => {
          setConfigValue(output, setKey, override.set?.[setKey]);
        });

        Object.keys(override.merge ?? {}).forEach((mergeKey) => {
          setConfigValue(
            output,
            mergeKey,
            merge({}, getConfigValue(output, mergeKey), override.merge?.[mergeKey]),
          );
        });

        overridden = true;
      }
    }
  }

  if (!overridden) {
    // Attempt to return the same configuration object if it has not been
    // overridden (to reduce re-renders for a configuration that has not changed).
    return config;
  }

  if (options?.configOverrides?.some((override) => override.delete?.length)) {
    // If anything was deleted during this override, empty undefined slots may
    // be left in arrays where values were unset. Desparsify them.
    output = desparsifyArrays(output);
  }

  if (options?.schema) {
    const parseResult = options.schema.safeParse(output);
    if (!parseResult.success) {
      throw new OverrideConfigurationError(
        localize('error.invalid_configuration_override'),
        [parseResult.error.errors, output],
      );
    }
    return parseResult.data;
  }
  return output;
}

// A tiny wrapper interface to allow the same manager to be passed around
// immutably within objects that will not be equal (===). Every state change
// generates a new epoch. This is used for Lit rendering to ensure changes to
// condition state are recognized as changes even though the manager is the
// same.
export interface ConditionsManagerEpoch {
  manager: Readonly<ConditionsManager>;
}

export type ConditionsManagerListener = () => void;

export class ConditionsManager {
  protected _api: CardConditionAPI;

  protected _state: ConditionState = {};
  protected _epoch: ConditionsManagerEpoch = this._createEpoch();
  protected _listeners: ConditionsManagerListener[];

  // Whether or not to include HA state in ConditionState. Doing so increases
  // CPU usage as HA state is pumped out very fast, so this is only enabled if
  // the configuration needs to consume it.
  protected _hasHAStateConditions = false;
  protected _mediaQueries: MediaQueryList[] = [];
  protected _mediaQueryTrigger = () => this._triggerChange();

  constructor(api: CardConditionAPI, listener?: ConditionsManagerListener) {
    this._api = api;
    this._listeners = [
      () => this._api.getConfigManager().computeOverrideConfig(),
      () => this._api.getAutomationsManager().execute(),
      ...(listener ? [listener] : []),
    ];
  }

  public removeConditions(): void {
    this._mediaQueries.forEach((mql) =>
      mql.removeEventListener('change', this._mediaQueryTrigger),
    );
    this._mediaQueries = [];
  }

  public setConditionsFromConfig(): void {
    this.removeConditions();

    const getAllConditions = (): FrigateCardCondition[] => {
      const config = this._api.getConfigManager().getConfig();
      const conditions: FrigateCardCondition[] = [];
      config?.overrides?.forEach((override) => conditions.push(...override.conditions));
      config?.automations?.forEach((automation) =>
        conditions.push(...automation.conditions),
      );

      // Element conditions can be arbitrarily nested underneath conditionals and
      // custom elements that this card may not known. Here we recursively parse
      // down the elements tree, parsing as we go to find valid conditions.
      const getElementsConditions = (data: unknown): void => {
        const parseResult = frigateConditionalSchema.safeParse(data);
        if (parseResult.success) {
          conditions.push(...parseResult.data.conditions);
          parseResult.data.elements?.forEach(getElementsConditions);
        } else if (data && typeof data === 'object') {
          Object.keys(data).forEach((key) => getElementsConditions(data[key]));
        }
      };
      config?.elements?.forEach(getElementsConditions);
      return conditions;
    };

    const conditions = getAllConditions();
    this._hasHAStateConditions = conditions.some(
      (conditionObj) =>
        !conditionObj.condition ||
        ['state', 'numeric_state', 'user'].includes(conditionObj.condition),
    );
    conditions.forEach((conditionObj) => {
      if (conditionObj.condition === 'screen') {
        const mql = window.matchMedia(conditionObj.media_query);
        mql.addEventListener('change', this._mediaQueryTrigger);
        this._mediaQueries.push(mql);
      }
    });
  }

  public setState(state: Partial<ConditionState>): void {
    // Performance: Compare the new state with the existing state and only
    // trigger a change if the new state is different. Only the new keys are
    // compared, since some of the values (e.g. 'state') will be large.
    if (Object.keys(state).every((key) => isEqual(state[key], this._state[key]))) {
      return;
    }

    this._state = {
      ...this._state,
      ...state,
    };
    this._triggerChange();
  }

  public getState(): ConditionState {
    return this._state;
  }

  public hasHAStateConditions(): boolean {
    return this._hasHAStateConditions;
  }

  public getEpoch(): ConditionsManagerEpoch {
    return this._epoch;
  }

  public evaluateConditions(
    conditions: Readonly<FrigateCardCondition>[],
    stateOverrides?: Partial<ConditionState>,
  ): boolean {
    return conditions.every((conditionObj) =>
      this._evaluateCondition(conditionObj, stateOverrides),
    );
  }

  protected _evaluateCondition(
    conditionObj: Readonly<FrigateCardCondition>,
    stateOverrides?: Partial<ConditionState>,
  ): boolean {
    const state = {
      ...this._state,
      ...stateOverrides,
    };

    switch (conditionObj.condition) {
      case undefined:
      case 'state':
        return (
          !!state.state &&
          ((!conditionObj.state && !conditionObj.state_not) ||
            (conditionObj.entity in state.state &&
              (!conditionObj.state ||
                (Array.isArray(conditionObj.state)
                  ? conditionObj.state.includes(state.state[conditionObj.entity].state)
                  : conditionObj.state === state.state[conditionObj.entity].state)) &&
              (!conditionObj.state_not ||
                (Array.isArray(conditionObj.state_not)
                  ? !conditionObj.state_not.includes(
                      state.state[conditionObj.entity].state,
                    )
                  : conditionObj.state_not !== state.state[conditionObj.entity].state))))
        );
      case 'view':
        return !!state?.view && conditionObj.views.includes(state.view);
      case 'fullscreen':
        return (
          state.fullscreen !== undefined && conditionObj.fullscreen === state.fullscreen
        );
      case 'expand':
        return state.expand !== undefined && conditionObj.expand === state.expand;
      case 'camera':
        return !!state.camera && conditionObj.cameras.includes(state.camera);
      case 'numeric_state':
        return (
          !!state.state &&
          conditionObj.entity in state.state &&
          state.state[conditionObj.entity].state !== undefined &&
          (conditionObj.above === undefined ||
            Number(state.state[conditionObj.entity].state) > conditionObj.above) &&
          (conditionObj.below === undefined ||
            Number(state.state[conditionObj.entity].state) < conditionObj.below)
        );
      case 'user':
        return !!state.user && conditionObj.users.includes(state.user.id);
      case 'media_loaded':
        return (
          state.media_loaded !== undefined &&
          conditionObj.media_loaded === state.media_loaded
        );
      case 'screen':
        return window.matchMedia(conditionObj.media_query).matches;
      case 'display_mode':
        return !!state.displayMode && conditionObj.display_mode === state.displayMode;
      case 'triggered':
        return conditionObj.triggered.some((triggeredCameraID) =>
          state.triggered?.has(triggeredCameraID),
        );
      case 'interaction':
        return (
          state.interaction !== undefined &&
          conditionObj.interaction === state.interaction
        );
      case 'microphone':
        return (
          (conditionObj.connected === undefined ||
            state.microphone?.connected === conditionObj.connected) &&
          (conditionObj.muted === undefined ||
            state.microphone?.muted === conditionObj.muted)
        );
      case 'key':
        return (
          !!state.keys &&
          conditionObj.key in state.keys &&
          (conditionObj.state ?? 'down') === state.keys[conditionObj.key].state &&
          (conditionObj.ctrl === undefined ||
            conditionObj.ctrl === !!state.keys[conditionObj.key].ctrl) &&
          (conditionObj.alt === undefined ||
            conditionObj.alt === !!state.keys[conditionObj.key].alt) &&
          (conditionObj.meta === undefined ||
            conditionObj.meta === !!state.keys[conditionObj.key].meta) &&
          (conditionObj.shift === undefined ||
            conditionObj.shift === !!state.keys[conditionObj.key].shift)
        );
    }
  }

  protected _createEpoch(): ConditionsManagerEpoch {
    return { manager: this };
  }

  protected _triggerChange(): void {
    this._epoch = this._createEpoch();
    this._listeners.forEach((listener) => listener());
  }
}
