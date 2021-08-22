// TODO Put heading back
// TODO Verify getCardSize()

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

import { NodePart } from 'lit-html';
import { until } from 'lit-html/directives/until.js';

import {
  HomeAssistant,
  fireEvent,
  LovelaceCardEditor,
  getLovelace,
} from 'custom-card-helpers';

import './editor';

import frigate_card_style from './frigate-hass-card.scss';
import frigate_card_menu_style from './frigate-hass-card-menu.scss';

import { frigateCardConfigSchema, frigateGetEventsResponseSchema, FrigateMenuMode } from './types';
import type {
  FrigateCardView,
  FrigateCardConfig,
  FrigateEvent,
  FrigateGetEventsResponse,
  GetEventsParameters,
  ControlVideosParameters,
} from './types';
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

type FrigateCardMenuCallback = (name: string) => any;

// Determine whether the card should be updated based on Home Assistant changes.
function shouldUpdateBasedOnHass(
  newHass: HomeAssistant | null,
  oldHass: HomeAssistant | undefined,
  entities: (string | null | undefined)[],
): boolean {
  if (!newHass) {
    return false;
  }
  if (!entities.length) {
    return false;
  }

  if (oldHass) {
    for (let i = 0; i < entities.length; i++) {
      const entity = entities[i];
      if (!entity) {
        continue;
      }
      if (oldHass.states[entity] !== newHass.states[entity]) {
        return true;
      }
    }
    return false;
  }
  return false;
}

// A menu for the Frigate card.
@customElement('frigate-card-menu')
export class FrigateCardMenu extends LitElement {
  static FRIGATE_CARD_MENU_ID: string = 'frigate-card-menu-id' as const;

  @property({ attribute: false })
  protected menuMode: FrigateMenuMode = "hidden";

  @property({ attribute: false })
  protected expand = false;

  @property({ attribute: false })
  protected motionEntity: string | null = null;

  @property({ attribute: false })
  public hass: HomeAssistant | null = null;

  @property({ attribute: false })
  protected actionCallback: FrigateCardMenuCallback | null = null;

  protected shouldUpdate(changedProps: PropertyValues): boolean {
    const oldHass = changedProps.get('hass') as HomeAssistant | undefined;
    if (oldHass) {
      return shouldUpdateBasedOnHass(this.hass, oldHass, [this.motionEntity]);
    }
    return true;
  }

  // Render the Frigate menu button.
  protected _renderFrigateButton(): TemplateResult {
    return html` <ha-icon-button
      class="button"
      icon=${this.menuMode != 'hidden' || this.expand ? 'mdi:alpha-f-box' : 'mdi:alpha-f-box-outline'}
      data-toggle="tooltip"
      title="Frigate menu"
      @click=${() => {
        if (this.menuMode == 'hidden') {
          this.expand = !this.expand;
        } else {
          this._callAction('default');
        }
      }}
    ></ha-icon-button>`;
  }

  // Call the callback.
  protected _callAction(name: string): void {
    if (this.actionCallback) {
      this.actionCallback(name);
    }
  }

