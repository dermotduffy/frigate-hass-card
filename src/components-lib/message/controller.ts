import yaml from 'js-yaml';
import { TROUBLESHOOTING_URL } from '../../const';
import { Message } from '../../types';

export class MessageController {
  public getMessageString(message: Message): string {
    return (
      message.message +
      (message.context && typeof message.context === 'string'
        ? ': ' + message.context
        : '')
    );
  }

  public getIcon(message: Message): string {
    return message.icon
      ? message.icon
      : message.type === 'error'
        ? 'mdi:alert-circle'
        : 'mdi:information-outline';
  }

  public shouldShowTroubleshootingURL(message: Message): boolean {
    return message.type === 'error';
  }

  public getTroubleshootingURL(message: Message): string {
    return message.troubleshootingURL ?? TROUBLESHOOTING_URL;
  }

  public getContextStrings(message: Message): string[] {
    if (Array.isArray(message.context)) {
      return message.context.map((contextItem) => yaml.dump(contextItem));
    }
    if (typeof message.context === 'object') {
      return [yaml.dump(message.context)];
    }
    if (typeof message.context === 'string') {
      return [message.context];
    }
    return [];
  }
}
