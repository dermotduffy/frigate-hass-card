/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CSSResultGroup,
  LitElement,
  PropertyValues,
  TemplateResult,
  html,
  unsafeCSS,
} from 'lit';
import { customElement, property, query, state } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';
import { until } from 'lit/directives/until.js';
import {
  HomeAssistant,
  LovelaceCardEditor,
  getLovelace,
  handleAction,
} from 'custom-card-helpers';
import screenfull from 'screenfull';
import { z } from 'zod';

import { entitySchema, frigateCardConfigSchema } from './types.js';
import type {
  BrowseMediaQueryParameters,
  Entity,
  ExtendedHomeAssistant,
  FrigateCardConfig,
  MediaShowInfo,
  MenuButton,
  Message,
} from './types.js';

import { CARD_VERSION, REPO_URL } from './const.js';
import { FrigateCardElements } from './components/elements.js';
import { FrigateCardMenu, MENU_HEIGHT } from './components/menu.js';
import { View } from './view.js';
import {
  homeAssistantSignPath,
  homeAssistantWSRequest,
  isValidMediaShowInfo,
  shouldUpdateBasedOnHass,
} from './common.js';
import { localize } from './localize/localize.js';
import { renderMessage, renderProgressIndicator } from './components/message.js';

import './editor.js';
import './components/elements.js';
import './components/gallery.js';
import './components/image.js';
import './components/live.js';
import './components/menu.js';
import './components/message.js';
import './components/viewer.js';
import './patches/ha-camera-stream.js';
import './patches/ha-hls-player.js';

import cardStyle from './scss/card.scss';
import { ResolvedMediaCache } from './resolved-media.js';
import { BrowseMediaUtil } from './browse-media-util.js';

/** A note on media callbacks:
 *
 * We need media elements (e.g. <video>, <img> or <canvas>) to callback when:
 *  - Metadata is loaded / dimensions are known (for aspect-ratio)
 *  - Media is playing / paused (to avoid reloading)
 *
 * There are a number of different approaches used to attach event handlers to
 * get these callbacks (which need to be attached directly to the media
 * elements, which may be 'buried' down the DOM):
 *  - Extend the `ha-hls-player` and `ha-camera-stream` to specify the required
 *    hooks (as querySelecting the media elements after rendering was a fight
 *    with the Lit rendering engine and was very fragile) .
 *  - For non-Lit elements (e.g. WebRTC) query selecting after rendering.
 *  - Library provided hooks (e.g. JSMPEG)
 *  - Directly specifying hooks (e.g. for snapshot viewing with simple <img> tags)
 */

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
  preview: true,
  documentationURL: REPO_URL,
});

/**
 * Main FrigateCard class.
 */
@customElement('frigate-card')
export class FrigateCard extends LitElement {
  @property({ attribute: false })
  protected _hass: (HomeAssistant & ExtendedHomeAssistant) | null = null;

  @state()
  public config!: FrigateCardConfig;

  protected _interactionTimerID: number | null = null;

  @property({ attribute: false })
  protected _view: View = new View();

  @query('frigate-card-menu')
  _menu!: FrigateCardMenu;

  @query('frigate-card-elements')
  _elements?: FrigateCardElements;

  // Whether or not media is actively playing (live or clip).
  protected _mediaPlaying = false;

  // A small cache to avoid needing to create a new list of entities every time
  // a hass update arrives.
  protected _entitiesToMonitor: string[] = [];

  // Information about the most recently loaded media item.
  protected _mediaShowInfo: MediaShowInfo | null = null;

  // Array of dynamic menu buttons to be added to menu.
  protected _dynamicMenuButtons: MenuButton[] = [];

  // The frigate camera name to use (may be manually specified or automatically
  // derived).
  // Values:
  //  - string: Camera name on the Frigate backend.
  //  - null: Attempted to find name, but failed.
  //  - undefined: Have not yet attempted to find name.
  protected _frigateCameraName?: string | null;

  // Error/info message to render.
  protected _message: Message | null = null;

  // A cache of resolved media URLs/mimetypes for use in the whole card.
  protected _resolvedMediaCache = new ResolvedMediaCache();

