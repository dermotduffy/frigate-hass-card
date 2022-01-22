// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// ====================================================================
// ** Keep modifications to this file to a minimum **
//
// Type checking is disabled since this is a modified copy-and-paste of
// underlying render() function, but the rest of the class source it not
// available as compilation time.
// ====================================================================

import { Ref, createRef, ref } from 'lit/directives/ref';
import { TemplateResult, css, html } from 'lit';
import { customElement } from 'lit/decorators.js';
import { dispatchMediaShowEvent } from '../common.js';

customElements.whenDefined('ha-camera-stream').then(() => {
  // ========================================================================================
  // From:
  // - https://github.com/home-assistant/frontend/blob/dev/src/data/camera.ts
  // - https://github.com/home-assistant/frontend/blob/dev/src/common/entity/compute_state_name.ts
  // - https://github.com/home-assistant/frontend/blob/dev/src/common/entity/compute_object_id.ts
  // ========================================================================================
  const computeMJPEGStreamUrl = (entity: CameraEntity): string =>
    `/api/camera_proxy_stream/${entity.entity_id}?token=${entity.attributes.access_token}`;

  const computeObjectId = (entityId: string): string =>
    entityId.substr(entityId.indexOf('.') + 1);

  const computeStateName = (stateObj: HassEntity): string =>
    stateObj.attributes.friendly_name === undefined
      ? computeObjectId(stateObj.entity_id).replace(/_/g, ' ')
      : stateObj.attributes.friendly_name || '';

  @customElement('frigate-card-ha-camera-stream')
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  class FrigateCardHaCameraStream extends customElements.get('ha-camera-stream') {
    protected _playerRef: Ref<HTMLElement> = createRef();

    // ========================================================================================
    // Minor modifications from:
    // - https://github.com/home-assistant/frontend/blob/dev/src/components/ha-camera-stream.ts
    // ========================================================================================

    /**
     * Play the video.
     */
     public play(): void {
      this._playerRef.value?.play();
    }

    /**
     * Pause the video.
     */
    public pause(): void {
      this._playerRef.value?.pause();
    }

    /**
     * Master render method.
     * @returns A rendered template.
     */
    protected render(): TemplateResult {
      if (!this.stateObj) {
        return html``;
      }

      return html`
        ${this._shouldRenderMJPEG
          ? html`
              <img
                @load=${(e) => {
                  dispatchMediaShowEvent(this, e);
                }}
                .src=${typeof this._connected == 'undefined' || this._connected
                  ? computeMJPEGStreamUrl(this.stateObj)
                  : ''}
                .alt=${`Preview of the ${computeStateName(this.stateObj)} camera.`}
              />
            `
          : this._url
          ? html`
              <frigate-card-ha-hls-player
                ${ref(this._playerRef)}
                autoplay
                playsinline
                .allowExoPlayer=${this.allowExoPlayer}
                .muted=${this.muted}
                .controls=${this.controls}
                .hass=${this.hass}
                .url=${this._url}
              ></frigate-card-ha-hls-player>
            `
          : ''}
      `;
    }

    static get styles(): CSSResultGroup {
      return [
        super.styles,
        css`
          :host {
            width: 100%;
            height: 100%;
          }`
      ];
    }
  }
});
