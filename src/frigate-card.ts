// TODO Make editor work.
// TODO Add title to clips / snapshots playing/viewing
// TODO Add gallery item to take to media browser
// TODO Add documentation & screenshots.
// TODO Sometimes webrtc component shows up as not found in browser (maybe after fresh build?)

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
  fireEvent,
  LovelaceCardEditor,
  getLovelace,
} from 'custom-card-helpers';

import './editor';

import style from './frigate-card.scss'

import { frigateCardConfigSchema, frigateGetEventsResponseSchema } from './types';
import type { FrigateCardConfig, FrigateEvent, FrigateGetEventsResponse, GetEventsParameters, ControlVideosParameters } from './types';
import { CARD_VERSION } from './const';
import { localize } from './localize/localize';
import dayjs from 'dayjs';
import dayjs_utc from 'dayjs/plugin/utc';
import dayjs_timezone from 'dayjs/plugin/timezone';

// Load dayjs plugins.
dayjs.extend(dayjs_timezone);
dayjs.extend(dayjs_utc);

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
    this._webrtcElement = null;
    this._hass = null;
    this._showMenu = false;
  }

  // Get the configuration element.
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('frigate-card-editor');
  }

  // Get a stub basic config.
  public static getStubConfig(): Record<string, string> {
    return {};
  }
  set hass(hass: HomeAssistant) {
    if (this._webrtcElement) {
      this._webrtcElement.hass = hass;
    }
    this._hass = hass;
  }

  @property({ attribute: false })
  protected _hass: HomeAssistant | null;

  @state()
  public config!: FrigateCardConfig;

  @property({ attribute: false })
  protected _viewMode: FrigateCardView;

  @property({ attribute: false })
  protected _viewEvent: FrigateEvent | null;

  @property({ attribute: false })
  protected _showMenu: boolean;

  protected _interactionTimerID: number | null;
  protected _webrtcElement: any | null;

  // Set the object configuration.
  public setConfig(inputConfig: FrigateCardConfig): void {
    if (!inputConfig) {
      throw new Error(localize('common.invalid_configuration:'));
    }

    const parseResult = frigateCardConfigSchema.safeParse(inputConfig);
    if (!parseResult.success) {
      const errors = parseResult.error.format()
      const keys = Object.keys(errors).filter(v => !v.startsWith("_"));
      throw new Error(localize('common.invalid_configuration') + ": " + keys.join(", "));
    }
    const config = parseResult.data;

    if (config.test_gui) {
      getLovelace().setEditMode(true);
    }

    if (!config.frigate_camera_name) {
      // No camera name specified, so just assume it's the same as the entity name.
      if (config.camera_entity.includes(".")) {
        config.frigate_camera_name = config.camera_entity.split('.', 2)[1]
      } else {
        throw new Error(localize('common.invalid_configuration') + ": camera_entity");
      }
    }

    if (config.live_provider == "webrtc") {
      // Create a WebRTC element (https://github.com/AlexxIT/WebRTC)
      const webrtcElement = customElements.get('webrtc-camera');
      if (webrtcElement) {
        const webrtc = new webrtcElement();
        webrtc.setConfig(config.webrtc || {});
        webrtc.hass = this._hass;
        this._webrtcElement = webrtc;
      } else {
        throw new Error(localize('common.missing_webrtc'));
      }
    }

    this.config = config;
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

  // Determine whether the card should be updated.
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this.config || !this._hass) {
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
    
    const oldHass = changedProps.get('_hass') as HomeAssistant | undefined;
  
    if (oldHass) {
      if (cameraEntity in this._hass
          && oldHass.states[cameraEntity] !== this._hass.states[cameraEntity]) {
        return true;
      }
      if (motionEntity
          && motionEntity in this._hass
          && oldHass.states[motionEntity] !== this._hass.states[motionEntity]) {
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

  // Generate a human-readable title from an event.
  // MediaBrowser title: 2021-08-12 19:20:14 [10s, Person 76%]
  protected _getEventTitle(event: FrigateEvent) : string {
    const date = dayjs.unix(event.end_time).tz("UTC").local();

    const iso_datetime = date.format("YYYY-MM-DD HH:mm:ss");
    const duration = Math.trunc(event.end_time > event.start_time ?
        event.end_time - event.start_time : 0);
    const score = Math.trunc(event.top_score*100);

    // Capitalize the label.
    const label = event.label.charAt(0).toUpperCase() + event.label.slice(1);

    return `${iso_datetime} [${duration}s, ${label} ${score}%]`;
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
                data-toggle="tooltip" title="${this._getEventTitle(event)}"
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
        } else if (is_live) {
          // Duration on webrtc is infinity so cannot fast-forward.
          if (!this._webrtcElement) {
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
        this.shadowRoot?.
            querySelector('video.frigate-card-viewer') as HTMLVideoElement);
    }
    if (control_live) {
      // Don't have direct access to the live video player as it is buried in
      // multiple components/shadow-roots, so need to navigate the path to get to <video>.
      if (this._webrtcElement) {
        controlVideo(
          stop,
          true,
          this.shadowRoot?.
              querySelector('webrtc-camera video') as HTMLVideoElement
        )
      } else {
        controlVideo(
          stop,
          true,
          this.shadowRoot?.
              querySelector('ha-camera-stream')?.shadowRoot?.
              querySelector('ha-hls-player')?.shadowRoot?.
              querySelector('video') as HTMLVideoElement
        )
      }
    }
  }

  // Render the Frigate menu button.
  protected _renderFrigateButton(): TemplateResult {
    return html`
      <ha-icon-button
        class="button"
        icon="mdi:alpha-f-box"
        data-toggle="tooltip" title="Frigate menu"
        @click=${() => {
          this._showMenu = !this._showMenu;
        }}
      ></ha-icon-button>`;
  }


  // Render the menu bar.
  protected _renderMenuBar(): TemplateResult {
    if (!this._showMenu) {
      return html`
        <div class="frigate-card-menubar">
          ${this._renderFrigateButton()}
        </div>`;
    }
    
    let motionIcon: string | null = null;
    const motionEntity = this.config.motion_entity ? this.config.motion_entity : null;
    if (motionEntity && this._hass && motionEntity in this._hass.states) {
      motionIcon = (this._hass.states[motionEntity].state == "on" ?
          "mdi:motion-sensor" : "mdi:walk");
    }

    return html`
        <div class="frigate-card-menubar-full">
          ${this._renderFrigateButton()}
          <ha-icon-button
            class="button"
            icon="mdi:cctv"
            data-toggle="tooltip" title="View live"
            @click=${() => {
              this._controlVideos({stop: true, control_clip: true});
              this._controlVideos({stop: false, control_live: true});
              this._viewMode = FrigateCardView.LIVE;
              this._showMenu = false;
            }}
          ></ha-icon-button>
          <ha-icon-button
            class="button"
            icon = "mdi:filmstrip"
            data-toggle="tooltip" title="View clips"
            @click=${() => {
              this._controlVideos({stop: true, control_live: true});
              this._viewMode = FrigateCardView.CLIPS;
              this._showMenu = false;
            }}
          ></ha-icon-button>
          <ha-icon-button
            class="button"
            icon = "mdi:camera"
            data-toggle="tooltip" title="View snapshots"
            @click=${() => {
              this._controlVideos({stop: true, control_clip: true, control_live: true});
              this._viewMode = FrigateCardView.SNAPSHOTS;
              this._showMenu = false;
            }}
          ></ha-icon-button>
          <ha-icon-button
            class="button"
            icon = "mdi:web"
            data-toggle="tooltip" title="View Frigate UI"
            @click=${() => {
              window.open(this.config.frigate_url);
              this._showMenu = false;
            }}
          ></ha-icon-button>
          ${!motionIcon ? html`` : html`
            <ha-icon-button 
              data-toggle="tooltip" title="View motion sensor"
              class="button"
              icon="${motionIcon}"
              @click=${() => {
                fireEvent(this, "hass-more-info", {entityId: motionEntity});
                this._showMenu = false;
              }}
            ></ha-icon-button>`
          }
        </div>
    `;
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
      <video class="frigate-card-viewer" autoplay controls>
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

  // Render the live viewer.
  // Note: The live viewer is the main element used to size the overall card. It
  // is always rendered (but sometimes hidden).
  protected _renderLiveViewer(): TemplateResult {
    if (!this._hass || !(this.config.camera_entity in this._hass.states)) {
      return this._renderError("mdi:camera-off")
    }
    if (this._webrtcElement) {
      return html`
        <div 
          class=${this._viewMode == FrigateCardView.LIVE ? 'visible' : 'invisible'}
        >
          ${this._webrtcElement}  
        </div>`;
    }
    return html`
      <ha-camera-stream
        .hass=${this._hass}
        .stateObj=${this._hass.states[this.config.camera_entity]}
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
      <ha-card @click=${this._interactionHandler}>
        ${this._renderMenuBar()}
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
        ${this._renderLiveViewer()}
      </ha-card>`;
  }

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