  /**
   * Set the Home Assistant object.
   */
  set hass(hass: HomeAssistant & ExtendedHomeAssistant) {
    this._hass = hass;

    // Manually set hass in the menu & elements. This is to allow these to
    // update, without necessarily re-rendering the entire card (re-rendering
    // interrupts clip playing).
    if (this._hass) {
      if (this._menu) {
        this._menu.hass = this._hass;
      }
      if (this._elements) {
        this._elements.hass = this._hass;
      }
    }
  }

  /**
   * Get the card editor element.
   * @returns A LovelaceCardEditor element.
   */
  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return document.createElement('frigate-card-editor');
  }

  /**
   * Get a stub basic config using the first available camera of any kind.
   * @param _hass The Home Assistant object.
   * @param entities The entities available to Home Assistant.
   * @returns A valid stub card configuration.
   */
  public static getStubConfig(
    _hass: HomeAssistant,
    entities: string[],
  ): FrigateCardConfig {
    const cameraEntity = entities.find((element) => element.startsWith('camera.'));
    return {
      camera_entity: cameraEntity,
    } as FrigateCardConfig;
  }

  /**
   * Get the menu buttons to display.
   * @returns An array of menu buttons.
   */
  protected _getMenuButtons(): MenuButton[] {
    const buttons: MenuButton[] = [];

    if (this.config.menu_buttons?.frigate ?? true) {
      buttons.push({
        type: 'internal-menu-icon',
        card_action: 'frigate',
        title: localize('menu.frigate'),
      });
    }
    if (this.config.menu_buttons?.live ?? true) {
      buttons.push({
        type: 'internal-menu-icon',
        card_action: 'live',
        title: localize('menu.live'),
        icon: 'mdi:cctv',
        emphasize: this._view.is('live'),
      });
    }
    if (this.config.menu_buttons?.clips ?? true) {
      buttons.push({
        type: 'internal-menu-icon',
        card_action: 'clips',
        title: localize('menu.clips'),
        icon: 'mdi:filmstrip',
        emphasize: this._view.is('clips'),
      });
    }
    if (this.config.menu_buttons?.snapshots ?? true) {
      buttons.push({
        type: 'internal-menu-icon',
        card_action: 'snapshots',
        title: localize('menu.snapshots'),
        icon: 'mdi:camera',
        emphasize: this._view.is('snapshots'),
      });
    }
    if (this.config.menu_buttons?.image ?? false) {
      buttons.push({
        type: 'internal-menu-icon',
        card_action: 'image',
        title: localize('menu.image'),
        icon: 'mdi:image',
        emphasize: this._view.is('image'),
      });
    }
    if (this._view.isViewerView() && (this.config.menu_buttons?.download ?? true)) {
      buttons.push({
        type: 'internal-menu-icon',
        card_action: 'download',
        title: localize('menu.download'),
        icon: 'mdi:download',
      });
    }
    if ((this.config.menu_buttons?.frigate_ui ?? true) && this.config.frigate_url) {
      buttons.push({
        type: 'internal-menu-icon',
        card_action: 'frigate_ui',
        title: localize('menu.frigate_ui'),
        icon: 'mdi:web',
      });
    }
    if ((this.config.menu_buttons?.fullscreen ?? true) && screenfull.isEnabled) {
      buttons.push({
        type: 'internal-menu-icon',
        card_action: 'fullscreen',
        title: localize('menu.fullscreen'),
        icon: screenfull.isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen',
      });
    }
    return buttons.concat(this._dynamicMenuButtons);
  }

  /**
   * Add a dynamic (elements) menu button.
   * @param button The button to add.
   */
  public _addDynamicMenuButton(button: MenuButton): void {
    if (!this._dynamicMenuButtons.includes(button)) {
      this._dynamicMenuButtons = [...this._dynamicMenuButtons, button];
    }
    this._menu.buttons = this._getMenuButtons();
  }

  /**
   * Remove a dynamic (elements) menu button that was previously added.
   * @param target The button to remove.
   */
  public _removeDynamicMenuButton(target: MenuButton): void {
    this._dynamicMenuButtons = this._dynamicMenuButtons.filter(
      (button) => button != target,
    );
    this._menu.buttons = this._getMenuButtons();
  }

  /**
   * Get the Frigate camera name through a variety of means.
   * @returns The Frigate camera name or null if unavailable.
   */
  protected async _getFrigateCameraName(): Promise<string | null> {
    // No camera name specified, apply two heuristics in this order:
    // - Get the entity information and pull out the camera name from the unique_id.
    // - Apply basic entity name guesswork.

    if (!this._hass || !this.config) {
      return null;
    }

    // Option 1: Name specified in config -> done!
    if (this.config.frigate_camera_name) {
      return this.config.frigate_camera_name;
    }

    if (this.config.camera_entity) {
      // Option 2: Find entity unique_id in registry.
      const request = {
        type: 'config/entity_registry/get',
        entity_id: this.config.camera_entity,
      };
      try {
        const entityResult = await homeAssistantWSRequest<Entity>(
          this._hass,
          entitySchema,
          request,
        );
        if (entityResult && entityResult.platform == 'frigate') {
          const match = entityResult.unique_id.match(/:camera:(?<camera>[^:]+)$/);
          if (match && match.groups) {
            return match.groups['camera'];
          }
        }
      } catch (e: any) {
        // Pass.
      }

      // Option 3: Guess from the entity_id.
      if (this.config.camera_entity.includes('.')) {
        return this.config.camera_entity.split('.', 2)[1];
      }
    }

    return null;
  }

  /**
   * Get configuration parse errors.
   * @param error The ZodError object from parsing.
   * @returns An array of string error paths.
   */
  protected _getParseErrorPaths<T>(error: z.ZodError<T>): string[] {
    /* Zod errors involving unions are complex, as Zod may not be able to tell
     * where the 'real' error is vs simply a union option not matching. This
     * function finds all ZodError "issues" that don't have an error with 'type'
     * in that object ('type' is the union discriminator for picture elements,
     * the major union in the schema). An array of human-readable error
     * locations is returned, or an empty list if none is available. None being
     * available suggests the configuration has an error, but we can't tell
     * exactly why (or rather Zod simply says it doesn't match any of the
     * available unions). This usually suggests the user specified an incorrect
     * type name entirely. */
    let contenders: string[] = [];
    if (error && error.issues) {
      for (let i = 0; i < error.issues.length; i++) {
        const issue = error.issues[i];
        if (issue.code == 'invalid_union') {
          const unionErrors = (issue as z.ZodInvalidUnionIssue).unionErrors;
          for (let j = 0; j < unionErrors.length; j++) {
            const nestedErrors = this._getParseErrorPaths(unionErrors[j]);
            if (nestedErrors.length) {
              contenders = contenders.concat(nestedErrors);
            }
          }
        } else if (issue.code == 'invalid_type') {
          if (issue.path[issue.path.length - 1] == 'type') {
            return [];
          }
          contenders.push(this._getParseErrorPathString(issue.path));
        }
      }
    }
    return contenders;
  }

  /**
   * Convert an array of strings and indices into a more human readable string,
   * e.g. [a, 1, b, 2] => 'a[1] -> b[2]'
   * @param path An array of strings and numbers.
   * @returns A single string.
   */
  protected _getParseErrorPathString(path: (string | number)[]): string {
    let out = '';
    for (let i = 0; i < path.length; i++) {
      const item = path[i];
      if (typeof item == 'number') {
        out += '[' + item + ']';
      } else if (out) {
        out += ' -> ' + item;
      } else {
        out = item;
      }
    }
    return out;
  }

  /**
   * Set the card configuration.
   * @param inputConfig The card configuration.
   */
  public setConfig(inputConfig: FrigateCardConfig): void {
    if (!inputConfig) {
      throw new Error(localize('error.invalid_configuration:'));
    }

    const parseResult = frigateCardConfigSchema.safeParse(inputConfig);
    if (!parseResult.success) {
      const hint = this._getParseErrorPaths(parseResult.error);
      throw new Error(
        `${localize('error.invalid_configuration')}: ` +
          (hint.length
            ? JSON.stringify(hint, null, ' ')
            : localize('error.invalid_configuration_no_hint')),
      );
    }
    const config = parseResult.data;

    if (config.test_gui) {
      getLovelace().setEditMode(true);
    }

    this._frigateCameraName = undefined;
    this.config = config;

    this._entitiesToMonitor = this.config.update_entities || [];
    if (this.config.camera_entity) {
      this._entitiesToMonitor.push(this.config.camera_entity);
    }
    this._changeView();
  }

  protected _changeView(view?: View | undefined): void {
    this._message = null;

    if (view === undefined) {
      this._view = new View({ view: this.config.view_default });
    } else {
      this._view = view;
    }
  }

  protected _changeViewHandler(e: CustomEvent<View>): void {
    this._changeView(e.detail);
  }

  /**
   * Determine whether the card should be updated.
   * @param changedProps The changed properties if any.
   * @returns True if the card should be updated.
   */
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
      // card) or if there is media active playing.
      if (this._interactionTimerID || this._mediaPlaying) {
        return false;
      }
      return shouldUpdateBasedOnHass(this._hass, oldHass, this._entitiesToMonitor);
    }
    return true;
  }

  /**
   * Download media being displayed in the viewer.
   */
  protected async _downloadViewerMedia(): Promise<void> {
    if (!this._hass || !this._view.isViewerView()) {
      // Should not occur.
      return;
    }

    if (!this._view.media) {
      this._setMessageAndUpdate({
        message: localize('error.download_no_media'),
        type: 'error',
      })
      return;
    }
    const event_id = BrowseMediaUtil.extractEventID(this._view.media);
    if (!event_id) {
      this._setMessageAndUpdate({
        message: localize('error.download_no_event_id'),
        type: 'error',
      })
      return;
    }

    const path =
      `/api/frigate/${this.config.frigate_client_id}` +
      `/notifications/${event_id}/` +
      `${this._view.isClipRelatedView() ? 'clip.mp4': 'snapshot.jpg'}` +
      `?download=true`;
    let response: string | null | undefined;
    try {
      response = await homeAssistantSignPath(this._hass, path);
    } catch (e) {
      console.error(e, (e as Error).stack);
    }

    if (!response) {
      this._setMessageAndUpdate({
        message: localize('error.download_sign_failed'),
        type: 'error',
      })
      return;
    }

    // Use the HTML5 download attribute to prevent a new window from temporarily
    // opening.
    const link = document.createElement('a');
    link.setAttribute('download', '');
    link.href = response;
    link.click();
    link.remove();
  }

  /**
   * Handle a menu button being clicked.
   * @param action The action to be called from the clicked button.
   * @param button The button that was clicked.
   */
  protected _menuActionHandler(action: string, button: MenuButton): void {
    if (button.type != 'internal-menu-icon') {
      handleAction(this, this._hass as HomeAssistant, button, action);
      return;
    }

    switch (button.card_action) {
      case 'frigate':
        this._changeView();
        break;
      case 'image':
      case 'live':
      case 'clips':
      case 'snapshots':
        this._changeView(new View({ view: button.card_action }));
        break;
      case 'download':
        this._downloadViewerMedia();
        break;
      case 'frigate_ui':
        const frigate_url = this._getFrigateURLFromContext();
        if (frigate_url) {
          window.open(frigate_url);
        }
        break;
      case 'fullscreen':
        if (screenfull.isEnabled) {
          screenfull.toggle(this);
        }
        break;
      default:
        console.warn(`Frigate card received unknown menu action: ${button.card_action}`);
    }
  }

  /**
   * Get the Frigate UI URL from context.
   * @returns The URL or null if unavailable.
   */
  protected _getFrigateURLFromContext(): string | null {
    if (!this.config.frigate_url) {
      return null;
    }
    if (!this._frigateCameraName) {
      return this.config.frigate_url;
    } else if (this._view.is('live')) {
      return `${this.config.frigate_url}/cameras/${this._frigateCameraName}`;
    }
    return `${this.config.frigate_url}/events?camera=${this._frigateCameraName}`;
  }

  /**
   * Handle interaction with the card.
   */
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

  /**
   * Render the card menu.
   * @returns A rendered template.
   */
  protected _renderMenu(): TemplateResult | void {
    const classes = {
      'hover-menu': this.config.menu_mode.startsWith('hover-'),
    };
    return html`
      <frigate-card-menu
        class="${classMap(classes)}"
        .hass=${this._hass}
        .actionCallback=${this._menuActionHandler.bind(this)}
        .menuMode=${this.config.menu_mode}
        .buttons=${this._getMenuButtons()}
      ></frigate-card-menu>
    `;
  }

  /**
   * Get the parameters to search for media related to the current view.
   * @returns A BrowseMediaQueryParameters object.
   */
  protected _getBrowseMediaQueryParameters(): BrowseMediaQueryParameters | undefined {
    if (
      !this._frigateCameraName ||
      !(this._view.isClipRelatedView() || this._view.isSnapshotRelatedView())
    ) {
      return undefined;
    }
    return {
      mediaType: this._view.isClipRelatedView() ? 'clips' : 'snapshots',
      clientId: this.config.frigate_client_id,
      cameraName: this._frigateCameraName,
      label: this.config.label,
      zone: this.config.zone,
    };
  }

  /**
   * Handler for media play event.
   */
  protected _playHandler(): void {
    this._mediaPlaying = true;
  }

  /**
   * Handler for media pause event.
   */
  protected _pauseHandler(): void {
    this._mediaPlaying = false;
  }

  /**
   * Set the message to display and trigger an update.
   * @param message The message to display.
   * @param skipUpdate If true an update request is skipped.
   */
  protected _setMessageAndUpdate(message: Message, skipUpdate?: boolean): void {
    // Register the first message, or prioritize errors if there's pre-render competition.
    if (!this._message || (message.type == 'error' && this._message.type != 'error')) {
      this._message = message;
      if (!skipUpdate) {
        this.requestUpdate();
      }
    }
  }

  /**
   * Handle a message event to render to the user.
   * @param e The message event.
   */
  protected _messageHandler(e: CustomEvent<Message>): void {
    return this._setMessageAndUpdate(e.detail);
  }

  /**
   * Handle a new piece of media being shown.
   * @param e Event with MediaShowInfo details for the media.
   */
  protected _mediaShowHandler(e: CustomEvent<MediaShowInfo>): void {
    const mediaShowInfo = e.detail;
    // In Safari, with WebRTC, 0x0 is occasionally returned during loading,
    // so treat anything less than a safety cutoff as bogus.
    if (!isValidMediaShowInfo(mediaShowInfo)) {
      return;
    }
    let requestRefresh = false;
    if (
      this._isAspectRatioEnforced() &&
      (mediaShowInfo.width != this._mediaShowInfo?.width ||
        mediaShowInfo.height != this._mediaShowInfo?.height)
    ) {
      requestRefresh = true;
    }

    this._mediaShowInfo = mediaShowInfo;
    if (requestRefresh) {
      this.requestUpdate();
    }
  }

  /**
   * Handler called when fullscreen is toggled.
   */
  protected _fullScreenHandler(): void {
    // Re-render after a change to fullscreen mode to take advantage of
    // the expanded screen real-estate (vs staying in aspect-ratio locked
    // modes).
    this.requestUpdate();
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    if (screenfull.isEnabled) {
      screenfull.on('change', this._fullScreenHandler.bind(this));
    }
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    if (screenfull.isEnabled) {
      screenfull.off('change', this._fullScreenHandler.bind(this));
    }
    super.disconnectedCallback();
  }

  /**
   * Determine if the aspect ratio should be enforced given the current view and
   * context.
   */
  protected _isAspectRatioEnforced(): boolean {
    const aspect_ratio_mode = this.config.dimensions?.aspect_ratio_mode ?? 'dynamic';

    // Do not artifically constrain aspect ratio if:
    // - It's fullscreen.
    // - Aspect ratio enforcement is disabled.
    // - Or aspect ratio enforcement is dynamic and it's a media view (i.e. not the gallery).

    return !(
      (screenfull.isEnabled && screenfull.isFullscreen) ||
      aspect_ratio_mode == 'unconstrained' ||
      (aspect_ratio_mode == 'dynamic' && this._view.isMediaView())
    );
  }

  /**
   * Get the aspect ratio padding required to enforce the aspect ratio (if it is
   * required).
   * @returns A padding percentage.
   */
  protected _getAspectRatioPadding(): number | null {
    if (!this._isAspectRatioEnforced()) {
      return null;
    }

    const aspect_ratio_mode = this.config.dimensions?.aspect_ratio_mode ?? 'dynamic';
    if (aspect_ratio_mode == 'dynamic' && this._mediaShowInfo) {
      return (this._mediaShowInfo.height / this._mediaShowInfo.width) * 100;
    }

    const default_aspect_ratio = this.config.dimensions?.aspect_ratio;
    if (default_aspect_ratio) {
      return (default_aspect_ratio[1] / default_aspect_ratio[0]) * 100;
    } else {
      return (9 / 16) * 100;
    }
  }

  /**
   * Master render method for the card.
   */
  protected render(): TemplateResult | void {
    if (this.config.show_warning) {
      return this._showWarning(localize('common.show_warning'));
    }
    if (this.config.show_error) {
      return this._showError(localize('common.show_error'));
    }

    const padding = this._getAspectRatioPadding();
    const outerStyle = {},
      innerStyle = {};

    // Padding to force a particular aspect ratio.
    if (padding != null) {
      outerStyle['padding-top'] = `${padding}%`;
    }

    // Special hacky treatment required when:
    //
    // - It's in fullscreen mode
    // - It's viewing a media item
    // - And the aspect ratio of the media item < aspect ratio of the window
    //
    // Cannot seem to scale the video by height in CSS without actually styling
    // the underlying video element (which there is no access to as it's buried
    // past multiple shadow roots), so instead scale the width in terms of'vh'
    // (viewport height) in proportion to the aspect-ratio of the media.
    if (
      screenfull.isEnabled &&
      screenfull.isFullscreen &&
      this._view.isMediaView() &&
      this._mediaShowInfo &&
      this._mediaShowInfo.width / this._mediaShowInfo.height <
        window.innerWidth / window.innerHeight
    ) {
      // If the menu is outside the media (i.e. above/below) allow space for it.
      const allowance = ['above', 'below'].includes(this.config.menu_mode)
        ? MENU_HEIGHT
        : 0;
      innerStyle['max-width'] = `calc(${
        (100 * this._mediaShowInfo.width) / this._mediaShowInfo.height
      }vh - ${allowance}px )`;
    }

    const contentClasses = {
      'frigate-card-contents': true,
      absolute: padding != null,
    };

    return html` <ha-card @click=${this._interactionHandler}>
      ${this.config.menu_mode == 'above' ? this._renderMenu() : ''}
      <div class="container outer" style="${styleMap(outerStyle)}">
        <div class="${classMap(contentClasses)}" style="${styleMap(innerStyle)}">
          ${this._frigateCameraName == undefined
            ? until(
                (async () => {
                  this._frigateCameraName = await this._getFrigateCameraName();
                  return this._render();
                })(),
                renderProgressIndicator(),
              )
            : this._render()}
        </div>
      </div>
      ${this.config.menu_mode != 'above' ? this._renderMenu() : ''}
    </ha-card>`;
  }

  /**
   * Sub-render method for the card.
   */
  protected _render(): TemplateResult | void {
    if (!this._hass) {
      return html``;
    }
    if (!this._frigateCameraName) {
      this._setMessageAndUpdate(
        {
          message: localize('error.no_frigate_camera_name'),
          type: 'error',
        },
        true,
      );
    }
    const mediaQueryParameters = this._getBrowseMediaQueryParameters();

    const pictureElementsClasses = {
      'picture-elements': true,
      gallery: this._view.isGalleryView(),
    };
    const galleryClasses = {
      hidden: this.config.live_preload && !this._view.isGalleryView(),
    };
    const viewerClasses = {
      hidden: this.config.live_preload && !this._view.isViewerView(),
    };
    const liveClasses = {
      hidden: this.config.live_preload && this._view.view != 'live',
    };
    const imageClasses = {
      hidden: this.config.live_preload && this._view.view != 'image',
    };

    return html`
      <div class="${classMap(pictureElementsClasses)}">
        ${this._message ? renderMessage(this._message) : ``}
        ${!this._message && this._view.is('image')
          ? html` <frigate-card-image
              .image=${this.config.image}
              class="${classMap(imageClasses)}"
              @frigate-card:media-show=${this._mediaShowHandler}
              @frigate-card:message=${this._messageHandler}
            >
            </frigate-card-image>`
          : ``}
        ${!this._message && this._view.isGalleryView()
          ? html` <frigate-card-gallery
              .hass=${this._hass}
              .view=${this._view}
              .browseMediaQueryParameters=${mediaQueryParameters}
              class="${classMap(galleryClasses)}"
              @frigate-card:change-view=${this._changeViewHandler}
              @frigate-card:message=${this._messageHandler}
            >
            </frigate-card-gallery>`
          : ``}
        ${!this._message && this._view.isViewerView()
          ? html` <frigate-card-viewer
              .hass=${this._hass}
              .view=${this._view}
              .browseMediaQueryParameters=${mediaQueryParameters}
              .nextPreviousControlStyle=${this.config.controls?.nextprev ?? 'thumbnails'}
              .autoplayClip=${this.config.autoplay_clip}
              .resolvedMediaCache=${this._resolvedMediaCache}
              .lazyLoad=${this.config.event_viewer?.lazy_load ?? true}
              class="${classMap(viewerClasses)}"
              @frigate-card:change-view=${this._changeViewHandler}
              @frigate-card:media-show=${this._mediaShowHandler}
              @frigate-card:pause=${this._pauseHandler}
              @frigate-card:play=${this._playHandler}
              @frigate-card:message=${this._messageHandler}
            >
            </frigate-card-viewer>`
          : ``}
        ${
          // Note the subtle difference in condition below vs the other views in order
          // to always render the live view for live_preload mode.
          (!this._message && this._view.is('live')) || this.config.live_preload
            ? html`
                <frigate-card-live
                  .hass=${this._hass}
                  .config=${this.config}
                  .frigateCameraName=${this._frigateCameraName}
                  class="${classMap(liveClasses)}"
                  @frigate-card:media-show=${this._mediaShowHandler}
                  @frigate-card:pause=${this._pauseHandler}
                  @frigate-card:play=${this._playHandler}
                  @frigate-card:message=${this._messageHandler}
                >
                </frigate-card-live>
              `
            : ``
        }
        ${this.config.elements
          ? html`
              <frigate-card-elements
                .hass=${this._hass}
                .elements=${this.config.elements}
                .view=${this._view}
                @frigate-card:message=${this._messageHandler}
                @frigate-card:menu-add=${(e) => {
                  this._addDynamicMenuButton(e.detail);
                }}
                @frigate-card:menu-remove=${(e) => {
                  this._removeDynamicMenuButton(e.detail);
                }}
                @frigate-card:state-request=${(e) => {
                  // State filled here must also trigger the
                  // 'frigate-card-elements' to re-render (by being a property).
                  e.view = this._view;
                }}
              >
              </frigate-card-elements>
            `
          : ``}
      </div>
    `;
  }

  /**
   * Show a warning card.
   * @param warning The warning message.
   * @returns A rendered template.
   */
  private _showWarning(warning: string): TemplateResult {
    return html` <hui-warning> ${warning} </hui-warning> `;
  }

  /**
   * Show an error card.
   * @param error The error message.
   * @returns A rendered template.
   */
  private _showError(error: string): TemplateResult {
    const errorCard = document.createElement('hui-error-card');
    errorCard.setConfig({
      type: 'error',
      error,
      origConfig: this.config,
    });

    return html` ${errorCard} `;
  }

  /**
   * Return compiled CSS styles (thus safe to use with unsafeCSS).
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(cardStyle);
  }

  /**
   * Get the Lovelace card size.
   * @returns The Lovelace card size in units of 50px.
   */
  public getCardSize(): number {
    if (this._mediaShowInfo) {
      return this._mediaShowInfo.height / 50;
    }
    return 6;
  }
}
