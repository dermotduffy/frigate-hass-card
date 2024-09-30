import { HomeAssistant } from '@dermotduffy/custom-card-helpers';
import { CSSResultGroup, LitElement, TemplateResult, unsafeCSS } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
import { RawFrigateCardConfig } from '../config/types';
import { localize } from '../localize/localize';
import basicBlockStyle from '../scss/basic-block.scss';
import { Diagnostics, getDiagnostics } from '../utils/diagnostics';
import { renderMessage } from './message';
import { DeviceRegistryManager } from '../utils/ha/registry/device';

@customElement('frigate-card-diagnostics')
export class FrigateCardDiagnostics extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public deviceRegistryManager?: DeviceRegistryManager;

  @property({ attribute: false })
  public rawConfig?: RawFrigateCardConfig;

  @state()
  protected _diagnostics: Diagnostics | null = null;

  protected async _fetchDiagnostics(): Promise<void> {
    this._diagnostics = await getDiagnostics(
      this.hass,
      this.deviceRegistryManager,
      this.rawConfig,
    );
  }

  protected shouldUpdate(): boolean {
    if (!this._diagnostics) {
      this._fetchDiagnostics().then(() => this.requestUpdate());
      return false;
    }
    return true;
  }

  protected render(): TemplateResult | void {
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