  // Render the menu.
  protected render(): TemplateResult | void | ((part: NodePart) => Promise<void>) {
    let motionIcon: string | null = null;
    if (this.motionEntity && this.hass) {
      motionIcon =
        this.hass.states[this.motionEntity]?.state == 'on'
          ? 'mdi:motion-sensor'
          : 'mdi:walk';
    }

    let menuClass = "frigate-card-menu-full";
    if (["hidden", "overlay"].includes(this.menuMode)) {
      if (this.menuMode == 'overlay' || this.expand) {
        menuClass = "frigate-card-menu-overlay";
      } else {
        menuClass = "frigate-card-menu-hidden";
      }
    }

    return html`
      <div class=${menuClass}>
        ${this._renderFrigateButton()}
        ${this.menuMode != "hidden" || this.expand ? html`
          <ha-icon-button
            class="button"
            icon="mdi:cctv"
            data-toggle="tooltip"
            title="View live"
            @click=${() => {
              this.expand = false;
              this._callAction('live');
            }}
          ></ha-icon-button>
          <ha-icon-button
            class="button"
            icon="mdi:filmstrip"
            data-toggle="tooltip"
            title="View clips"
            @click=${() => {
              this.expand = false;
              this._callAction('clips');
            }}
          ></ha-icon-button>
          <ha-icon-button
            class="button"
            icon="mdi:camera"
            data-toggle="tooltip"
            title="View snapshots"
            @click=${() => {
              this.expand = false;
              this._callAction('snapshots');
            }}
          ></ha-icon-button>
          <ha-icon-button
            class="button"
            icon="mdi:web"
            data-toggle="tooltip"
            title="View Frigate UI"
            @click=${() => {
              this.expand = false;
              this._callAction('frigate-ui');
            }}
          ></ha-icon-button>
          ${!motionIcon
            ? html``
            : html` <ha-icon-button
                data-toggle="tooltip"
                title="View motion sensor"
                class="button"
                icon="${motionIcon}"
                @click=${() => {
                  this.expand = false;
                  this._callAction('motion');
                }}
              ></ha-icon-button>`}
        ` : ``}
      </div>
    `;
  }

  // Return compiled CSS styles (thus safe to use with unsafeCSS).
  static get styles(): CSSResult {
    return unsafeCSS(frigate_card_menu_style);
  }
}

// Main FrigateCard class.
@customElement('frigate-card')
export class FrigateCard extends LitElement {
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

