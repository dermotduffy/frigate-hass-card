import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ClassInfo, classMap } from 'lit/directives/class-map.js';
import { ref, Ref } from 'lit/directives/ref.js';
import { TROUBLESHOOTING_URL } from '../const.js';
import { localize } from '../localize/localize.js';
import messageStyle from '../scss/message.scss';
import { CardWideConfig, FrigateCardError, Message, MessageType } from '../types.js';
import { dispatchFrigateCardEvent } from '../utils/basic.js';

@customElement('frigate-card-message')
export class FrigateCardMessage extends LitElement {
  @property({ attribute: false })
  public message: string | TemplateResult<1> = '';

  @property({ attribute: false })
  public context?: unknown;

  @property({ attribute: false })
  public icon?: string;

  @property({ attribute: true, type: Boolean })
  public dotdotdot?: boolean;

  // Render the menu.
  protected render(): TemplateResult {
    const icon = this.icon ? this.icon : 'mdi:information-outline';
    const classes = {
      dotdotdot: !!this.dotdotdot,
    };
    return html` <div class="wrapper">
      <div class="message padded">
        <div class="icon">
          <ha-icon icon="${icon}"> </ha-icon>
        </div>
        <div class="contents">
          <span class="${classMap(classes)}">
            ${this.message
              ? html`${this.message}${this.context && typeof this.context === 'string'
                  ? ': ' + this.context
                  : ''}`
              : ''}
          </span>
          ${this.context && typeof this.context !== 'string'
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
  public message?: Message;

  protected render(): TemplateResult | void {
    if (!this.message) {
      return;
    }
    return html` <frigate-card-message
      .message=${html` ${this.message.message}.
        <a href="${TROUBLESHOOTING_URL}"> ${localize('error.troubleshooting')}</a>.`}
      .icon=${'mdi:alert-circle'}
      .context=${this.message.context}
      .dotdotdot=${this.message.dotdotdot}
    >
    </frigate-card-message>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(messageStyle);
  }
}

type FrigateCardProgressIndicatorSize = 'tiny' | 'small' | 'medium' | 'large';

@customElement('frigate-card-progress-indicator')
export class FrigateCardProgressIndicator extends LitElement {
  @property({ attribute: false })
  public message: string | TemplateResult = '';

  @property({ attribute: false })
  public animated = false;

  @property({ attribute: false })
  public size: FrigateCardProgressIndicatorSize = 'large';

  protected render(): TemplateResult {
    return html` <div class="message vertical">
      ${this.animated
        ? html`<ha-circular-progress active="true" size="${this.size}">
          </ha-circular-progress>`
        : html`<ha-icon icon="mdi:timer-sand"></ha-icon>`}
      ${this.message ? html`<span>${this.message}</span>` : html``}
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(messageStyle);
  }
}

export function renderMessage(message: Message): TemplateResult {
  if (message.type === 'error') {
    return html` <frigate-card-error-message
      .message=${message}
    ></frigate-card-error-message>`;
  } else {
    return html` <frigate-card-message
      .message=${message.message}
      .icon=${message.icon}
      .context=${message.context}
      .dotdotdot=${message.dotdotdot}
    ></frigate-card-message>`;
  }
  return html``;
}

export function renderProgressIndicator(options?: {
  message?: string;
  cardWideConfig?: CardWideConfig;
  componentRef?: Ref<HTMLElement>;
  classes?: ClassInfo;
  size?: FrigateCardProgressIndicatorSize;
}): TemplateResult {
  return html`
    <frigate-card-progress-indicator
      class="${classMap(options?.classes ?? {})}"
      .size=${options?.size}
      ${options?.componentRef ? ref(options.componentRef) : ''}
      .message=${options?.message || ''}
      .animated=${options?.cardWideConfig?.performance?.features
        .animated_progress_indicator ?? true}
    >
    </frigate-card-progress-indicator>
  `;
}

/**
 * Dispatch an event with a message to show to the user.
 * @param element The element to send the event.
 * @param message The message to show.
 * @param options Optional icon and context to include.
 */
export function dispatchMessageEvent(
  element: EventTarget,
  message: string,
  type: MessageType,
  options?: {
    icon?: string;
    context?: unknown;
  },
): void {
  dispatchFrigateCardEvent<Message>(element, 'message', {
    message: message,
    type: type,
    icon: options?.icon,
    context: options?.context,
  });
}

/**
 * Dispatch an event with an error message to show to the user.
 * @param element The element to send the event.
 * @param message The message to show.
 * @param options Optional context to include.
 */
export function dispatchErrorMessageEvent(
  element: EventTarget,
  message: string,
  options?: {
    context?: unknown;
  },
): void {
  dispatchMessageEvent(element, message, 'error', {
    context: options?.context,
  });
}

/**
 * Dispatch an event with an error message to show to the user.
 * @param element The element to send the event.
 * @param message The message to show.
 */
export function dispatchFrigateCardErrorEvent(
  element: EventTarget,
  error: unknown,
): void {
  if (error instanceof Error) {
    dispatchErrorMessageEvent(element, error.message, {
      ...(error instanceof FrigateCardError && { context: error.context }),
    });
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-progress-indicator': FrigateCardProgressIndicator;
    'frigate-card-error-message': FrigateCardErrorMessage;
    'frigate-card-message': FrigateCardMessage;
  }
}
