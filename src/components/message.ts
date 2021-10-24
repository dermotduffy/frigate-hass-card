import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';

import { Message } from '../types.js';
import { TROUBLESHOOTING_URL } from '../const.js';
import { localize } from '../localize/localize.js';

import messageStyle from '../scss/message.scss';

@customElement('frigate-card-message')
export class FrigateCardMessage extends LitElement {
  @property({ attribute: false })
  protected message = '';

  @property({ attribute: false })
  protected icon?;

  // Render the menu.
  protected render(): TemplateResult {
    const icon = this.icon ? this.icon : 'mdi:information-outline';
    return html` <div class="message">
      <span>
        <ha-icon icon="${icon}"> </ha-icon>
      </span>
      <span>
        ${this.message ? html`${this.message}` : ''}
      </span>
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(messageStyle);
  }
}

@customElement('frigate-card-error-message')
export class FrigateCardErrorMessage extends LitElement {
  @property({ attribute: false })
  protected error = '';

  protected render(): TemplateResult {
    return html` <frigate-card-message
      .message=${html` ${this.error}.
        <a href="${TROUBLESHOOTING_URL}"> ${localize('error.troubleshooting')}</a>.`}
      .icon=${'mdi:alert-circle'}
    >
    </frigate-card-message>`;
  }
}

@customElement('frigate-card-progress-indicator')
export class FrigateCardProgressIndicator extends LitElement {
  protected render(): TemplateResult {
    return html` <div class="message">
      <ha-circular-progress active="true" size="large"> </ha-circular-progress>
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(messageStyle);
  }
}

export function renderMessage(message: Message): TemplateResult {
  if (message.type == 'error') {
    return html` <frigate-card-error-message
      .error=${message.message}
    ></frigate-card-error-message>`;
  } else if (message.type == 'info') {
    return html` <frigate-card-message
      .message=${message.message}
      .icon=${message.icon}
    ></frigate-card-message>`;
  }
  return html``;
}

export function renderProgressIndicator(): TemplateResult {
  return html` <frigate-card-progress-indicator> </frigate-card-progress-indicator> `;
}
