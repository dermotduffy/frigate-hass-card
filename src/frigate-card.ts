// TODO Check for HA state presence and validity before using it, otherwise warn.

// TODO Add material tooltips

// TODO Action handlers.

// TODO Can I use Zod for FrigateCardConfig validation?

/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LitElement,
  html,
  customElement,
  property,
  CSSResult,
  TemplateResult,
  PropertyValues,
  state,
  unsafeCSS,
} from 'lit-element';

import { until } from 'lit-html/directives/until.js';
import {
  HomeAssistant,
  ActionHandlerEvent,
  handleAction,
  LovelaceCardEditor,
  getLovelace,
} from 'custom-card-helpers';

import './editor';

import style from './frigate-card.scss'

import { frigateGetEventsResponseSchema } from './types';
import type { FrigateCardConfig, FrigateEvent, FrigateGetEventsResponse, GetEventsParameters, ControlVideosParameters } from './types';
import { actionHandler } from './action-handler-directive';
import { CARD_VERSION } from './const';
import { localize } from './localize/localize';

/* eslint no-console: 0 */
console.info(
  `%c  FRIGATE-HASS-CARD \n%c  ${localize('common.version')} ${CARD_VERSION}    `,
  'color: pink; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

// This puts your card into the UI card picker dialog
(window as any).customCards = (window as any).customCards || [];
(window as any).customCards.push({
  type: 'frigate-card',
  name: 'Frigate Card',
  description: 'A lovelace card for use with Frigate',
});

enum FrigateCardView {
  LIVE,       // Show the live camera.
  CLIP,       // Show a clip video.
  CLIPS,      // Show the clips gallery.
  SNAPSHOT,   // Show a snapshot.
  SNAPSHOTS,  // Show the snapshots gallery.
}

// Main FrigateCard class.
@customElement('frigate-card')
export class FrigateCard extends LitElement {

  // Constructor for FrigateCard.
  constructor() {
    super();
    this._viewMode = FrigateCardView.LIVE;
    this._viewEvent = null;
    this._interactionTimerID = null;
  }

  // Get the configuration element.
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('frigate-card-editor');
  }

  // Get a stub basic config.
  public static getStubConfig(): Record<string, string> {
    return {};
  }

  @property({ attribute: false })
  public hass!: HomeAssistant;

  @state()
  public config!: FrigateCardConfig;

  @property({ attribute: false })
  protected _viewMode: FrigateCardView;

  @property({ attribute: false })
  protected _viewEvent: FrigateEvent | null;

  protected _interactionTimerID: number | null;

  // Set the object configuration.
  public setConfig(inputConfig: FrigateCardConfig): void {
    if (!inputConfig) {
      throw new Error(localize('common.invalid_configuration:'));
    }
    // inputConfig is not "extensible" (i.e. preventExtensions() has been
    // called on it), need to make a copy to allow modifications.
    const cardConfig = Object.assign({
      name: 'Frigate'
    }, inputConfig);

    if (cardConfig.test_gui) {
      getLovelace().setEditMode(true);
    }

    if (!cardConfig.frigate_url) {
      throw new Error(localize('common.invalid_configuration_missing') + ": frigate_url");
    }

    if (!cardConfig.frigate_camera_name) {
      // No camera name specified, so just assume it's the same as the entity name.
      if (cardConfig.camera_entity.includes(".")) {
        cardConfig.frigate_camera_name = cardConfig.camera_entity.split('.', 2)[1]
      } else {
        throw new Error(localize('common.invalid_configuration_missing') + ": camera_entity");
      }
    }

    if (cardConfig.view_timeout) {
      if (isNaN(Number(cardConfig.view_timeout))) {
        throw new Error(localize('common.invalid_configuration') + ": view_timeout");
      }
    }

    if (cardConfig.view_default) {
      if (!["live", "clips", "clip", "snapshots", "snapshot"].includes(cardConfig.view_default)) {
        throw new Error(localize('common.invalid_configuration') + ": view_default");
      }
    }

    this.config = cardConfig;
    this._setViewModeToDefault();
  }
  
  // Set the view mode to the configured default.
  protected _setViewModeToDefault(): void {
    if (this.config.view_default == "live") {
      this._viewMode = FrigateCardView.LIVE;
    } else if (this.config.view_default == "clips") {
      this._viewMode = FrigateCardView.CLIPS;
    } else if (this.config.view_default == "clip") {
        this._viewMode = FrigateCardView.CLIP;
        this._viewEvent = null;
    } else if (this.config.view_default == "snapshots") {
      this._viewMode = FrigateCardView.SNAPSHOTS;
    } else if (this.config.view_default == "snapshot") {
      this._viewMode = FrigateCardView.SNAPSHOT;
      this._viewEvent = null;
    }
  }

  // == RTC experimentation ==
  // const div = document.createElement("div");
  // const webrtcElement = customElements.get('webrtc-camera');
  // const webrtc = new webrtcElement();
  // webrtc.setConfig({ "entity": "camera.landing_rtsp" });
  // webrtc.hass = this.hass;
  // div.appendChild(webrtc);
  // this.renderRoot.appendChild(div);
  // ==

  // Determine whether the card should be updated.
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this.config || !this.hass) {
      return false;
    }

    const cameraEntity = this.config.camera_entity;
    const motionEntity = this.config.motion_entity;

    if (!cameraEntity) {
      return false;
    }

    if (changedProps.has('config')) {
      return true;
    }
    
    const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
  
    if (oldHass) {
      if (oldHass.states[cameraEntity] !== this.hass.states[cameraEntity]) {
        return true;
      }
      if (motionEntity && oldHass.states[motionEntity] !== this.hass.states[motionEntity]) {
        return true;
      }
      return false;
    }
    return true;
  }

  // Get FrigateEvents from the Frigate server API.
  protected async _getEvents({
    has_clip = false,
    has_snapshot = false,
    limit = 100,
  }: GetEventsParameters): Promise<FrigateGetEventsResponse> {
    let url = `${this.config.frigate_url}/api/events?camera=${this.config.frigate_camera_name}`;
    if (has_clip) {
      url += `&has_clip=1`
    }
    if (has_snapshot) {
      url += `&has_snapshot=1`
    }
    if (limit > 0) {
      url += `&limit=${limit}`
    }

    if (this.config.label) {
      url += `&label=${this.config.label}`;
    }

    const response = await fetch(url);
    if (response.ok) {
      let raw_json;
      try {
        raw_json = await response.json();
      } catch(e) {
        console.warn(e);
        throw new Error(`Could not JSON decode Frigate API response: ${e}`);
      }
      try {
        return frigateGetEventsResponseSchema.parse(raw_json);
      } catch(e) {
        console.warn(e);
        throw new Error(`Frigate events were malformed: ${e}`);
      }
    } else {
      const error_message = `Frigate API request failed with status: ${response.status}`;
      console.warn(error_message);
      throw new Error(error_message);
    }
  }

  protected _renderAttentionIcon(icon: string): TemplateResult {
    return html`
      <div class="frigate-card-attention">
        <ha-icon icon="${icon}">
        </ha-icon>
      </div>`;
  }

  // Render an embedded error situation.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  protected _renderError(_error: string) : TemplateResult {
    return this._renderAttentionIcon("mdi:alert-circle");
  }

  // Render Frigate events into a card gallery.
  protected async _renderEvents() : Promise<TemplateResult> {
    const want_clips = this._viewMode == FrigateCardView.CLIPS;
    let events;
    try {
      events = await this._getEvents({
        has_clip: want_clips,
        has_snapshot: !want_clips,
      });
    } catch (e) {
      return this._renderError(e);
    }

    if (!events.length) {
      return this._renderAttentionIcon(want_clips ? "mdi:filmstrip-off" : "mdi:camera-off");
    }

    return html`
      <ul class= "mdc-image-list frigate-card-image-list">
      ${events.map(event => html`
          <li class="mdc-image-list__item">
            <div class="mdc-image-list__image-aspect-container">
              <img
                class="mdc-image-list__image"
                src="data:image/png;base64,${event.thumbnail}"
                @click=${() => {
                  this._viewEvent = event;
                  this._viewMode = want_clips ?
                      FrigateCardView.CLIP : FrigateCardView.SNAPSHOT
                }}
              >
            </div>
          </li>`)}
      </ul>`;
  }

  // Render a progress spinner while content loads.
  protected _renderProgressIndicator(): TemplateResult {
    return html`
      <div class="frigate-card-attention">
        <ha-circular-progress
          active="true"
          size="large"
        ></ha-circular-progress>
      </div>`
  }

  // Stop/Play video controls.
  protected _controlVideos({
      stop,
      control_live = false,
      control_clip = false}: ControlVideosParameters): void {
    const controlVideo = (stop: boolean, is_live: boolean, video: HTMLVideoElement) => {
      if (video) {
        if (stop) {
          video.pause();
          video.currentTime = 0;
        } else {
          if (is_live) {
            // If it's a live view, 'fast-forward' to most recent content.
            const duration = video.duration;
            video.currentTime = duration;
          }
          video.play();
        }
      }
    }
    if (!this.shadowRoot) {
      return;
    }
    if (control_clip) {
      controlVideo(
        stop,
        false,
        this.shadowRoot?.querySelector(
          `#frigate-card-clip-player`) as HTMLVideoElement);
    }
    if (control_live) {
      // Don't have direct access to the live video player as it is buried in
      // multiple components/shadow-roots, so need to navigate the path to get to <video>.
      const ha_camera_stream = this.shadowRoot?.querySelector(`#frigate-card-live-player`);
      if (ha_camera_stream && ha_camera_stream?.shadowRoot) {
        const ha_hls_player = ha_camera_stream.shadowRoot.querySelector(`ha-hls-player`);
        if (ha_hls_player && ha_hls_player?.shadowRoot) {
          controlVideo(
            stop,
            true,
            ha_hls_player.shadowRoot.querySelector(`video`) as HTMLVideoElement);
        }
      }
    }
  }

  // Render the main navbar (live, clips, snapshots).
  protected _renderNavigationBar(): TemplateResult {
    return html`
      <div class="frigate-card-navbar" >
        <ha-icon-button
          class="button"
          icon="mdi:cctv"
          @click=${() => {
            this._controlVideos({stop: true, control_clip: true});
            this._controlVideos({stop: false, control_live: true});
            this._viewMode = FrigateCardView.LIVE
          }}
        ></ha-icon-button>
        <ha-icon-button
          class="button"
          icon = "mdi:filmstrip"
          @click=${() => {
            this._controlVideos({stop: true, control_live: true});
            this._viewMode = FrigateCardView.CLIPS
          }}
        ></ha-icon-button>
        <ha-icon-button
          class="button"
          icon = "mdi:camera"
          @click=${() => {
            this._controlVideos({stop: true, control_clip: true, control_live: true});
            this._viewMode = FrigateCardView.SNAPSHOTS
          }}
        ></ha-icon-button>
      </div>`
  }

  // Render the player for a saved clip.
  protected async _renderClipPlayer(): Promise<TemplateResult> {
    let event: FrigateEvent, events: FrigateGetEventsResponse;
    if (this._viewEvent) {
      event = this._viewEvent;
    } else {
      try {
        events = await this._getEvents({
          has_clip: true,
          limit: 1
        });
      } catch (e) {
        return this._renderError(e);
      }
      if (!events.length) {
        return this._renderAttentionIcon("mdi:camera-off");
      }
      event = events[0];
    }
    const url = `${this.config.frigate_url}/clips/` +
        `${event.camera}-${event.id}.mp4`;
    return html`
      <video id="frigate-card-clip-player" class="frigate-card-viewer" autoplay controls>
        <source src="${url}" type="video/mp4">
      </video>`
  }

  // Render a snapshot.
  protected async _renderSnapshotViewer(): Promise<TemplateResult> {
    let event: FrigateEvent, events: FrigateGetEventsResponse;
    if (this._viewEvent) {
      event = this._viewEvent;
    } else {
      try {
        events = await this._getEvents({
          has_snapshot: true,
          limit: 1
        });
      } catch (e) {
        return this._renderError(e);
      }
      if (!events.length) {
        return this._renderAttentionIcon("mdi:filmstrip-off");
      }
      event = events[0];
    }
    const url = `${this.config.frigate_url}/clips/${event.camera}-${event.id}.jpg`;
    return html`<img class="frigate-card-viewer" src="${url}">`
  }

  // Render the status bar (motion icon).
  protected _renderStatusBar(): TemplateResult {
    if (!this.config.motion_entity || !(this.config.motion_entity in this.hass.states)) {
      return html``;
    }
    const icon = this.hass.states[this.config.motion_entity].state == "on" ?
        "mdi:motion-sensor" : "mdi:walk"
    return html`
      <div class="frigate-card-statusbar ${
        this._viewMode == FrigateCardView.LIVE ? 'visible' : 'invisible'}
      ">
        <ha-icon-button
          class="button"
          icon="${icon}"
        ></ha-icon-button>
      </div>`
    }

  // Render the live viewer.
  // Note: The live viewer is the main element used to size the overall card. It
  // is always rendered (but sometimes hidden).
  protected _renderLiveViewer(): TemplateResult {
    return html`
      <ha-camera-stream
        id="frigate-card-live-player"
        .hass=${this.hass}
        .stateObj=${this.hass.states[this.config.camera_entity]}
        .controls=${true}
        .muted=${true}
        class=${this._viewMode == FrigateCardView.LIVE ? 'visible' : 'invisible'}
      >
      </ha-camera-stream>`;
  }

  // Record interactions with the card.
  protected _interactionHandler(): void {
    if (!this.config.view_timeout) {
      return;
    }
    if (this._interactionTimerID) {
      window.clearTimeout(this._interactionTimerID);
    }
    this._interactionTimerID = window.setTimeout(() => {
      this._interactionTimerID = null;
      this._setViewModeToDefault();
    }, this.config.view_timeout * 1000);
  }

  // Render the call (master render method).
  protected render(): TemplateResult | void {
    if (this.config.show_warning) {
      return this._showWarning(localize('common.show_warning'));
    }
    if (this.config.show_error) {
      return this._showError(localize('common.show_error'));
    }
    return html`
      <div 
        class="frigate-card-container"
        @click=${this._interactionHandler}
      >
        ${this._renderNavigationBar()}
        ${this._viewMode == FrigateCardView.CLIPS ?
          html`<div class="frigate-card-gallery">
            ${until(this._renderEvents(), this._renderProgressIndicator())}
          </div>` : ``
        }
        ${this._viewMode == FrigateCardView.SNAPSHOTS ?
          html`<div class="frigate-card-gallery">
            ${until(this._renderEvents(), this._renderProgressIndicator())}
          </div>` : ``
        }
        ${this._viewMode == FrigateCardView.CLIP ?
          html`<div class="frigate-card-viewer">
            ${until(this._renderClipPlayer(), this._renderProgressIndicator())}
          </div>` : ``
        }
        ${this._viewMode == FrigateCardView.SNAPSHOT ?
          html`<div class="frigate-card-viewer">
            ${until(this._renderSnapshotViewer(), this._renderProgressIndicator())}
          </div>` : ``
        }
        ${this._renderStatusBar()}
        ${this._renderLiveViewer()}
      </div>`;
  }

  // private _handleAction(ev: ActionHandlerEvent): void {
  //   if (this.hass && this.config && ev.detail.action) {
  //     handleAction(this, this.hass, this.config, ev.detail.action);
  //   }
  // }

  // Show a warning card.
  private _showWarning(warning: string): TemplateResult {
    return html`
      <hui-warning> ${warning} </hui-warning>
        `;
  }

  // Show an error card.
  private _showError(error: string): TemplateResult {
    const errorCard = document.createElement('hui-error-card');
    errorCard.setConfig({
      type: 'error',
      error,
      origConfig: this.config,
    });

    return html`
    ${errorCard}
    `;
  }

  // Get the CSS styles. CSS is compiled from frigate-card.scss, so this is
  // safe to be piped through `unsafeCSS`.
  static get styles(): CSSResult {
    return unsafeCSS(style);
  }

  // Get the Lovelace card size.
  static getCardSize(): number {
    return 5;
  }
}