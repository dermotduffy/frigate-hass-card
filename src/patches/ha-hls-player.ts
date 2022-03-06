// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// ====================================================================
// ** Keep modifications to this file to a minimum **
//
// Type checking is disabled since this is a modified copy-and-paste of
// underlying render() function, but the rest of the class source is not
// available as compilation time.
// ====================================================================

import { TemplateResult, css, html } from 'lit';
import { Ref, createRef, ref } from 'lit/directives/ref.js';
import { customElement } from 'lit/decorators.js';
import { dispatchErrorMessageEvent, dispatchMediaShowEvent } from '../common.js';

customElements.whenDefined('ha-hls-player').then(() => {
  @customElement('frigate-card-ha-hls-player')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class FrigateCardHaHlsPlayer extends customElements.get('ha-hls-player') {
    protected _videoRef: Ref<HTMLVideoElement> = createRef();

    /**
     * Play the video.
     */
    public play(): void {
      this._videoRef.value?.play();
    }

    /**
     * Pause the video.
     */
    public pause(): void {
      this._videoRef.value?.pause();
    }

    /**
     * Mute the video.
     */
    public mute(): void {
      this.muted = true;
    }

    /**
     * Unmute the video.
     */
    public unmute(): void {
      this.muted = false;
    }

    // =====================================================================================
    // Minor modifications from:
    // - https://github.com/home-assistant/frontend/blob/dev/src/components/ha-hls-player.ts
    // =====================================================================================
    protected render(): TemplateResult {
      if (this._error) {
        // Use native Frigate card error handling, and attach the entityid to
        // clarify which camera the error refers to.
        return dispatchErrorMessageEvent(this, this._error);
      }
      return html`
        <video
          ${ref(this._videoRef)}
          ?autoplay=${this.autoPlay}
          .muted=${this.muted}
          ?playsinline=${this.playsInline}
          ?controls=${this.controls}
          @loadeddata=${(e) => {
            dispatchMediaShowEvent(this, e);
          }}
        ></video>
      `;
    }

    static get styles(): CSSResultGroup {
      return [
        super.styles,
        css`
          :host {
            width: 100%;
            height: 100%;
          }
          video {
            object-fit: contain;
            height: 100%;
            width: 100%;
          }
        `
      ]
    }
  }
});
