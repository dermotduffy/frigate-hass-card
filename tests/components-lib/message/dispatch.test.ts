import { expect, it, vi } from 'vitest';
import { dispatchAdvancedCameraCardErrorEvent } from '../../../src/components-lib/message/dispatch';
import { AdvancedCameraCardError } from '../../../src/types';

// @vitest-environment jsdom
it('should ignore non-error', () => {
  const element = document.createElement('div');
  const handler = vi.fn();
  element.addEventListener('advanced-camera-card:message', handler);

  dispatchAdvancedCameraCardErrorEvent(element, 'NOT_ADVANCED_CAMERA_CARD_EVENT');

  expect(handler).not.toBeCalled();
});

it('should dispatch error', () => {
  const element = document.createElement('div');
  const handler = vi.fn();
  element.addEventListener('advanced-camera-card:message', handler);

  dispatchAdvancedCameraCardErrorEvent(element, new Error('ERROR'));

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
  element.addEventListener('advanced-camera-card:message', handler);

  dispatchAdvancedCameraCardErrorEvent(
    element,
    new AdvancedCameraCardError('ERROR', 'CONTEXT'),
  );

  expect(handler).toBeCalledWith(
    expect.objectContaining({
      detail: expect.objectContaining({
        message: 'ERROR',
        context: 'CONTEXT',
      }),
    }),
  );
});
