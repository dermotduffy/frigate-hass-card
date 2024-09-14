import { describe, expect, it, vi } from 'vitest';
import { createCameraConfig, createHASS, createStateEntity } from '../test-utils';
import { getStateObjOrDispatchError } from '../../src/utils/get-state-obj';

// @vitest-environment jsdom
describe('getStateObjOrDispatchError', () => {
  it('should retrieve valid state object', () => {
    const messageHandler = vi.fn();
    const element = document.createElement('div');
    element.addEventListener('frigate-card:message', messageHandler);
    const state = createStateEntity();

    expect(
      getStateObjOrDispatchError(
        element,
        createHASS({
          'camera.test': state,
        }),
        createCameraConfig({
          camera_entity: 'camera.test',
        }),
      ),
    ).toBe(state);

    expect(messageHandler).not.toBeCalled();
  });

  it('should dispatch unspecified entity', () => {
    const messageHandler = vi.fn();
    const element = document.createElement('div');
    element.addEventListener('frigate-card:message', messageHandler);

    expect(
      getStateObjOrDispatchError(element, createHASS(), createCameraConfig()),
    ).toBeNull();

    expect(messageHandler).toBeCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          message:
            'The camera_entity parameter must be set and valid for this live provider',
          type: 'error',
        }),
      }),
    );
  });

  it('should dispatch not found state', () => {
    const messageHandler = vi.fn();
    const element = document.createElement('div');
    element.addEventListener('frigate-card:message', messageHandler);

    expect(
      getStateObjOrDispatchError(
        element,
        createHASS(),
        createCameraConfig({
          camera_entity: 'camera.will-not-be-found',
        }),
      ),
    ).toBeNull();

    expect(messageHandler).toBeCalledWith(
      expect.objectContaining({
        detail: expect.objectContaining({
          message: 'The configured camera_entity was not found',
          type: 'error',
        }),
      }),
    );
  });
});
