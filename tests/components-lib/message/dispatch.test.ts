import { expect, it, vi } from 'vitest';
import { dispatchFrigateCardErrorEvent } from '../../../src/components-lib/message/dispatch';
import { FrigateCardError } from '../../../src/types';

// @vitest-environment jsdom
it('should ignore non-error', () => {
  const element = document.createElement('div');
  const handler = vi.fn();
  element.addEventListener('frigate-card:message', handler);

  dispatchFrigateCardErrorEvent(element, 'NOT_FRIGATE_EVENT');

  expect(handler).not.toBeCalled();
});

it('should dispatch error', () => {
  const element = document.createElement('div');
  const handler = vi.fn();
  element.addEventListener('frigate-card:message', handler);

  dispatchFrigateCardErrorEvent(element, new Error('ERROR'));

  expect(handler).toBeCalledWith(
    expect.objectContaining({
      detail: expect.objectContaining({
        message: 'ERROR',
      }),
    }),
  );
});

it('should dispatch error with context', () => {
  const element = document.createElement('div');
  const handler = vi.fn();
  element.addEventListener('frigate-card:message', handler);

  dispatchFrigateCardErrorEvent(element, new FrigateCardError('ERROR', 'CONTEXT'));

  expect(handler).toBeCalledWith(
    expect.objectContaining({
      detail: expect.objectContaining({
        message: 'ERROR',
        context: 'CONTEXT',
      }),
    }),
  );
});
