// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// ====================================================================
// ** Keep modifications to this file to a minimum **
//
// Type checking is disabled since this is a modified copy-and-paste of
// underlying render() function, but the rest of the class source it not
// available as compilation time.
// ====================================================================

import { css, CSSResultGroup, html, unsafeCSS, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { query } from 'lit/decorators/query.js';
import { dispatchErrorMessageEvent } from '../components/message.js';
import { dispatchMediaLoadedEvent } from '../utils/media-info.js';
import {
  hideMediaControlsTemporarily,
  MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
} from '../utils/media.js';
import liveHAComponentsStyle from '../scss/live-ha-components.scss';

customElements.whenDefined('ha-web-rtc-player').then(() => {
  @customElement('frigate-card-ha-web-rtc-player')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class FrigateCardHaWebRtcPlayer extends customElements.get('ha-web-rtc-player') {
    // Due to an obscure behavior when this card is casted, this element needs
    // to use query rather than the ref directive to find the player.
    @query('#remote-stream')
    protected _video: HTMLVideoElement;

    /**
     * Play the video.
     */
    public play(): void {
      this._video?.play();
    }

    /**
     * Pause the video.
     */
    public pause(): void {
      this._video?.pause();
    }

    /**
     * Mute the video.
     */
    public mute(): void {
      // The muted property is only for the initial muted state. Must explicitly
      // set the muted on the video player to make the change dynamic.
      if (this._video) {
        this._video.muted = true;
      }
    }

    /**
     * Unmute the video.
     */
    public unmute(): void {
      // See note in mute().
      if (this._video) {
        this._video.muted = false;
      }
    }

    /**
     * Seek the video.
     */
    public seek(seconds: number): void {
      if (this._video) {
        this._video.currentTime = seconds;
      }
    }

    // =====================================================================================
    // Minor modifications from:
    // - https://github.com/home-assistant/frontend/blob/dev/src/components/ha-web-rtc-player.ts
    // =====================================================================================
    protected render(): TemplateResult | void {
      if (this._error) {
        // Use native Frigate card error handling, and attach the entityid to
        // clarify which camera the error refers to.
        return dispatchErrorMessageEvent(this, `${this._error} (${this.entityid})`);
      }
      return html`
        <video
          id="remote-stream"
          ?autoplay=${this.autoPlay}
          .muted=${this.muted}
          ?playsinline=${this.playsInline}
          ?controls=${this.controls}
          @loadedmetadata=${() => {
            hideMediaControlsTemporarily(this._video, MEDIA_LOAD_CONTROLS_HIDE_SECONDS);
          }}
          @loadeddata=${(e) => {
            dispatchMediaLoadedEvent(this, e);
          }}
        ></video>
      `;
    }

    static get styles(): CSSResultGroup {
      return [
        super.styles,
        unsafeCSS(liveHAComponentsStyle),
        css`
          :host {
            width: 100%;
            height: 100%;
          }
          video {
            width: 100%;
            height: 100%;
          }
        `,
      ];
    }
  }
});

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-ha-web-rtc-player': FrigateCardHaWebRtcPlayer;
  }
}
