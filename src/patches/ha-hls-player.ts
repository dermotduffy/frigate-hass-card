// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// ====================================================================
// ** Keep modifications to this file to a minimum **
//
// Type checking is disabled since this is a modified copy-and-paste of
// underlying render() function, but the rest of the class source is not
// available as compilation time.
// ====================================================================

import { css, CSSResultGroup, html, TemplateResult, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { query } from 'lit/decorators/query.js';
import { dispatchLiveErrorEvent } from '../components-lib/live/utils/dispatch-live-error.js';
import { renderMessage } from '../components/message.js';
import liveHAComponentsStyle from '../scss/live-ha-components.scss';
import { AdvancedCameraCardMediaPlayer, FullscreenElement } from '../types.js';
import { mayHaveAudio } from '../utils/audio.js';
import { errorToConsole } from '../utils/basic.js';
import {
  dispatchMediaLoadedEvent,
  dispatchMediaPauseEvent,
  dispatchMediaPlayEvent,
  dispatchMediaVolumeChangeEvent,
} from '../utils/media-info.js';
import {
  hideMediaControlsTemporarily,
  MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
  setControlsOnVideo,
} from '../utils/media.js';
import { screenshotMedia } from '../utils/screenshot.js';

customElements.whenDefined('ha-hls-player').then(() => {
  @customElement('advanced-camera-card-ha-hls-player')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class AdvancedCameraCardHaHlsPlayer
    extends customElements.get('ha-hls-player')
    implements AdvancedCameraCardMediaPlayer
  {
    // Due to an obscure behavior when this card is casted, this element needs
    // to use query rather than the ref directive to find the player.
    @query('#video')
    protected _video: HTMLVideoElement;

    public async play(): Promise<void> {
      return this._video?.play();
    }

    public async pause(): Promise<void> {
      this._video?.pause();
    }

    public async mute(): Promise<void> {
      // The muted property is only for the initial muted state. Must explicitly
      // set the muted on the video player to make the change dynamic.
      if (this._video) {
        this._video.muted = true;
      }
    }

    public async unmute(): Promise<void> {
      // See note in mute().
      if (this._video) {
        this._video.muted = false;
      }
    }

    public isMuted(): boolean {
      return this._video?.muted ?? true;
    }

    public async seek(seconds: number): Promise<void> {
      if (this._video) {
        hideMediaControlsTemporarily(this._video);
        this._video.currentTime = seconds;
      }
    }

    public async setControls(controls?: boolean): Promise<void> {
      if (this._video) {
        setControlsOnVideo(this._video, controls ?? this.controls);
      }
    }

    public isPaused(): boolean {
      return this._video?.paused ?? true;
    }

    public async getScreenshotURL(): Promise<string | null> {
      return this._video ? screenshotMedia(this._video) : null;
    }

    public getFullscreenElement(): FullscreenElement | null {
      return this._video;
    }

    // =====================================================================================
    // Minor modifications from:
    // - https://github.com/home-assistant/frontend/blob/dev/src/components/ha-hls-player.ts
    // =====================================================================================
    protected render(): TemplateResult {
      if (this._error) {
        if (this._errorIsFatal) {
          dispatchLiveErrorEvent(this);
          return renderMessage({
            type: 'error',
            message: this._error,
            context: {
              entity_id: this.entityid,
            },
          });
        } else {
          errorToConsole(this._error, console.error);
        }
      }
      return html`
        <video
          id="video"
          .poster=${this.posterUrl}
          ?autoplay=${this.autoPlay}
          .muted=${this.muted}
          ?playsinline=${this.playsInline}
          ?controls=${this.controls}
          @loadedmetadata=${() => {
            if (this.controls) {
              hideMediaControlsTemporarily(
                this._video,
                MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
              );
            }
          }}
          @loadeddata=${(ev) => this._loadedDataHandler(ev)}
          @volumechange=${() => dispatchMediaVolumeChangeEvent(this)}
          @play=${() => dispatchMediaPlayEvent(this)}
          @pause=${() => dispatchMediaPauseEvent(this)}
        ></video>
      `;
    }

    private _loadedDataHandler(ev: Event) {
      super._loadedData();
      dispatchMediaLoadedEvent(this, ev, {
        player: this,
        capabilities: {
          supportsPause: true,
          hasAudio: mayHaveAudio(this._video),
        },
        technology: ['hls'],
      });
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
    'advanced-camera-card-ha-hls-player': AdvancedCameraCardHaHlsPlayer;
  }
}
