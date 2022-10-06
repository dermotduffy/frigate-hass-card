import { Task } from '@lit-labs/task';
import { html, TemplateResult } from 'lit';
import {
  dispatchFrigateCardErrorEvent,
  renderProgressIndicator,
} from '../components/message';
import { CardWideConfig } from '../types';
import { errorToConsole } from './basic';

/**
 * Render the result of a Lit task.
 * @param host The host object.
 * @param task The Lit task.
 * @param completeFunc The function to call with the result.
 * @param inProgressFunc The function to call whilst in progress.
 * @returns A template.
 */
export const renderTask = <R>(
  host: EventTarget,
  task: Task<unknown[], R>,
  completeFunc: (result: R) => TemplateResult | void,
  options?: {
    cardWideConfig?: CardWideConfig;
    inProgressFunc?: () => TemplateResult | void;
  },
): TemplateResult => {
  const progressConfig = {
    ...(options?.cardWideConfig && { cardWideConfig: options.cardWideConfig }),
  };
  return html` ${task.render({
    initial: () =>
      options?.inProgressFunc?.() ?? renderProgressIndicator(progressConfig),
    pending: () =>
      options?.inProgressFunc?.() ?? renderProgressIndicator(progressConfig),
    error: (e: unknown) => {
      errorToConsole(e as Error);
      dispatchFrigateCardErrorEvent(host, e as Error);
    },
    complete: completeFunc,
  })}`;
};
