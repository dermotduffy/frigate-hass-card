import { HASSDomEvent } from '@dermotduffy/custom-card-helpers';
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
import { CameraManager } from '../camera-manager/manager.js';
import { PTZController } from '../components-lib/ptz/ptz-controller.js';
import { PTZActionPresence } from '../components-lib/ptz/types.js';
import { Actions, PTZControlsConfig } from '../config/types.js';
import { localize } from '../localize/localize.js';
import ptzStyle from '../scss/ptz.scss';
import { frigateCardHasAction } from '../utils/action.js';

@customElement('frigate-card-ptz')
export class FrigateCardPTZ extends LitElement {
  @property({ attribute: false })
  public config?: PTZControlsConfig;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cameraID?: string;

  @property({ attribute: false })
  public forceVisibility?: boolean;

  protected _controller = new PTZController(this);
  protected _actions = this._controller.getPTZActions();
  protected _actionPresence: PTZActionPresence | null = null;

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('config')) {
      this._controller.setConfig(this.config);
    }
    if (changedProps.has('cameraManager') || changedProps.has('cameraID')) {
      this._controller.setCamera(this.cameraManager, this.cameraID);
    }
    if (changedProps.has('forceVisibility')) {
      this._controller.setForceVisibility(this.forceVisibility);
    }
    if (changedProps.has('cameraID') || changedProps.has('cameraManager')) {
      this._actionPresence = this._controller.hasUsefulAction();
    }
  }

  protected render(): TemplateResult | void {
    if (!this._controller.shouldDisplay()) {
      return;
    }

    const renderIcon = (
      name: string,
      icon: string,
      actions?: Actions | null,
    ): TemplateResult => {
      const classes = {
        [name]: true,
        disabled: !actions,
      };

      return actions
        ? html`<ha-icon
            class=${classMap(classes)}
            icon=${icon}
            .actionHandler=${actionHandler({
              hasHold: frigateCardHasAction(actions?.hold_action),
              hasDoubleClick: frigateCardHasAction(actions?.double_tap_action),
            })}
            .title=${localize(`elements.ptz.${name}`)}
            @action=${(ev: HASSDomEvent<{ action: string }>) =>
              this._controller.handleAction(ev, actions)}
          ></ha-icon>`
        : html``;
    };

    const config = this._controller.getConfig();
    return html` <div class="ptz">
      ${!config?.hide_pan_tilt && this._actionPresence?.pt
        ? html`<div class="ptz-move">
            ${renderIcon('right', 'mdi:arrow-right', this._actions.right)}
            ${renderIcon('left', 'mdi:arrow-left', this._actions.left)}
            ${renderIcon('up', 'mdi:arrow-up', this._actions.up)}
            ${renderIcon('down', 'mdi:arrow-down', this._actions.down)}
          </div>`
        : ''}
      ${!config?.hide_zoom && this._actionPresence?.z
        ? html` <div class="ptz-zoom">
            ${renderIcon('zoom_in', 'mdi:plus', this._actions.zoom_in)}
            ${renderIcon('zoom_out', 'mdi:minus', this._actions.zoom_out)}
          </div>`
        : html``}
      ${!config?.hide_home && this._actionPresence?.home
        ? html`<div class="ptz-home">
            ${renderIcon('home', 'mdi:home', this._actions.home)}
          </div>`
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
