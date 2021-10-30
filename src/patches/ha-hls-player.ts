// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// ====================================================================
// ** Keep modifications to this file to a minimum **
//
// Type checking is disabled since this is a modified copy-and-paste of
// underlying render() function, but the rest of the class source is not
// available as compilation time.
// ====================================================================

import { TemplateResult, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import {
  dispatchMediaShowEvent,
  dispatchPauseEvent,
  dispatchPlayEvent,
} from '../common.js';

customElements.whenDefined('ha-hls-player').then(() => {
  @customElement('frigate-card-ha-hls-player')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class FrigateCardHaHlsPlayer extends customElements.get('ha-hls-player') {
    // =====================================================================================
    // Minor modifications from:
    // - https://github.com/home-assistant/frontend/blob/dev/src/components/ha-hls-player.ts
    // =====================================================================================
    protected render(): TemplateResult {
      return html`
        <video
          ?autoplay=${this.autoPlay}
          .muted=${this.muted}
          ?playsinline=${this.playsInline}
          ?controls=${this.controls}
          @loadeddata=${(e) => {
            // TODO: This block can be removed a safe distance from HA 2021.11.
            if (typeof this._elementResized != 'undefined') {
              this._elementResized();
            }
            dispatchMediaShowEvent(this, e);
          }}
          @pause=${() => dispatchPauseEvent(this)}
          @play=${() => dispatchPlayEvent(this)}
        ></video>
      `;
    }
  }
});
