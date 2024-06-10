import {
  FrigateCardError,
  MESSAGE_TYPE_PRIORITIES,
  Message,
  MessageType,
} from '../types';
import { errorToConsole } from '../utils/basic';
import { CardMessageAPI } from './types';

export class MessageManager {
  protected _message: Message | null = null;
  protected _api: CardMessageAPI;

  constructor(api: CardMessageAPI) {
    this._api = api;
  }

  public getMessage(): Message | null {
    return this._message;
  }

  public hasMessage(): boolean {
    return !!this._message;
  }

  public hasErrorMessage(): boolean {
    return this._message?.type === 'error';
  }

  public reset(): void {
    const hadMessage = this.hasMessage();
    this._message = null;

    if (hadMessage) {
      this._api.getCardElementManager().update();
    }
  }

  public resetType(type: MessageType): void {
    if (this._message?.type === type) {
      this.reset();
    }
  }

  public setErrorIfHigherPriority(error: unknown): void {
    // This object should accept unknown objects to be able to seamlessly
    // process arguments to catch() which can only be unknown/any.
    if (!(error instanceof Error)) {
      return;
    }

    errorToConsole(error);
    this.setMessageIfHigherPriority({
      message: error.message,
      type: 'error',
      ...(error instanceof FrigateCardError && { context: error.context }),
    });
  }

  public setMessageIfHigherPriority(message: Message): boolean {
    const currentPriority = this._message
      ? MESSAGE_TYPE_PRIORITIES[this._message.type]
      : 0;
    const newPriority = MESSAGE_TYPE_PRIORITIES[message.type];

    if (this._message && newPriority < currentPriority) {
      return false;
    }

    this._message = message;

    // When a message is displayed it effectively unloads the media.
    this._api.getMediaLoadedInfoManager().clear();
    this._api.getCardElementManager().scrollReset();
    this._api.getCardElementManager().update();
    return true;
  }
}
