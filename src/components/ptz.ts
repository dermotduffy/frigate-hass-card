import { HASSDomEvent, HomeAssistant } from '@dermotduffy/custom-card-helpers';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { actionHandler } from '../action-handler-directive.js';
import { CameraManager } from '../camera-manager/manager.js';
import { PTZController } from '../components-lib/ptz-controller.js';
import { Actions, FrigateCardPTZConfig } from '../config/types.js';
import { localize } from '../localize/localize.js';
import ptzStyle from '../scss/ptz.scss';
import { frigateCardHasAction } from '../utils/action.js';

@customElement('frigate-card-ptz')
export class FrigateCardPTZ extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public config?: FrigateCardPTZConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cameraID?: string;

  @property({ attribute: false })
  public forceVisibility?: boolean;

  protected _controller = new PTZController(this);

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('config')) {
      this._controller.setConfig(this.config);
    }
    if (changedProps.has('hass')) {
      this._controller.setHASS(this.hass);
    }
    if (changedProps.has('cameraManager') || changedProps.has('cameraID')) {
      this._controller.setCamera(this.cameraManager, this.cameraID);
    }
    if (changedProps.has('forceVisibility')) {
      this._controller.setForceVisibility(this.forceVisibility);
    }
  }

  protected render(): TemplateResult | void {
    if (!this._controller.shouldDisplay()) {
      return;
    }

    const renderIcon = (
      name: string,
      icon: string,
      actions: Actions | null,
    ): TemplateResult => {
      const classes = {
        [name]: true,
        disabled: !actions,
      };

      return html`<ha-icon
        class=${classMap(classes)}
        icon=${icon}
        .actionHandler=${actionHandler({
          hasHold: frigateCardHasAction(actions?.hold_action),
          hasDoubleClick: frigateCardHasAction(actions?.double_tap_action),
        })}
        .title=${localize(`elements.ptz.${name}`)}
        @action=${(ev: HASSDomEvent<{ action: string }>) =>
          this._controller.handleAction(ev, actions)}
      ></ha-icon>`;
    };

    const config = this._controller.getConfig();
    const actionsZoomIn = this._controller.getPTZActions('zoom_in');
    const actionsZoomOut = this._controller.getPTZActions('zoom_out');
    const actionsHome = this._controller.getPTZActions('home');

    return html` <div class="ptz">
      ${!config?.hide_pan_tilt
        ? html`<div class="ptz-move">
            ${renderIcon(
              'right',
              'mdi:arrow-right',
              this._controller.getPTZActions('right'),
            )}
            ${renderIcon(
              'left',
              'mdi:arrow-left',
              this._controller.getPTZActions('left'),
            )}
            ${renderIcon('up', 'mdi:arrow-up', this._controller.getPTZActions('up'))}
            ${renderIcon(
              'down',
              'mdi:arrow-down',
              this._controller.getPTZActions('down'),
            )}
          </div>`
        : ''}
      ${!config?.hide_zoom && (actionsZoomIn || actionsZoomOut)
        ? html` <div class="ptz-zoom">
            ${renderIcon('zoom_in', 'mdi:plus', actionsZoomIn)}
            ${renderIcon('zoom_out', 'mdi:minus', actionsZoomOut)}
          </div>`
        : html``}
      ${!config?.hide_home && actionsHome
        ? html`
            <div class="ptz-home">${renderIcon('home', 'mdi:home', actionsHome)}</div>
          `
        : html``}
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(ptzStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-ptz': FrigateCardPTZ;
  }
}
