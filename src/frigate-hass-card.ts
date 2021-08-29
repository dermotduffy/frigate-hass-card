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
  query,
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

import {
  browseMediaSourceSchema,
  frigateCardConfigSchema,
  MenuButton,
  resolvedMediaSchema,
} from './types';
import type {
  BrowseMediaSource,
  FrigateCardView,
  FrigateCardConfig,
  FrigateMenuMode,
  MediaBeingShown,
  ResolvedMedia,
} from './types';
import { CARD_VERSION } from './const';
import { localize } from './localize/localize';
import dayjs from 'dayjs';
import dayjs_custom_parse_format from 'dayjs/plugin/customParseFormat';

import { z, ZodSchema } from 'zod';
import { MessageBase } from 'home-assistant-js-websocket';

const URL_TROUBLESHOOTING =
  'https://github.com/dermotduffy/frigate-hass-card#troubleshooting';

// Load dayjs plugin(s).
dayjs.extend(dayjs_custom_parse_format);

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
  protected menuMode: FrigateMenuMode = 'hidden';

  @property({ attribute: false })
  protected expand = false;

  @property({ attribute: false })
  protected actionCallback: FrigateCardMenuCallback | null = null;

  @property({ attribute: false })
  public buttons: Map<string, MenuButton> = new Map();

  // Call the callback.
  protected _callAction(name: string): void {
    if (this.menuMode == 'hidden') {
      if (name == 'frigate') {
        this.expand = !this.expand;
        return;
      }
      // Collapse menu after the user clicks on something.
      this.expand = false;
    }

    if (this.actionCallback) {
      this.actionCallback(name);
    }
  }

  // Render a menu button.
  protected _renderButton(name: string, button: MenuButton): TemplateResult {
    return html` <ha-icon-button
      class=${button.emphasize ? 'emphasized-button' : 'button'}
      icon=${button.icon || 'mdi:gesture-tap-button'}
      data-toggle="tooltip"
      title=${button.description}
      @click=${() => this._callAction(name)}
    ></ha-icon-button>`;
  }

  // Render the Frigate menu button.
  protected _renderFrigateButton(name: string, button: MenuButton): TemplateResult {
    const icon =
      this.menuMode != 'hidden' || this.expand
        ? 'mdi:alpha-f-box'
        : 'mdi:alpha-f-box-outline';

    return this._renderButton(name, Object.assign({}, button, { icon: icon }));
  }

  // Render the menu.
  protected render(): TemplateResult | void | ((part: NodePart) => Promise<void>) {
    let menuClass = 'frigate-card-menu-full';
    if (['hidden', 'overlay'].includes(this.menuMode)) {
      if (this.menuMode == 'overlay' || this.expand) {
        menuClass = 'frigate-card-menu-overlay';
      } else {
        menuClass = 'frigate-card-menu-hidden';
      }
    }

    return html`
      <div class=${menuClass}>
        ${Array.from(this.buttons.keys()).map((name) => {
          const button = this.buttons.get(name);
          if (button) {
            return name === 'frigate'
              ? this._renderFrigateButton(name, button)
              : this._renderButton(name, button);
          }
          return html``;
        })}
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
    this._updateMenu();
  }

  @property({ attribute: false })
  protected _hass: HomeAssistant | null = null;

  @state()
  public config!: FrigateCardConfig;

  @property({ attribute: false })
  protected _viewMode: FrigateCardView = 'live';

  protected _interactionTimerID: number | null = null;
  protected _webrtcElement: any | null = null;

  // A specific media source requested by the user.
  @property({ attribute: false })
  protected _requestedMediaSource: BrowseMediaSource | null = null;

  // Media (both browse item & resolved media) actually being shown to the user.
  // This may be different from _requestedMediaSource when no particular event is
  // requested (e.g. 'clip' view that views the most recent) -- in that case the
  // requestedEvent will be null, but _mediaBeingShown will be the actual event
  // shown.
  protected _mediaBeingShown: MediaBeingShown | null = null;

  // Whether or not there is an active clip being played.
  protected _clipPlaying = false;

  @query(FrigateCardMenu.FRIGATE_CARD_MENU_ID)
  _menu!: FrigateCardMenu | null;

  protected _updateMenu(): void {
    // Manually set hass in the menu. This is to allow the menu to update,
    // without necessarily re-rendering the entire card (re-rendering interrupts
    // clip playing).
    if (!this._menu || !this._hass) {
      return;
    }

    this._menu.buttons = this._getMenuButtons();
  }

  protected _getMenuButtons(): Map<string, MenuButton> {
    const buttons: Map<string, MenuButton> = new Map();

    buttons.set('frigate', { description: 'Frigate Menu' });
    buttons.set('live', { icon: 'mdi:cctv', description: 'View Live' });
    buttons.set('clips', { icon: 'mdi:filmstrip', description: 'View Clips' });
    buttons.set('snapshots', { icon: 'mdi:camera', description: 'View Snapshots' });
    if (this.config.frigate_url) {
      buttons.set('frigate_ui', { icon: 'mdi:web', description: 'View Frigate UI' });
    }

    if (this._hass && this.config.motion_entity) {
      const on = this._hass.states[this.config.motion_entity]?.state == 'on';
      const motionIcon = on ? 'mdi:motion-sensor' : 'mdi:walk';

      buttons.set('motion', {
        icon: motionIcon,
        description: 'View Motion Sensor',
        emphasize: on,
      });
    }
    return buttons;
  }

  protected _getParseErrorKeys(error: z.ZodError): string[] {
    const errors = error.format();
    return Object.keys(errors).filter((v) => !v.startsWith('_'));
  }

  // Set the object configuration.
  public setConfig(inputConfig: FrigateCardConfig): void {
    if (!inputConfig) {
      throw new Error(localize('common.invalid_configuration:'));
    }

    const parseResult = frigateCardConfigSchema.safeParse(inputConfig);
    if (!parseResult.success) {
      const keys = this._getParseErrorKeys(parseResult.error);
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
      const webrtcElement = customElements.get('webrtc-camera') as any;
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
    this._changeView();
  }

  // Update the card view.
  protected _changeView(
    view?: FrigateCardView | undefined,
    mediaSource?: BrowseMediaSource | undefined,
  ): void {
    this._viewMode = view || this.config.view_default;
    this._requestedMediaSource = mediaSource || null;
    this._mediaBeingShown = null;
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
      // Home Assistant pumps a lot of updates through. Re-rendering the card is
      // necessary at times (e.g. to update the 'clip' view as new clips
      // arrive), but also is a jarring experience for the user (e.g. if they
      // are browsing the mini-gallery). Do not allow re-rendering from a Home
      // Assistant update if there's been recent interaction (e.g. clicks on the
      // card) or if there is a clip active playing.
      if (this._interactionTimerID || this._clipPlaying) {
        return false;
      }
      return shouldUpdateBasedOnHass(this._hass, oldHass, [
        this.config.camera_entity,
        this.config.motion_entity,
      ]);
    }
    return true;
  }

  // Make a websocket request to Home Assistant.
  protected async _makeWSRequest<T>(
    schema: ZodSchema<T>,
    request: MessageBase,
  ): Promise<T | null> {
    if (!this._hass) {
      return null;
    }

    const response = await this._hass.callWS<T>(request);

    if (!response) {
      const error_message = `Received empty response from Home Assistant for request ${JSON.stringify(
        request,
      )}`;
      console.warn(error_message);
      throw new Error(error_message);
    }
    const parseResult = schema.safeParse(response);
    if (!parseResult.success) {
      const keys = this._getParseErrorKeys(parseResult.error);
      const error_message =
        `Received invalid response from Home Assistant for request ${JSON.stringify(
          request,
        )}, ` + `invalid keys were '${keys}'`;
      console.warn(error_message);
      throw new Error(error_message);
    }
    return parseResult.data;
  }

  // Browse Frigate media with a media content id.
  protected async _browseMedia(
    media_content_id: string,
  ): Promise<BrowseMediaSource | null> {
    const request = {
      type: 'media_source/browse_media',
      media_content_id: media_content_id,
    };
    return this._makeWSRequest(browseMediaSourceSchema, request);
  }

  // Browse Frigate media with query parameters.
  protected async _browseMediaQuery(
    want_clips?: boolean,
    before?: number,
    after?: number,
  ): Promise<BrowseMediaSource | null> {
    return this._browseMedia(
      // Defined in:
      // https://github.com/blakeblackshear/frigate-hass-integration/blob/master/custom_components/frigate/media_source.py
      [
        'media-source://frigate',
        this.config.frigate_client_id,
        'event-search',
        want_clips ? 'clips' : 'snapshots',
        '', // Name/Title to render (not necessary here)
        after ? String(after) : '',
        before ? String(before) : '',
        this.config.frigate_camera_name,
        this.config.label,
        this.config.zone,
      ].join('/'),
    );
  }

  // Resolve Frigate media identifier to a real URL.
  protected async _resolveMedia(
    mediaSource: BrowseMediaSource,
  ): Promise<ResolvedMedia | null> {
    const request = {
      type: 'media_source/resolve_media',
      media_content_id: mediaSource.media_content_id,
    };
    return this._makeWSRequest(resolvedMediaSchema, request);
  }

  // Render an attention grabbing icon.
  protected _renderAttentionIcon(
    icon: string,
    message: string | TemplateResult | null = null,
  ): TemplateResult {
    return html` <div class="frigate-card-attention">
      <span>
        <ha-icon icon="${icon}"> </ha-icon>
        ${message ? html`&nbsp;${message}` : ''}
      </span>
    </div>`;
  }

  // Render an embedded error situation.
  protected _renderError(error: string): TemplateResult {
    return this._renderAttentionIcon(
      'mdi:alert-circle',
      html`${
        error ? `${error} .` : `Unknown error`
      }Check <a href="${URL_TROUBLESHOOTING}">troubleshooting</a></span>.`,
    );
  }

  // Render Frigate events into a card gallery.
  protected async _renderEvents(): Promise<TemplateResult> {
    const want_clips = this._viewMode == 'clips';
    let media;
    try {
      if (this._requestedMediaSource) {
        media = await this._browseMedia(this._requestedMediaSource.media_content_id);
      } else {
        media = await this._browseMediaQuery(want_clips);
      }
    } catch (e: any) {
      return this._renderError(e.message);
    }
    const firstMediaItem = this._getFirstTrueMediaItem(media);
    if (!firstMediaItem) {
      return this._renderAttentionIcon(
        want_clips ? 'mdi:filmstrip-off' : 'mdi:camera-off',
        want_clips ? 'No clips' : 'No snapshots',
      );
    }

    return html` <ul class="mdc-image-list frigate-card-image-list">
      ${media.children.map(
        (mediaSource) =>
          html` <li class="mdc-image-list__item">
            <div class="mdc-image-list__image-aspect-container">
              ${mediaSource.can_expand
                ? html`<div class="mdc-image-list__image">
                    <ha-card
                      @click=${() => {
                        this._changeView(this._viewMode, mediaSource);
                      }}
                      outlined=""
                      class="frigate-card-image-list-folder"
                    >
                      <div>${mediaSource.title}</div>
                    </ha-card>
                  </div>`
                : html`<img
                    data-toggle="tooltip"
                    title="${mediaSource.title}"
                    class="mdc-image-list__image"
                    src="${mediaSource.thumbnail}"
                    @click=${() => {
                      this._changeView(want_clips ? 'clip' : 'snapshot', mediaSource);
                    }}
                  />`}
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

  protected _menuActionHandler(name: string): void {
    switch (name) {
      case 'frigate':
        this._changeView();
        break;
      case 'live':
      case 'clips':
      case 'snapshots':
        this._changeView(name);
        break;
      case 'frigate_ui':
        const frigate_url = this._getFrigateURLFromContext();
        if (frigate_url) {
          window.open(frigate_url);
        }
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

  // Extract the Frigate event id from the resolved media. Unfortunately, there
  // is no way to attach metadata to BrowseMediaSource so this must suffice.
  protected _extractEventIDFromResolvedMedia(
    resolvedMedia: ResolvedMedia,
  ): string | null {
    // Example: /api/frigate/frigate/clips/camera-1630123639.21596-l1y9af.jpg?authSig=[large_string]
    const result = resolvedMedia.url.match(/-(?<id>[\w]+)\.(jpg|m3u8|mp4)($|\?)/i);
    if (result && result.groups) {
      return result.groups['id'] || null;
    }
    return null;
  }

  protected _extractEventStartTimeFromBrowseMedia(
    browseMedia: BrowseMediaSource,
  ): number | null {
    // Example: 2021-08-27 20:57:22 [10s, Person 76%]
    const result = browseMedia.title.match(/^(?<iso_datetime>.+) \[/);
    if (result && result.groups) {
      const iso_datetime_str = result.groups['iso_datetime'];
      if (iso_datetime_str) {
        const iso_datetime = dayjs(iso_datetime_str, 'YYYY-MM-DD HH:mm:ss', true);
        if (iso_datetime.isValid()) {
          return iso_datetime.unix();
        }
      }
    }
    return null;
  }

  // Get the Frigate UI url.
  protected _getFrigateURLFromContext(): string | null {
    if (!this.config.frigate_url) {
      return null;
    }
    if (this._mediaBeingShown) {
      const eventID = this._extractEventIDFromResolvedMedia(
        this._mediaBeingShown.resolvedMedia,
      );
      if (eventID) {
        return `${this.config.frigate_url}/events/${eventID}`;
      }
    }
    return `${this.config.frigate_url}/cameras/${this.config.frigate_camera_name}`;
  }

  // From a BrowseMediaSource item extract the first true media item (i.e. a
  // clip/snapshot, not a folder).
  protected _getFirstTrueMediaItem(media: BrowseMediaSource): BrowseMediaSource | null {
    return media.children?.find((mediaSource) => !mediaSource.can_expand) || null;
  }

  // Render the player for a saved clip.
  protected async _renderClipPlayer(): Promise<TemplateResult> {
    let mediaSource: BrowseMediaSource;
    let autoplay = true;
    if (this._requestedMediaSource) {
      mediaSource = this._requestedMediaSource;
    } else {
      let media;
      try {
        media = await this._browseMediaQuery(true);
      } catch (e: any) {
        return this._renderError(e.message);
      }
      const firstMediaItem = this._getFirstTrueMediaItem(media);
      if (!firstMediaItem) {
        return this._renderAttentionIcon('mdi:filmstrip-off', 'No recent clip');
      }
      mediaSource = firstMediaItem;

      // In this block, no clip has been manually selected, so this is loading
      // the most recent clip on card load. In this mode, autoplay of the clip
      // may be disabled by configuration. If does not make sense to disable
      // autoplay when the user has explicitly picked an event to play in the
      // gallery.
      autoplay = this.config.autoplay_clip;
    }

    const resolvedMedia = await this._resolveMedia(mediaSource);
    if (!resolvedMedia) {
      // Home Assistant could not resolve media item.
      return this._renderError('Could not resolve clip URL');
    }

    this._mediaBeingShown = {
      browseMedia: mediaSource,
      resolvedMedia: resolvedMedia,
    };

    return html`
      <ha-hls-player
        .hass=${this._hass}
        .url=${resolvedMedia.url}
        class="frigate-card-viewer"
        muted
        controls
        playsinline
        allow-exoplayer
        ?autoplay="${autoplay}"
      >
      </ha-hls-player>
    `;
  }

  public updated(): void {
    this.updateComplete.then(() => {
      // DOM elements are not always present until after updateComplete promise
      // is resolved. Note that children of children (i.e. the underlying video
      // element) is not always present even when the promise returns, so
      // capture the event at the upper shadow root instead.
      const hls_player = this.renderRoot
        ?.querySelector('ha-card')
        ?.querySelector('ha-hls-player');

      if (hls_player) {
        hls_player.shadowRoot?.addEventListener(
          'play',
          () => {
            this._clipPlaying = true;
          },
          true,
        );
        hls_player.shadowRoot?.addEventListener(
          'pause',
          () => {
            this._clipPlaying = true;
          },
          true,
        );
      }
    });
  }

  // Get a clip at the same time as a snapshot.
  protected async _findRelatedClips(
    snapshot: BrowseMediaSource,
  ): Promise<BrowseMediaSource | null> {
    const startTime = this._extractEventStartTimeFromBrowseMedia(snapshot);
    if (startTime) {
      try {
        // Fetch clips within the same second (same camera/zone/label, etc).
        const clipsAtSameTime = await this._browseMediaQuery(
          true,
          startTime + 1,
          startTime,
        );
        if (clipsAtSameTime) {
          return this._getFirstTrueMediaItem(clipsAtSameTime);
        }
      } catch (e: any) {
        // Pass. This is best effort.
      }
    }
    return null;
  }

  // Render a snapshot.
  protected async _renderSnapshotViewer(): Promise<TemplateResult> {
    let mediaSource: BrowseMediaSource;
    if (this._requestedMediaSource) {
      mediaSource = this._requestedMediaSource;
    } else {
      let media;
      try {
        media = await this._browseMediaQuery(false);
      } catch (e: any) {
        return this._renderError(e.message);
      }
      const firstMediaItem = this._getFirstTrueMediaItem(media);
      if (!firstMediaItem) {
        return this._renderAttentionIcon('mdi:camera-off', 'No recent snapshots');
      }
      mediaSource = firstMediaItem;
    }

    const resolvedMedia = await this._resolveMedia(mediaSource);
    if (!resolvedMedia) {
      // Home Assistant could not resolve media item.
      return this._renderError('Could not resolve snapshot URL');
    }

    this._mediaBeingShown = {
      browseMedia: mediaSource,
      resolvedMedia: resolvedMedia,
    };

    return html` <img
      class="frigate-card-viewer"
      src="${resolvedMedia.url}"
      @click=${() => {
        // Get clips potentially related to this snapshot.
        this._findRelatedClips(mediaSource).then((relatedClip) => {
          if (relatedClip) {
            this._changeView('clip', relatedClip);
          }
        });
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
      this._changeView();
    }, this.config.view_timeout * 1000);
  }

  protected _renderMenu(): TemplateResult | void {
    return html`
      <frigate-card-menu
        id="${FrigateCardMenu.FRIGATE_CARD_MENU_ID}"
        .actionCallback=${this._menuActionHandler.bind(this)}
        .menuMode=${this.config.menu_mode}
        .buttons=${this._getMenuButtons()}
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
    return html` <ha-card @click=${this._interactionHandler}>
      ${this.config.menu_mode != 'below' ? this._renderMenu() : ''}
      <div class="frigate-card-contents">
        ${this._viewMode == 'clips'
          ? html`<div class="frigate-card-gallery">
              ${until(this._renderEvents(), this._renderProgressIndicator())}
            </div>`
          : ``}
        ${this._viewMode == 'snapshots'
          ? html`<div class="frigate-card-gallery">
              ${until(this._renderEvents(), this._renderProgressIndicator())}
            </div>`
          : ``}
        ${this._viewMode == 'clip'
          ? html`<div class="frigate-card-viewer">
              ${until(this._renderClipPlayer(), this._renderProgressIndicator())}
            </div>`
          : ``}
        ${this._viewMode == 'snapshot'
          ? html`<div class="frigate-card-viewer">
              ${until(this._renderSnapshotViewer(), this._renderProgressIndicator())}
            </div>`
          : ``}
        ${this._viewMode == 'live'
          ? html`<div class="frigate-card-viewer">${this._renderLiveViewer()}</div>`
          : ``}
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
