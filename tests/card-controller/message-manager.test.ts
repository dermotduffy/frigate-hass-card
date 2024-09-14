import { afterAll, describe, expect, it, vi } from 'vitest';
import { FrigateCardError, Message } from '../../src/types';
import { MessageManager } from '../../src/card-controller/message-manager';
import { createCardAPI } from '../test-utils';

const createMessage = (options?: Partial<Message>): Message => {
  return {
    message: options?.message ?? 'message',
    type: options?.type ?? 'info',
    ...(!!options?.icon && { icon: options.icon }),
    ...(!!options?.context && { context: options.context }),
    ...(!!options?.dotdotdot && { dotdotdot: options.dotdotdot }),
  };
};

describe('MessageManager', () => {
  afterAll(() => {
    vi.restoreAllMocks();
  });

  it('should construct', () => {
    const manager = new MessageManager(createCardAPI());
    expect(manager.hasMessage()).toBeFalsy();
    expect(manager.getMessage()).toBeNull();
    expect(manager.hasErrorMessage()).toBeFalsy();
  });

  it('should set info message', () => {
    const api = createCardAPI();
    const manager = new MessageManager(api);
    const message = createMessage();
    manager.setMessageIfHigherPriority(message);
    expect(manager.hasMessage()).toBeTruthy();
    expect(manager.getMessage()).toBe(message);
    expect(manager.hasErrorMessage()).toBeFalsy();

    expect(api.getMediaLoadedInfoManager().clear).toBeCalled();
    expect(api.getCardElementManager().scrollReset).toBeCalled();
    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should set error message', () => {
    const api = createCardAPI();
    const manager = new MessageManager(api);
    const message = createMessage({ type: 'error' });
    manager.setMessageIfHigherPriority(message);
    expect(manager.hasMessage()).toBeTruthy();
    expect(manager.getMessage()).toBe(message);
    expect(manager.hasErrorMessage()).toBeTruthy();

    expect(api.getMediaLoadedInfoManager().clear).toBeCalled();
    expect(api.getCardElementManager().scrollReset).toBeCalled();
    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should reset message', () => {
    const api = createCardAPI();
    const manager = new MessageManager(api);

    manager.reset();
    expect(manager.hasMessage()).toBeFalsy();

    const message = createMessage({ type: 'error' });
    manager.setMessageIfHigherPriority(message);
    expect(manager.hasMessage()).toBeTruthy();

    vi.mocked(api.getCardElementManager().update).mockClear();
    manager.reset();

    expect(manager.hasMessage()).toBeFalsy();
    expect(api.getCardElementManager().update).toBeCalled();
  });

  it('should reset message that matches type', () => {
    const api = createCardAPI();
    const manager = new MessageManager(api);

    const message = createMessage({ type: 'connection' });
    manager.setMessageIfHigherPriority(message);
    expect(manager.getMessage()).toBe(message);

    manager.resetType('error');
    expect(manager.getMessage()).toBe(message);

    manager.resetType('connection');
    expect(manager.getMessage()).toBeNull();
    expect(manager.hasMessage()).toBeFalsy();
  });

  it('should respect priority', () => {
    const api = createCardAPI();
    const manager = new MessageManager(api);

    manager.reset();
    expect(manager.hasMessage()).toBeFalsy();

    const errorMessage = createMessage({ type: 'error' });
    manager.setMessageIfHigherPriority(errorMessage);

    const infoMessage = createMessage({ type: 'info' });
    manager.setMessageIfHigherPriority(infoMessage);

    expect(manager.getMessage()).toBe(errorMessage);

    const connectionMessage = createMessage({ type: 'connection' });
    manager.setMessageIfHigherPriority(connectionMessage);

    expect(manager.getMessage()).toBe(connectionMessage);
  });

  it('should set FrigateCardError object', () => {
    const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

    const api = createCardAPI();
    const manager = new MessageManager(api);
    const context = { foo: 'bar' };

    manager.setErrorIfHigherPriority(
      new FrigateCardError('frigate card message', context),
    );
    expect(manager.hasMessage()).toBeTruthy();
    expect(manager.getMessage()).toEqual({
      message: 'frigate card message',
      type: 'error',
      context: context,
    });

    expect(consoleSpy).toBeCalled();
  });

  it('should set Error object', () => {
    const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

    const api = createCardAPI();
    const manager = new MessageManager(api);

    manager.setErrorIfHigherPriority(new Error('generic error message'));
    expect(manager.hasMessage()).toBeTruthy();
    expect(manager.getMessage()).toEqual({
      message: 'generic error message',
      type: 'error',
    });

    expect(consoleSpy).toBeCalled();
  });

  it('should set error with prefix', () => {
    const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

    const api = createCardAPI();
    const manager = new MessageManager(api);

    manager.setErrorIfHigherPriority(new Error('generic error message'), 'PREFIX');
    expect(manager.hasMessage()).toBeTruthy();
    expect(manager.getMessage()).toEqual({
      message: 'PREFIX: generic error message',
      type: 'error',
    });

    expect(consoleSpy).toBeCalled();
  });

  it('should not set unknown error type', () => {
    const consoleSpy = vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

    const api = createCardAPI();
    const manager = new MessageManager(api);

    manager.setErrorIfHigherPriority('not_an_error_object');
    expect(manager.hasMessage()).toBeFalsy();
    expect(consoleSpy).not.toBeCalled();
  });
});
