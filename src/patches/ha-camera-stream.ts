// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// ====================================================================
// ** Keep modifications to this file to a minimum **
//
// Type checking is disabled since this is a modified copy-and-paste of
// underlying render() function, but the rest of the class source it not
// available as compilation time.
// ====================================================================

import { css, CSSResultGroup, html, nothing, PropertyValues, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { query } from 'lit/decorators/query.js';
import { FrigateCardMediaPlayer, MediaLoadedInfo } from '../types.js';
import {
  createMediaLoadedInfo,
  dispatchExistingMediaLoadedInfoAsEvent,
} from '../utils/media-info.js';
import './ha-hls-player';
import './ha-web-rtc-player';
import liveHAComponentsStyle from '../scss/live-ha-components.scss';

customElements.whenDefined('ha-camera-stream').then(() => {
  // ========================================================================================
  // From:
  // - https://github.com/home-assistant/frontend/blob/dev/src/data/camera.ts
  // - https://github.com/home-assistant/frontend/blob/dev/src/common/entity/compute_state_name.ts
  // - https://github.com/home-assistant/frontend/blob/dev/src/common/entity/compute_object_id.ts
  // ========================================================================================
  const computeMJPEGStreamUrl = (entity: CameraEntity): string =>
    `/api/camera_proxy_stream/${entity.entity_id}?token=${entity.attributes.access_token}`;

  const STREAM_TYPE_HLS = 'hls';
  const STREAM_TYPE_WEB_RTC = 'web_rtc';
  const STREAM_TYPE_MJPEG = 'mjpeg';
  type StreamType = STREAM_TYPE_HLS | STREAM_TYPE_WEB_RTC | STREAM_TYPE_MJPEG;

  @customElement('frigate-card-ha-camera-stream')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class FrigateCardHaCameraStream
    extends customElements.get('ha-camera-stream')
    implements FrigateCardMediaPlayer
  {
    // Due to an obscure behavior when this card is casted, this element needs
    // to use query rather than the ref directive to find the player.
    @query('#player')
    protected _player: FrigateCardMediaPlayer;

    protected _mediaLoadedInfoPerStream: Record<StreamType, MediaLoadedInfo> = {};
    protected _mediaLoadedInfoDispatched: MediaLoadedInfo | null = null;

    // ========================================================================================
    // Minor modifications from:
    // - https://github.com/home-assistant/frontend/blob/dev/src/components/ha-camera-stream.ts
    // ========================================================================================

    public async play(): Promise<void> {
      return this._player?.play();
    }

    public async pause(): Promise<void> {
      this._player?.pause();
    }

    public async mute(): Promise<void> {
      this._player?.mute();
    }

    public async unmute(): Promise<void> {
      this._player?.unmute();
    }

    public isMuted(): boolean {
      return this._player?.isMuted() ?? true;
    }

    public async seek(seconds: number): Promise<void> {
      this._player?.seek(seconds);
    }

    public async setControls(controls?: boolean): Promise<void> {
      if (this._player) {
        this._player.setControls(controls ?? this.controls);
      }
    }

    public isPaused(): boolean {
      return this._player?.isPaused() ?? true;
    }

    public async getScreenshotURL(): Promise<string | null> {
      return this._player ? await this._player.getScreenshotURL() : null;
    }

    protected _storeMediaLoadedInfoHandler(
      stream: StreamType,
      ev: CustomEvent<MediaLoadedInfo>,
    ) {
      this._storeMediaLoadedInfo(stream, ev.detail);
      ev.stopPropagation();
    }

    protected _storeMediaLoadedInfo(
      stream: StreamType,
      mediaLoadedInfo: MediaLoadedInfo,
    ) {
      this._mediaLoadedInfoPerStream[stream] = mediaLoadedInfo;
    }

    protected _renderStream(stream: Stream) {
      if (!this.stateObj) {
        return nothing;
      }
      if (stream.type === STREAM_TYPE_MJPEG) {
        return html`
          <img
            @load=${(ev) =>
              this._storeMediaLoadedInfo(
                STREAM_TYPE_MJPEG,
                createMediaLoadedInfo(ev, { player: this, technology: ['mjpeg'] }),
              )}
            .src=${typeof this._connected == 'undefined' || this._connected
              ? computeMJPEGStreamUrl(this.stateObj)
              : this._posterUrl || ''}
          />
        `;
      }

      if (stream.type === STREAM_TYPE_HLS) {
        return html` <frigate-card-ha-hls-player
          id="player"
          ?autoplay=${false}
          playsinline
          .allowExoPlayer=${this.allowExoPlayer}
          .muted=${this.muted}
          .controls=${this.controls}
          .hass=${this.hass}
          .entityid=${this.stateObj.entity_id}
          .posterUrl=${this._posterUrl}
          @frigate-card:media:loaded=${(ev) =>
            this._storeMediaLoadedInfoHandler(STREAM_TYPE_HLS, ev)}
          @streams=${this._handleHlsStreams}
          class=${stream.visible ? '' : 'hidden'}
        ></frigate-card-ha-hls-player>`;
      }

      if (stream.type === STREAM_TYPE_WEB_RTC) {
        return html`<frigate-card-ha-web-rtc-player
          id="player"
          ?autoplay=${false}
          playsinline
          .muted=${this.muted}
          .controls=${this.controls}
          .hass=${this.hass}
          .entityid=${this.stateObj.entity_id}
          .posterUrl=${this._posterUrl}
          @frigate-card:media:loaded=${(ev) =>
            this._storeMediaLoadedInfoHandler(STREAM_TYPE_WEB_RTC, ev)}
          @streams=${this._handleWebRtcStreams}
          class=${stream.visible ? '' : 'hidden'}
        ></frigate-card-ha-web-rtc-player>`;
      }

      return nothing;
    }

    public updated(changedProps: PropertyValues): void {
      super.updated(changedProps);

      const streams = this._streams(
        this._capabilities?.frontend_stream_types,
        this._hlsStreams,
        this._webRtcStreams,
      );

      const visibleStream = streams.find((stream) => stream.visible) ?? null;
      if (visibleStream) {
        const mediaLoadedInfo = this._mediaLoadedInfoPerStream[visibleStream.type];
        if (mediaLoadedInfo && mediaLoadedInfo !== this._mediaLoadedInfoDispatched) {
          this._mediaLoadedInfoDispatched = mediaLoadedInfo;
          dispatchExistingMediaLoadedInfoAsEvent(this, mediaLoadedInfo);
        }
      }
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
          img {
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
    'frigate-card-ha-camera-stream': FrigateCardHaCameraStream;
  }
}
