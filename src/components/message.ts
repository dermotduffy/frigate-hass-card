import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { TROUBLESHOOTING_URL } from '../const.js';
import { localize } from '../localize/localize.js';
import messageStyle from '../scss/message.scss';
import { FrigateCardError, Message } from '../types.js';
import { dispatchFrigateCardEvent } from '../utils/basic.js';

@customElement('frigate-card-message')
export class FrigateCardMessage extends LitElement {
  @property({ attribute: false })
  protected message = '';

  @property({ attribute: false })
  protected context?: unknown;

  @property({ attribute: false })
  protected icon?: string;

  // Render the menu.
  protected render(): TemplateResult {
    const icon = this.icon ? this.icon : 'mdi:information-outline';
    return html` <div class="wrapper">
      <div class="message">
        <div class="icon">
          <ha-icon icon="${icon}"> </ha-icon>
        </div>
        <div class="contents">
          <span> ${this.message ? html`${this.message}` : ''} </span>
          ${this.context
            ? html`<pre>${JSON.stringify(this.context, null, 2)}</pre>`
            : ''}
        </div>
      </div>
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(messageStyle);
  }
}

@customElement('frigate-card-error-message')
export class FrigateCardErrorMessage extends LitElement {
  @property({ attribute: false })
  protected message?: Message;

  protected render(): TemplateResult | void {
    if (!this.message) {
      return;
    }
    return html` <frigate-card-message
      .message=${html` ${this.message.message}.
        <a href="${TROUBLESHOOTING_URL}"> ${localize('error.troubleshooting')}</a>.`}
      .icon=${'mdi:alert-circle'}
      .context=${this.message.context}
    >
    </frigate-card-message>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(messageStyle);
  }
}

@customElement('frigate-card-progress-indicator')
export class FrigateCardProgressIndicator extends LitElement {
  @property({ attribute: false })
  protected message = '';

  protected render(): TemplateResult {
    return html` <div class="message vertical">
      <span>
        <ha-circular-progress active="true" size="large"> </ha-circular-progress>
      </span>
      ${this.message ? html`<span>${this.message}</span>` : html``}
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(messageStyle);
  }
}

export function renderMessage(message: Message): TemplateResult {
  if (message.type == 'error') {
    return html` <frigate-card-error-message
      .message=${message}
    ></frigate-card-error-message>`;
  } else if (message.type == 'info') {
    return html` <frigate-card-message
      .message=${message.message}
      .icon=${message.icon}
      .context=${message.context}
    ></frigate-card-message>`;
  }
  return html``;
}

export function renderProgressIndicator(message?: string): TemplateResult {
  return html`
    <frigate-card-progress-indicator .message=${message || ''}>
    </frigate-card-progress-indicator>
  `;
}

/**
 * Dispatch an event with a message to show to the user.
 * @param element The element to send the event.
 * @param message The message to show.
 * @param icon An optional icon to attach to the message.
 */
export function dispatchMessageEvent(
  element: HTMLElement,
  message: string,
  icon?: string,
  context?: unknown,
): void {
  dispatchFrigateCardEvent<Message>(element, 'message', {
    message: message,
    type: 'info',
    icon: icon,
    context: context,
  });
}

/**
 * Dispatch an event with an error message to show to the user.
 * @param element The element to send the event.
 * @param message The message to show.
 */
export function dispatchErrorMessageEvent(
  element: HTMLElement,
  message: string,
  context?: unknown,
): void {
  dispatchFrigateCardEvent<Message>(element, 'message', {
    message: message,
    type: 'error',
    context: context,
  });
}

/**
 * Dispatch an event with an error message to show to the user.
 * @param element The element to send the event.
 * @param message The message to show.
 */
export function dispatchFrigateCardErrorEvent(
  element: HTMLElement,
  error: FrigateCardError
): void {
  dispatchFrigateCardEvent<Message>(element, 'message', {
    message: error.message,
    type: 'error',
    context: error.context || ''
  });
}
