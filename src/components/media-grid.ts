// TODO: Performance of video scanning (pause/play?)
// TODO: Investigate query spam during a grid load
// TODO: Test live pre-load
// TODO: Is the query reset in card.ts correct for media filter multi-camera queries that are not all cameras?
// TODO: Do I need column max?
// TODO: test changing tabs in a dashboard (to trigger disconnect, do I still receive media loads from media that was already loaded)?
// TODO: Can SELECT_CHILD_EVENTS only be 'click' and it still work on Android?

import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import mediaGridStyle from '../scss/media-grid.scss';
import { ViewDisplayConfig } from '../types.js';
import { MediaGridController } from '../utils/media-grid-controller.js';

@customElement('frigate-card-media-grid')
export class FrigateCardMediaGrid extends LitElement {
  @property({ attribute: false })
  public selected?: string;

  @property({ attribute: false })
  public displayConfig?: ViewDisplayConfig;

  protected _controller: MediaGridController | null = null;
  protected _refSlot: Ref<HTMLSlotElement> = createRef();

  connectedCallback(): void {
    super.connectedCallback();

    // Ensure the controller is recreated.
    this.requestUpdate();
  }

  disconnectedCallback(): void {
    this._controller?.destroy();
    this._controller = null;
    super.disconnectedCallback();
  }

  protected updated(changedProps: PropertyValues): void {
    if (!this._controller && this._refSlot.value) {
      this._controller = new MediaGridController(this._refSlot.value, {
        selected: this.selected,
      });
    }

    if (changedProps.has('selected')) {
      if (this.selected) {
        this._controller?.selectCell(this.selected);
      } else {
        this._controller?.unselectAll();
      }
    }

    if (changedProps.has('displayConfig')) {
      this._controller?.setDisplayConfig(this.displayConfig ?? null);
    }
  }

  protected render(): TemplateResult | void {
    return html`<slot ${ref(this._refSlot)}></slot> `;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(mediaGridStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-media-grid': FrigateCardMediaGrid;
  }
}
