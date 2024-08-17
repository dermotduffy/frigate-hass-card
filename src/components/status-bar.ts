import {
  CSSResultGroup,
  LitElement,
  PropertyValues,
  TemplateResult,
  html,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { actionHandler } from '../action-handler-directive.js';
import { StatusBarController } from '../components-lib/status-bar-controller';
import { StatusBarConfig, StatusBarItem } from '../config/types';
import statusStyle from '../scss/status.scss';
import { frigateCardHasAction } from '../utils/action';

@customElement('frigate-card-status-bar')
export class FrigateCardStatusBar extends LitElement {
  protected _controller = new StatusBarController(this);

  @property({ attribute: false })
  public items?: StatusBarItem[];

  @property({ attribute: false })
  public config?: StatusBarConfig;

  protected willUpdate(changedProperties: PropertyValues): void {
    // Always set config before items.
    if (changedProperties.has('config') && this.config) {
      this._controller.setConfig(this.config);
    }

    if (changedProperties.has('items')) {
      this._controller.setItems(this.items ?? []);
    }
  }

  protected render(): TemplateResult | void {
    if (!this._controller.shouldRender()) {
      return;
    }

    return html`
      <div class="status">
        ${this._controller.getRenderItems().map((item): TemplateResult | void => {
          if (item.enabled === false) {
            return;
          }

          const classes = classMap({
            item: true,
            expand: !!item.expand,
            action: !!Object.keys(item.actions ?? {}).length,
          });

          const handler = actionHandler({
            hasHold: frigateCardHasAction(item.actions?.hold_action),
            hasDoubleClick: frigateCardHasAction(item.actions?.double_tap_action),
          });

          if (item.type === 'custom:frigate-card-status-bar-string') {
            return html`<div
              .actionHandler=${handler}
              class="${classes}"
              @action=${(ev) => this._controller.actionHandler(ev, item.actions)}
            >
              ${item.string}
            </div>`;
          } else if (item.type === 'custom:frigate-card-status-bar-icon') {
            return html`<ha-icon
              .actionHandler=${handler}
              class="${classes}"
              icon="${item.icon}"
              @action=${(ev) => this._controller.actionHandler(ev, item.actions)}
            ></ha-icon>`;
          } else if (item.type === 'custom:frigate-card-status-bar-image') {
            return html`<img
              .actionHandler=${handler}
              class="${classes}"
              src="${item.image}"
              @action=${(ev) => this._controller.actionHandler(ev, item.actions)}
            />`;
          }
        })}
      </div>
    `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(statusStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-status-bar': FrigateCardStatusBar;
  }
}
