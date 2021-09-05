/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LitElement,
  CSSResultGroup,
  TemplateResult,
  PropertyValues,
  html,
  unsafeCSS,
} from 'lit';
import { customElement, property, query, state, } from 'lit/decorators';
import { until } from 'lit/directives/until.js';
import { classMap } from 'lit/directives/class-map.js';

import {
  HomeAssistant,
  LovelaceCardEditor,
  fireEvent,
  getLovelace,
  stateIcon,
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
  BrowseMediaNeighbors,
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
  name: localize('common.frigate_card'),
  description: localize('common.frigate_card_description'),
});

type FrigateCardMenuCallback = (name: string) => any;

// Determine whether the card should be updated based on Home Assistant changes.
function shouldUpdateBasedOnHass(
  newHass: HomeAssistant | null,
  oldHass: HomeAssistant | undefined,
  entities: string[] | null,
): boolean {
  if (!newHass || !entities) {
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
  protected menuMode: FrigateMenuMode = 'hidden-top';

  @property({ attribute: false })
  protected expand = false;

  @property({ attribute: false })
  protected actionCallback: FrigateCardMenuCallback | null = null;

  @property({ attribute: false })
  public buttons: Map<string, MenuButton> = new Map();

  // Call the callback.
  protected _callAction(name: string): void {
    if (this.menuMode.startsWith('hidden-')) {
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
    const classes = {
      button: true,
      emphasize: button.emphasize ?? false,
    };

    return html` <ha-icon-button
      class="${classMap(classes)}"
      icon=${button.icon || 'mdi:gesture-tap-button'}
      data-toggle="tooltip"
      title=${button.description}
      @click=${() => this._callAction(name)}
    ></ha-icon-button>`;
  }

  // Render the Frigate menu button.
  protected _renderFrigateButton(name: string, button: MenuButton): TemplateResult {
    const icon =
      this.menuMode.startsWith('hidden-') && !this.expand
        ? 'mdi:alpha-f-box-outline'
        : 'mdi:alpha-f-box';

    return this._renderButton(name, Object.assign({}, button, { icon: icon }));
  }

  // Render the menu.
  protected render(): TemplateResult {
    // If the menu is off, or if it's in hidden mode but there's no button to
    // unhide it, just show nothing.
    if (
      this.menuMode == 'none' ||
      (this.menuMode.startsWith('hidden-') && !this.buttons.get('frigate'))
    ) {
      return html``;
    }

    const classes = {
      'frigate-card-menu': true,
      'overlay-hidden':
        this.menuMode.startsWith('hidden-') || this.menuMode.startsWith('overlay-'),
      'expanded-horizontal':
        (this.menuMode.startsWith('overlay-') || this.expand) &&
        (this.menuMode.endsWith('-top') || this.menuMode.endsWith('-bottom')),
      'expanded-vertical':
        (this.menuMode.startsWith('overlay-') || this.expand) &&
        (this.menuMode.endsWith('-left') || this.menuMode.endsWith('-right')),
      full: ['above', 'below'].includes(this.menuMode),
      left: this.menuMode.endsWith('-left'),
      right: this.menuMode.endsWith('-right'),
      top: this.menuMode.endsWith('-top'),
      bottom: this.menuMode.endsWith('-bottom'),
    };

    return html`
      <div class=${classMap(classes)}>
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
  static get styles(): CSSResultGroup {
    return unsafeCSS(frigate_card_menu_style);
  }
}

interface ViewParameters {
  view?: FrigateCardView;
  target?: BrowseMediaSource;
  childIndex?: number;
  previous?: View;
}

class View {
  view: FrigateCardView;
  target?: BrowseMediaSource;
  childIndex?: number;
  previous?: View;

  constructor(params?: ViewParameters) {
    this.view = params?.view || 'live';
    this.target = params?.target;
    this.childIndex = params?.childIndex;
    this.previous = params?.previous;
  }

  public is(name: string): boolean {
    return this.view == name;
  }

  get media(): BrowseMediaSource | undefined {
    if (this.target) {
      if (this.target.children && this.childIndex !== undefined) {
        return this.target.children[this.childIndex];
      }
      return this.target;
    }
    return undefined;
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

  protected _interactionTimerID: number | null = null;
  protected _webrtcElement: any | null = null;

  @property({ attribute: false })
  protected _view: View = new View();

  // Media (both browse item & resolved media) actually being shown to the user.
  // This may be different from _view.target when no particular event is
  // requested (e.g. 'clip' view that views the most recent) -- in that case the
  // _view.target will be null, but _mediaBeingShown will be the actual event
  // shown.
  protected _mediaBeingShown: MediaBeingShown | null = null;

  // Whether or not there is an active clip being played.
  protected _clipPlaying = false;

  @query(`#${FrigateCardMenu.FRIGATE_CARD_MENU_ID}`)
  _menu!: FrigateCardMenu | null;

  // A small cache to avoid needing to create a new list of entities every time
  // a hass update arrives.
  protected _entitiesToMonitor: string[] | null = null;

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

    if (this.config.menu_buttons?.frigate ?? true) {
      buttons.set('frigate', { description: localize('menu.frigate') });
    }
    if (this.config.menu_buttons?.live ?? true) {
      buttons.set('live', {
        icon: 'mdi:cctv',
        description: localize('menu.live'),
        emphasize: this._view.is('live'),
      });
    }
    if (this.config.menu_buttons?.clips ?? true) {
      buttons.set('clips', {
        icon: 'mdi:filmstrip',
        description: localize('menu.clips'),
        emphasize: this._view.is('clips'),
      });
    }
    if (this.config.menu_buttons?.snapshots ?? true) {
      buttons.set('snapshots', {
        icon: 'mdi:camera',
        description: localize('menu.snapshots'),
        emphasize: this._view.is('snapshots'),
      });
    }
    if ((this.config.menu_buttons?.frigate_ui ?? true) && this.config.frigate_url) {
      buttons.set('frigate_ui', {
        icon: 'mdi:web',
        description: localize('menu.frigate_ui'),
      });
    }
    const entities = this.config.entities || [];
    for (let i = 0; this._hass && i < entities.length; i++) {
      if (!entities[i].show) {
        continue;
      }
      const entity = entities[i].entity;
      const state = this._hass.states[entity];
      buttons.set(entity, {
        description: state.attributes.friendly_name || entity,
        emphasize: ['on', 'active', 'home'].includes(state.state),
        icon: entities[i].icon || stateIcon(state),
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
      throw new Error(localize('error.invalid_configuration:'));
    }

    const parseResult = frigateCardConfigSchema.safeParse(inputConfig);
    if (!parseResult.success) {
      const keys = this._getParseErrorKeys(parseResult.error);
      throw new Error(localize('error.invalid_configuration') + ': ' + keys.join(', '));
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
        throw new Error(localize('error.invalid_configuration') + ': camera_entity');
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
        throw new Error(localize('error.missing_webrtc'));
      }
    }

    this.config = config;
    this._entitiesToMonitor = [
      ...(this.config.entities || []).map((entity) => entity.entity),
      this.config.camera_entity,
    ];
    this._changeView();
  }

  // Update the card view.
  protected _changeView(view?: View | undefined): void {
    if (view === undefined) {
      this._view = new View({ view: this.config.view_default });
    } else {
      this._view = view;
    }
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
      return shouldUpdateBasedOnHass(this._hass, oldHass, this._entitiesToMonitor);
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
      const error_message = `${localize('error.empty_response')}: ${JSON.stringify(
        request,
      )}`;
      console.warn(error_message);
      throw new Error(error_message);
    }
    const parseResult = schema.safeParse(response);
    if (!parseResult.success) {
      const keys = this._getParseErrorKeys(parseResult.error);
      const error_message =
        `${localize('error.invalid_response')}: ${JSON.stringify(request)}. ` +
        localize('error.invalid_keys') +
        `: '${keys}'`;
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
    mediaSource: BrowseMediaSource | null,
  ): Promise<ResolvedMedia | null> {
    if (!mediaSource) {
      return null;
    }
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
      html`${error ? `${error}.` : `${localize('error.unknown_error')}.`}
        <a href="${URL_TROUBLESHOOTING}">${localize('error.troubleshooting')}</a>.`,
    );
  }

  // Render Frigate events into a card gallery.
  protected async _renderEvents(): Promise<TemplateResult> {
    let parent;
    try {
      if (this._view.target) {
        parent = await this._browseMedia(this._view.target.media_content_id);
      } else {
        parent = await this._browseMediaQuery(this._view.is('clips'));
      }
    } catch (e: any) {
      return this._renderError(e.message);
    }

    if (this._getFirstTrueMediaChildIndex(parent) == null) {
      return this._renderAttentionIcon(
        this._view.is('clips') ? 'mdi:filmstrip-off' : 'mdi:camera-off',
        this._view.is('clips')
          ? localize('common.no_clips')
          : localize('common.no_snapshots'),
      );
    }

    return html` <ul class="mdc-image-list frigate-card-image-list">
      ${this._view.previous
        ? html`<li class="mdc-image-list__item">
            <div class="mdc-image-list__image-aspect-container">
              <div class="mdc-image-list__image">
                <ha-card
                  @click=${() => {
                    this._changeView(this._view.previous);
                  }}
                  outlined=""
                  class="frigate-card-image-list-folder"
                >
                  <ha-icon .icon=${'mdi:arrow-left'}></ha-icon>
                </ha-card>
              </div>
            </div>
          </li>`
        : ''}
      ${parent.children.map(
        (child, index) =>
          html` <li class="mdc-image-list__item">
            <div class="mdc-image-list__image-aspect-container">
              ${child.can_expand
                ? html`<div class="mdc-image-list__image">
                    <ha-card
                      @click=${() => {
                        this._changeView(
                          new View({
                            view: this._view.view,
                            target: child,
                            previous: this._view,
                          }),
                        );
                      }}
                      outlined=""
                      class="frigate-card-image-list-folder"
                    >
                      <div>${child.title}</div>
                    </ha-card>
                  </div>`
                : html`<img
                    data-toggle="tooltip"
                    title="${child.title}"
                    class="mdc-image-list__image"
                    src="${child.thumbnail}"
                    @click=${() => {
                      this._changeView(
                        new View({
                          view: this._view.is('clips') ? 'clip' : 'snapshot',
                          target: parent,
                          childIndex: index,
                          previous: this._view,
                        }),
                      );
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
        this._changeView(new View({ view: name }));
        break;
      case 'frigate_ui':
        const frigate_url = this._getFrigateURLFromContext();
        if (frigate_url) {
          window.open(frigate_url);
        }
        break;
      default:
        // If it's unknown, it's assumed to be an entity_id.
        fireEvent(this, 'hass-more-info', { entityId: name });
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
  protected _getFirstTrueMediaChildIndex(
    media: BrowseMediaSource | null,
  ): number | null {
    if (!media || !media.children) {
      return null;
    }
    for (let i = 0; i < media.children.length; i++) {
      if (!media.children[i].can_expand) {
        return i;
      }
    }
    return null;
  }

  // Get the previous and next real media items, given the index
  protected _getMediaNeighbors(
    parent: BrowseMediaSource,
    index: number | null,
  ): BrowseMediaNeighbors | null {
    if (index == null || !parent.children) {
      return null;
    }

    // Work backwards from the index to get the previous real media.
    let prevIndex: number | null = null;
    for (let i = index - 1; i >= 0; i--) {
      const media = parent.children[i];
      if (media && !media.can_expand) {
        prevIndex = i;
        break;
      }
    }

    // Work forwards from the index to get the next real media.
    let nextIndex: number | null = null;
    for (let i = index + 1; i < parent.children.length; i++) {
      const media = parent.children[i];
      if (media && !media.can_expand) {
        nextIndex = i;
        break;
      }
    }

    return {
      previousIndex: prevIndex,
      previous: prevIndex != null ? parent.children[prevIndex] : null,
      nextIndex: nextIndex,
      next: nextIndex != null ? parent.children[nextIndex] : null,
    };
  }

  // Render the view for media.
  protected async _renderViewer(): Promise<TemplateResult> {
    let autoplay = true;

    let parent: BrowseMediaSource | null = null;
    let childIndex: number | null = null;
    let mediaToRender: BrowseMediaSource | null = null;

    if (this._view.target) {
      parent = this._view.target;
      childIndex = this._view.childIndex ?? null;
      mediaToRender = this._view.media ?? null;
    } else {
      try {
        parent = await this._browseMediaQuery(this._view.is('clip'));
      } catch (e: any) {
        return this._renderError(e.message);
      }
      childIndex = this._getFirstTrueMediaChildIndex(parent);
      if (!parent || !parent.children || childIndex == null) {
        return this._renderAttentionIcon(
          this._view.is('clip') ? 'mdi:filmstrip-off' : 'mdi:camera-off',
          this._view.is('clip')
            ? localize('common.no_clip')
            : localize('common.no_snapshot'),
        );
      }
      mediaToRender = parent.children[childIndex];

      // In this block, no clip has been manually selected, so this is loading
      // the most recent clip on card load. In this mode, autoplay of the clip
      // may be disabled by configuration. If does not make sense to disable
      // autoplay when the user has explicitly picked an event to play in the
      // gallery.
      autoplay = this.config.autoplay_clip;
    }
    const resolvedMedia = await this._resolveMedia(mediaToRender);
    if (!mediaToRender || !resolvedMedia) {
      // Home Assistant could not resolve media item.
      return this._renderError(localize('error.could_not_resolve'));
    }

    this._mediaBeingShown = {
      browseMedia: mediaToRender,
      resolvedMedia: resolvedMedia,
    };

    const neighbors = this._getMediaNeighbors(parent, childIndex);

    return html`
      ${neighbors?.previous && neighbors.previous.thumbnail
        ? html`<img
            src="${neighbors.previous.thumbnail}"
            class="frigate-media-controls previous"
            @click=${() => {
              this._view = new View({
                view: this._view.view,
                target: parent || undefined,
                childIndex: neighbors.previousIndex ?? undefined,
                previous: this._view,
              });
            }}
          />`
        : ``}
      ${this._view.is('clip')
        ? html`<ha-hls-player
            .hass=${this._hass}
            .url=${resolvedMedia.url}
            class="frigate-card-viewer"
            muted
            controls
            playsinline
            allow-exoplayer
            ?autoplay="${autoplay}"
          >
          </ha-hls-player>`
        : html`<img
            src=${resolvedMedia.url}
            class="frigate-card-viewer"
            @click=${() => {
              // Get clips potentially related to this snapshot.
              this._findRelatedClips(mediaToRender).then((relatedClip) => {
                if (relatedClip) {
                  this._changeView(
                    new View({
                      view: 'clip',
                      target: relatedClip,
                      previous: this._view,
                    }),
                  );
                }
              });
            }}
          />`}
      ${neighbors?.next && neighbors.next.thumbnail
        ? html`<img
            src="${neighbors.next.thumbnail}"
            class="frigate-media-controls next"
            @click=${() => {
              this._view = new View({
                view: this._view.view,
                target: parent || undefined,
                childIndex: neighbors.nextIndex ?? undefined,
                previous: this._view,
              });
            }}
          />`
        : ``}
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
    snapshot: BrowseMediaSource | null,
  ): Promise<BrowseMediaSource | null> {
    if (!snapshot) {
      return null;
    }

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
          const index = this._getFirstTrueMediaChildIndex(clipsAtSameTime);
          if (index != null && clipsAtSameTime.children?.length) {
            return clipsAtSameTime.children[index];
          }
        }
      } catch (e: any) {
        // Pass. This is best effort.
      }
    }
    return null;
  }

  // Render the live viewer.
  // Note: The live viewer is the main element used to size the overall card. It
  // is always rendered (but sometimes hidden).
  protected _renderLiveViewer(): TemplateResult {
    if (!this._hass || !(this.config.camera_entity in this._hass.states)) {
      return this._renderAttentionIcon(
        'mdi:camera-off',
        localize('error.no_live_camera'),
      );
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
        ${this._view.is('clips')
          ? html`<div class="frigate-card-gallery">
              ${until(this._renderEvents(), this._renderProgressIndicator())}
            </div>`
          : ``}
        ${this._view.is('snapshots')
          ? html`<div class="frigate-card-gallery">
              ${until(this._renderEvents(), this._renderProgressIndicator())}
            </div>`
          : ``}
        ${this._view.is('clip')
          ? html`<div class="frigate-card-viewer">
              ${until(this._renderViewer(), this._renderProgressIndicator())}
            </div>`
          : ``}
        ${this._view.is('snapshot')
          ? html`<div class="frigate-card-viewer">
              ${until(this._renderViewer(), this._renderProgressIndicator())}
            </div>`
          : ``}
        ${this._view.is('live')
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
  static get styles(): CSSResultGroup {
    return unsafeCSS(frigate_card_style);
  }

  // Get the Lovelace card size.
  public getCardSize(): number {
    return 6;
  }
}
