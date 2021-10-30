// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-nocheck

// ====================================================================
// ** Keep modifications to this file to a minimum **
//
// Type checking is disabled since this is a modified copy-and-paste of
// underlying render() function, but the rest of the class source it not
// available as compilation time.
// ====================================================================

import { TemplateResult, html } from 'lit';
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
    // ========================================================================================
    // Minor modifications from:
    // - https://github.com/home-assistant/frontend/blob/dev/src/components/ha-camera-stream.ts
    // ========================================================================================
    protected render(): TemplateResult {
      if (!this.stateObj) {
        return html``;
      }

      return html`
        ${this._shouldRenderMJPEG
          ? html`
              <img
                @load=${(e) => {
                  // TODO: This block can be removed a safe distance from HA 2021.11.
                  if (typeof this._elementResized != 'undefined') {
                    this._elementResized();
                  }
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
  }
});