    // Manually set hass in the menu. This is to allow the menu to update,
    // without necessarily re-rendering the entire card (re-rendering interrupts
    // clip playing).
    const menu = this.shadowRoot?.getElementById(
      FrigateCardMenu.FRIGATE_CARD_MENU_ID,
    ) as FrigateCardMenu;
    if (menu) {
      menu.hass = hass;
    }
  }

  @property({ attribute: false })
  protected _hass: HomeAssistant | null = null;

  @state()
  public config!: FrigateCardConfig;

  @property({ attribute: false })
  protected _viewMode: FrigateCardView = 'live';

  @property({ attribute: false })
  protected _viewEvent: FrigateEvent | null = null;

  @property({ attribute: false })
  protected _showMenu = false;

  @state()
  protected _heading: string | null = null;

  protected _interactionTimerID: number | null = null;
  protected _webrtcElement: any | null = null;

  // Whether or not there is an active clip being played.
  protected _clipPlaying = false;

  // Set the object configuration.
  public setConfig(inputConfig: FrigateCardConfig): void {
    if (!inputConfig) {
      throw new Error(localize('common.invalid_configuration:'));
    }

    const parseResult = frigateCardConfigSchema.safeParse(inputConfig);
    if (!parseResult.success) {
      const errors = parseResult.error.format();
      const keys = Object.keys(errors).filter((v) => !v.startsWith('_'));
      throw new Error(localize('common.invalid_configuration') + ': ' + keys.join(', '));
    }
    const config = parseResult.data;

    if (config.test_gui) {
      getLovelace().setEditMode(true);
    }

    if (!config.frigate_camera_name) {
      // No camera name specified, so just assume it's the same as the entity name.
      if (config.camera_entity.includes('.')) {
        config.frigate_camera_name = config.camera_entity.split('.', 2)[1];
      } else {
        throw new Error(localize('common.invalid_configuration') + ': camera_entity');
      }
    }

    if (config.live_provider == 'webrtc') {
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
    this._viewMode = this.config.view_default;
    if (['clip', 'snapshot'].includes(this._viewMode)) {
      this._viewEvent = null;
    }
  }

  // Determine whether the card should be updated.
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this.config) {
      return false;
    }
    if (changedProps.has('config')) {
      return true;
    }

    const oldHass = changedProps.get('_hass') as HomeAssistant | undefined;
    if (oldHass) {
      // A re-render will interrupt a clip that is playing. Do not allow this
      // for hass state updates.
      if (this._clipPlaying) {
        return false;
      }
      return shouldUpdateBasedOnHass(this._hass, oldHass, [
        this.config.camera_entity,
        this.config.motion_entity,
      ]);
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
      url += `&has_clip=1`;
    }
    if (has_snapshot) {
      url += `&has_snapshot=1`;
    }
    if (limit > 0) {
      url += `&limit=${limit}`;
    }

    if (this.config.label) {
      url += `&label=${this.config.label}`;
    }
    if (this.config.zone) {
      url += `&zone=${this.config.zone}`;
    }

    const response = await fetch(url);
    if (response.ok) {
      let raw_json;
      try {
        raw_json = await response.json();
      } catch (e) {
        console.warn(e);
        throw new Error(`Could not JSON decode Frigate API response: ${e}`);
      }
      try {
        return frigateGetEventsResponseSchema.parse(raw_json);
      } catch (e) {
        console.warn(e);
        throw new Error(`Frigate events were malformed: ${e}`);
      }
    } else {
      const error_message = `Frigate API request failed with status: ${response.status}`;
      console.warn(error_message);
      throw new Error(error_message);
    }
  }

  // Render an attention grabbing icon.
  protected _renderAttentionIcon(
    icon: string,
    tooltip: string | null = null,
  ): TemplateResult {
    return html` <div class="frigate-card-attention">
      <ha-icon data-toggle="tooltip" title=${tooltip ? tooltip : ''} icon="${icon}">
      </ha-icon>
    </div>`;
  }

  // Render an embedded error situation.
  protected _renderError(error: string): TemplateResult {
    return this._renderAttentionIcon('mdi:alert-circle', error);
  }

  // Generate a human-readable title from an event.
  // MediaBrowser title: 2021-08-12 19:20:14 [10s, Person 76%]
  protected _getEventTitle(event: FrigateEvent): string {
    const date = dayjs.unix(event.end_time).tz('UTC').local();

    const iso_datetime = date.format('YYYY-MM-DD HH:mm:ss');
    const duration = Math.trunc(
      event.end_time > event.start_time ? event.end_time - event.start_time : 0,
    );
    const score = Math.trunc(event.top_score * 100);

    // Capitalize the label.
    const label = event.label.charAt(0).toUpperCase() + event.label.slice(1);

    return `${iso_datetime} [${duration}s, ${label} ${score}%]`;
  }

  // Render Frigate events into a card gallery.
  protected async _renderEvents(): Promise<TemplateResult> {
    const want_clips = this._viewMode == 'clips';
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
      return this._renderAttentionIcon(
        want_clips ? 'mdi:filmstrip-off' : 'mdi:camera-off',
        want_clips ? 'No clips' : 'No snapshots',
      );
    }

    return html` <ul class="mdc-image-list frigate-card-image-list">
      ${events.map(
        (event) => html` <li class="mdc-image-list__item">
          <div class="mdc-image-list__image-aspect-container">
            <img
              data-toggle="tooltip"
              title="${this._getEventTitle(event)}"
              class="mdc-image-list__image"
              src="data:image/png;base64,${event.thumbnail}"
              @click=${() => {
                this._showMenu = false;
                this._viewEvent = event;
                this._viewMode = want_clips ? 'clip' : 'snapshot';
              }}
            />
          </div>
        </li>`,
      )}
    </ul>`;
  }

  // Render a progress spinner while content loads.
  protected _renderProgressIndicator(): TemplateResult {
    return html` <div class="frigate-card-attention">
      <ha-circular-progress active="true" size="large"></ha-circular-progress>
    </div>`;
  }

  // Stop/Play video controls.
  protected _controlVideos({
    stop,
    control_live = false,
    control_clip = false,
  }: ControlVideosParameters): void {
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
    };
    if (!this.shadowRoot) {
      return;
    }
    if (control_clip) {
      controlVideo(
        stop,
        false,
        this.shadowRoot?.querySelector('video.frigate-card-viewer') as HTMLVideoElement,
      );
    }
    if (control_live) {
      // Don't have direct access to the live video player as it is buried in
      // multiple components/shadow-roots, so need to navigate the path to get to <video>.
      if (this._webrtcElement) {
        controlVideo(
          stop,
          true,
          this.shadowRoot?.querySelector('webrtc-camera video') as HTMLVideoElement,
        );
      } else {
        controlVideo(
          stop,
          true,
          this.shadowRoot
            ?.querySelector('ha-camera-stream')
            ?.shadowRoot?.querySelector('ha-hls-player')
            ?.shadowRoot?.querySelector('video') as HTMLVideoElement,
        );
      }
    }
  }

  protected _menuActionHandler(name: string): void {
    switch (name) {
      case 'default':
        this._controlVideos({ stop: true, control_clip: true });
        this._controlVideos({ stop: true, control_live: true });
        this._heading = null;
        this._setViewModeToDefault();
        break;      
      case 'live':
        this._controlVideos({ stop: true, control_clip: true });
        this._controlVideos({ stop: false, control_live: true });
        this._viewMode = name;
        this._heading = null;
        break;
      case 'clips':
        this._controlVideos({ stop: true, control_live: true });
        this._viewMode = name;
        this._heading = null;
        break;
      case 'snapshots':
        this._controlVideos({ stop: true, control_clip: true, control_live: true });
        this._viewMode = name;
        this._heading = null;
        break;
      case 'frigate-ui':
        window.open(this.config.frigate_url);
        break;
      case 'motion':
        if (this.config.motion_entity) {
          fireEvent(this, 'hass-more-info', { entityId: this.config.motion_entity });
        }
        break;
      default:
        console.warn('Unknown Frigate card menu option.');
    }
  }

  protected _getClipURLFromEvent(event: FrigateEvent): string | null {
    if (!event.has_clip) {
      return null;
    }
    return `${this.config.frigate_url}/clips/${event.camera}-${event.id}.mp4`;
  }

  protected _getSnapshotURLFromEvent(event: FrigateEvent): string | null {
    if (!event.has_snapshot) {
      return null;
    }
    return `${this.config.frigate_url}/clips/${event.camera}-${event.id}.jpg`;
  }

  // Render the player for a saved clip.
  protected async _renderClipPlayer(): Promise<TemplateResult> {
    let event: FrigateEvent, events: FrigateGetEventsResponse;
    let autoplay = true;
    if (this._viewEvent) {
      event = this._viewEvent;
    } else {
      try {
        events = await this._getEvents({
          has_clip: true,
          limit: 1,
        });
      } catch (e) {
        return this._renderError(e);
      }
      if (!events.length) {
        return this._renderAttentionIcon('mdi:camera-off', 'No recent clip');
      }
      event = events[0];

      // In this block, no clip has been manually selected, so this is loading
      // the most recent clip on card load. In this mode, autoplay of the clip
      // may be disabled by configuration. If does not make sense to disable
      // autoplay when the user has explicitly picked an event to play in the
      // gallery.
      autoplay = this.config.autoplay_clip;
    }

    const clipURL = this._getClipURLFromEvent(event);
    if (!clipURL) {
      // Frigate has returned an event without a clip, even though it was
      // specifically asked only for events with clips.
      return this._renderAttentionIcon('mdi:camera-off', 'No recent clip');
    }

    this._heading = this._getEventTitle(event);

    return html` <video
      class="frigate-card-viewer"
      muted
      controls
      @play=${() => {
        this._clipPlaying = true;
      }}
      @pause=${() => {
        this._clipPlaying = false;
      }}
      ?autoplay="${autoplay}"
    >
      <source src="${clipURL}" type="video/mp4" />
    </video>`;
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
          limit: 1,
        });
      } catch (e) {
        return this._renderError(e);
      }
      if (!events.length) {
        return this._renderAttentionIcon('mdi:filmstrip-off', 'No recent snapshots');
      }
      event = events[0];
    }

    const snapshotURL = this._getSnapshotURLFromEvent(event);
    if (!snapshotURL) {
      // Frigate has returned an event without a snapshot, even though it was
      // specifically asked only for events with snapshots.
      return this._renderAttentionIcon('mdi:filmstrip-off', 'No recent snapshots');
    }

    this._heading = this._getEventTitle(event);

    return html` <img
      class="frigate-card-viewer"
      src="${snapshotURL}"
      @click=${() => {
        if (event.has_clip) {
          this._viewEvent = event;
          this._viewMode = 'clip';
        }
      }}
    />`;
  }

  // Render the live viewer.
  // Note: The live viewer is the main element used to size the overall card. It
  // is always rendered (but sometimes hidden).
  protected _renderLiveViewer(): TemplateResult {
    if (!this._hass || !(this.config.camera_entity in this._hass.states)) {
      return this._renderAttentionIcon('mdi:camera-off', 'No live camera');
    }
    if (this._webrtcElement) {
      return html`${this._webrtcElement}`;
    }
    return html` <ha-camera-stream
      .hass=${this._hass}
      .stateObj=${this._hass.states[this.config.camera_entity]}
      .controls=${true}
      .muted=${true}
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

  protected _renderMenu(): TemplateResult | void {
    return html`
      <frigate-card-menu
        id="${FrigateCardMenu.FRIGATE_CARD_MENU_ID}"
        .motionEntity=${this.config.motion_entity}
        .hass=${this._hass}
        .actionCallback=${this._menuActionHandler.bind(this)}
        .menuMode=${this.config.menu_mode}
      ></frigate-card-menu>
    `;
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
        ${this.config.menu_mode != 'below' ? this._renderMenu() : ''}
        <div class="frigate-card-contents">
          ${
            this._viewMode == 'clips'
              ? html`<div class="frigate-card-gallery">
                  ${until(this._renderEvents(), this._renderProgressIndicator())}
                </div>`
              : ``
          }
          ${
            this._viewMode == 'snapshots'
              ? html`<div class="frigate-card-gallery">
                  ${until(this._renderEvents(), this._renderProgressIndicator())}
                </div>`
              : ``
          }
          ${
            this._viewMode == 'clip'
              ? html`<div class="frigate-card-viewer">
                  ${until(this._renderClipPlayer(), this._renderProgressIndicator())}
                </div>`
              : ``
          }
          ${
            this._viewMode == 'snapshot'
              ? html`<div class="frigate-card-viewer">
                  ${until(this._renderSnapshotViewer(), this._renderProgressIndicator())}
                </div>`
              : ``
          }
          ${
            this._viewMode == 'live'
              ? html`<div class="frigate-card-viewer">
                ${this._renderLiveViewer()}
              </div>`
            : ``            
          }
        </div>
        ${this.config.menu_mode == 'below' ? this._renderMenu() : ''}
      </ha-card>`;
  }

  // Show a warning card.
  private _showWarning(warning: string): TemplateResult {
    return html` <hui-warning> ${warning} </hui-warning> `;
  }

  // Show an error card.
  private _showError(error: string): TemplateResult {
    const errorCard = document.createElement('hui-error-card');
    errorCard.setConfig({
      type: 'error',
      error,
      origConfig: this.config,
    });

    return html` ${errorCard} `;
  }

  // Return compiled CSS styles (thus safe to use with unsafeCSS).
  static get styles(): CSSResult {
    return unsafeCSS(frigate_card_style);
  }

  // Get the Lovelace card size.
  static getCardSize(): number {
    return 5;
  }
}
