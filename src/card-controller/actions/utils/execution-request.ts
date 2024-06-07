import { dispatchFrigateCardEvent } from '../../../utils/basic';
import { ActionExecutionRequest } from '../types';

export const dispatchActionExecutionRequest = (
  element: HTMLElement,
  request: ActionExecutionRequest,
) => {
  dispatchFrigateCardEvent(element, 'action:execution-request', request);
};

export interface ActionExecutionRequestEventTarget extends EventTarget {
  addEventListener(
    event: 'frigate-card:action:execution-request',
    listener: (
      this: ActionExecutionRequestEventTarget,
      ev: CustomEvent<ActionExecutionRequest>,
    ) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void;
  removeEventListener(
    event: 'frigate-card:action:execution-request',
    listener: (
      this: ActionExecutionRequestEventTarget,
      ev: CustomEvent<ActionExecutionRequest>,
    ) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}
