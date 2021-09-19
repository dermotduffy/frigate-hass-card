import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators';
import { localize } from '../localize/localize';
import messageStyle from '../scss/message.scss';

const URL_TROUBLESHOOTING =
  'https://github.com/dermotduffy/frigate-hass-card#troubleshooting';

@customElement('frigate-card-message')
export class FrigateCardMessage extends LitElement {
  @property({ attribute: false })
  protected message = '';

  @property({ attribute: false })
  protected icon = 'mdi:information-outline';

  // Render the menu.
  protected render(): TemplateResult {
    return html` <div class="message">
      <span>
        <ha-icon icon="${this.icon}"> </ha-icon>
        ${this.message ? html`&nbsp;${this.message}` : ''}
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
        <a href="${URL_TROUBLESHOOTING}"> ${localize('error.troubleshooting')} </a>.`}
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

export function renderErrorMessage(error: string): TemplateResult {
  return html`
    <frigate-card-error-message .error=${error}></frigate-card-error-message>
  `;
}

export function renderMessage(message: string, icon: string): TemplateResult {
  return html`
    <frigate-card-message .message=${message} .icon=${icon}></frigate-card-message>
  `;
}

export function renderProgressIndicator(): TemplateResult {
  return html` <frigate-card-progress-indicator> </frigate-card-progress-indicator> `;
}
