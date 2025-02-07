import { dispatchAdvancedCameraCardEvent } from '../../../utils/basic';
import { ActionExecutionRequest } from '../types';

export const dispatchActionExecutionRequest = (
  element: HTMLElement,
  request: ActionExecutionRequest,
) => {
  dispatchAdvancedCameraCardEvent(element, 'action:execution-request', request);
};

export interface ActionExecutionRequestEventTarget extends EventTarget {
  addEventListener(
    event: 'advanced-camera-card:action:execution-request',
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
    event: 'advanced-camera-card:action:execution-request',
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
