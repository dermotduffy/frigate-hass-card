import { Task } from '@lit-labs/task';
import { html, TemplateResult } from 'lit';
import {
  dispatchFrigateCardErrorEvent,
  renderProgressIndicator,
} from '../components/message';
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
  inProgressFunc?: () => TemplateResult | void,
): TemplateResult => {
  return html` ${task.render({
    initial: () => inProgressFunc?.() ?? renderProgressIndicator(),
    pending: () => inProgressFunc?.() ?? renderProgressIndicator(),
    error: (e: unknown) => {
      errorToConsole(e as Error);
      dispatchFrigateCardErrorEvent(host, e as Error);
    },
    complete: completeFunc,
  })}`;
};
