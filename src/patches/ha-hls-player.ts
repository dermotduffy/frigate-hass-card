// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// ====================================================================
// ** Keep modifications to this file to a minimum **
//
// Type checking is disabled since this is a modified copy-and-paste of
// underlying render() function, but the rest of the class source is not
// available as compilation time.
// ====================================================================

import {
  TemplateResult,
  html,
} from 'lit';
import { customElement } from 'lit/decorators';
import { dispatchMediaLoadEvent, dispatchPauseEvent, dispatchPlayEvent } from '../common';

customElements.whenDefined("ha-hls-player").then(() => {
  @customElement("frigate-card-ha-hls-player")
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class FrigateCardHaHlsPlayer extends customElements.get("ha-hls-player") {
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
          @loadedmetadata=${(e) => dispatchMediaLoadEvent(this, e)}
          @loadeddata=${this._elementResized}
          @pause=${() => dispatchPauseEvent(this)}
          @play=${() => dispatchPlayEvent(this)}
        ></video>
      `;
    }  
  }
})