import { HomeAssistant } from 'custom-card-helpers';
import { CSSResultGroup, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { RawFrigateCardConfig } from '../config/types';
import { localize } from '../localize/localize';
import basicBlockStyle from '../scss/basic-block.scss';
import { Diagnostics, getDiagnostics } from '../utils/diagnostics';
import { renderMessage } from './message';

@customElement('frigate-card-diagnostics')
export class FrigateCardDiagnostics extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public rawConfig?: RawFrigateCardConfig;

  @state()
  protected _diagnostics: Diagnostics | null = null;

  protected async _fetchDiagnostics(): Promise<void> {
    this._diagnostics = await getDiagnostics(this.hass, this.rawConfig);
  }

  protected render(): TemplateResult | void {
    if (!this._diagnostics) {
      this._fetchDiagnostics().then(() => this.requestUpdate());
      return;
    }
    return renderMessage({
      message: localize('error.diagnostics'),
      type: 'diagnostics',
      icon: 'mdi:information',
      context: this._diagnostics,
    });
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(basicBlockStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-diagnostics': FrigateCardDiagnostics;
  }
}
