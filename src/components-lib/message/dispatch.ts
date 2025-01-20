import { FrigateCardError, Message } from '../../types';
import { dispatchFrigateCardEvent } from '../../utils/basic';

// Facilitates correct typing of event handlers.
export interface FrigateCardMessageEventTarget extends EventTarget {
  addEventListener(
    event: 'frigate-card:message',
    listener: (this: FrigateCardMessageEventTarget, ev: CustomEvent<Message>) => void,
    options?: AddEventListenerOptions | boolean,
  ): void;
  addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: AddEventListenerOptions | boolean,
  ): void;
  removeEventListener(
    event: 'frigate-card:message',
    listener: (this: FrigateCardMessageEventTarget, ev: CustomEvent<Message>) => void,
    options?: boolean | EventListenerOptions,
  ): void;
  removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject,
    options?: boolean | EventListenerOptions,
  ): void;
}

/**
 * Dispatch an event with an error message to show to the user. Calling this
 * method will grind the card to a halt, so should only be used for "global" /
 * critical errors (i.e. not for individual errors with a given camera, since
 * there may be multiple correctly functioning cameras in a grid).
 * @param element The element to send the event.
 * @param message The message to show.
 */
export const dispatchFrigateCardErrorEvent = (
  element: EventTarget,
  error: unknown,
): void => {
  if (error instanceof Error) {
    dispatchFrigateCardEvent<Message>(element, 'message', {
      message: error.message,
      type: 'error',
      ...(error instanceof FrigateCardError && { context: error.context }),
    });
  }
};
