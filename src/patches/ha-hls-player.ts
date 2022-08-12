// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// ====================================================================
// ** Keep modifications to this file to a minimum **
//
// Type checking is disabled since this is a modified copy-and-paste of
// underlying render() function, but the rest of the class source is not
// available as compilation time.
// ====================================================================

import { css, CSSResultGroup, html, unsafeCSS, TemplateResult } from 'lit';
import { customElement } from 'lit/decorators.js';
import { query } from 'lit/decorators/query.js';
import { dispatchErrorMessageEvent } from '../components/message.js';
import { dispatchMediaLoadedEvent } from '../utils/media-info.js';
import liveHAComponentsStyle from '../scss/live-ha-components.scss';

customElements.whenDefined('ha-hls-player').then(() => {
  @customElement('frigate-card-ha-hls-player')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class FrigateCardHaHlsPlayer extends customElements.get('ha-hls-player') {
    // Due to an obscure behavior when this card is casted, this element needs
    // to use query rather than the ref directive to find the player.
    @query('#video')
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
    // - https://github.com/home-assistant/frontend/blob/dev/src/components/ha-hls-player.ts
    // =====================================================================================
    protected render(): TemplateResult {
      if (this._error) {
        // Use native Frigate card error handling.
        return dispatchErrorMessageEvent(this, this._error);
      }
      return html`
        <video
          id="video"
          ?autoplay=${this.autoPlay}
          .muted=${this.muted}
          ?playsinline=${this.playsInline}
          ?controls=${this.controls}
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
		"frigate-card-ha-hls-player": FrigateCardHaHlsPlayer
	}
}
