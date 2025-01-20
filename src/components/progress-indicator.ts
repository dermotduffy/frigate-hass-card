import { CSSResultGroup, html, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ClassInfo, classMap } from 'lit/directives/class-map.js';
import { ref, Ref } from 'lit/directives/ref.js';
import { CardWideConfig } from '../config/types.js';
import messageStyle from '../scss/message.scss';
import './icon.js';

type FrigateCardProgressIndicatorSize = 'tiny' | 'small' | 'medium' | 'large';

export function renderProgressIndicator(options?: {
  message?: string;
  cardWideConfig?: CardWideConfig | null;
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

@customElement('frigate-card-progress-indicator')
export class FrigateCardProgressIndicator extends LitElement {
  @property({ attribute: false })
  public message: string = '';

  @property({ attribute: false })
  public animated = false;

  @property({ attribute: false })
  public size: FrigateCardProgressIndicatorSize = 'large';

  protected render(): TemplateResult {
    return html` <div class="message vertical">
      ${this.animated
        ? html`<ha-circular-progress indeterminate size="${this.size}">
          </ha-circular-progress>`
        : html`<frigate-card-icon
            .icon=${{ icon: 'mdi:timer-sand' }}
          ></frigate-card-icon>`}
      ${this.message ? html`<span>${this.message}</span>` : html``}
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(messageStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-progress-indicator': FrigateCardProgressIndicator;
  }
}
