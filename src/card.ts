/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  CSSResultGroup,
  LitElement,
  PropertyValues,
  TemplateResult,
  html,
  unsafeCSS,
} from 'lit';
import { customElement, property, query, state } from 'lit/decorators';
import { classMap } from 'lit/directives/class-map.js';
import {
  HomeAssistant,
  LovelaceCardEditor,
  fireEvent,
  getLovelace,
  stateIcon,
} from 'custom-card-helpers';

import {
  MenuButton,
  frigateCardConfigSchema,
} from './types';
import type {
  BrowseMediaQueryParameters,
  ExtendedHomeAssistant,
  FrigateCardConfig,
} from './types';

import { CARD_VERSION } from './const';
import { FrigateCardMenu } from './components/menu';
import { View } from './view';
import { getParseErrorKeys } from './common';
import { localize } from './localize/localize';

import './editor';
import './components/gallery';
import './components/live';
import './components/menu';
import './components/message';
import './components/viewer';

import cardStyle from './scss/card.scss';

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
  set hass(hass: HomeAssistant & ExtendedHomeAssistant) {
    this._hass = hass;
    this._updateMenu();
  }

  @property({ attribute: false })
  protected _hass: (HomeAssistant & ExtendedHomeAssistant) | null = null;

  @state()
  public config!: FrigateCardConfig;

  protected _interactionTimerID: number | null = null;

  @property({ attribute: false })
  protected _view: View = new View();

  // Whether or not there is an active clip being played.
  protected _clipPlaying = false;

  @query('frigate-card-menu')
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

  // Set the object configuration.
  public setConfig(inputConfig: FrigateCardConfig): void {
    if (!inputConfig) {
      throw new Error(localize('error.invalid_configuration:'));
    }

    const parseResult = frigateCardConfigSchema.safeParse(inputConfig);
    if (!parseResult.success) {
      const keys = getParseErrorKeys(parseResult.error);
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

    this.config = config;
    this._entitiesToMonitor = [
      ...(this.config.entities || []).map((entity) => entity.entity),
      this.config.camera_entity,
    ];
    this._changeView();
  }

  protected _changeViewHandler(e: CustomEvent<View>): void {
    const view = e.detail;

    if (view === undefined) {
      this._view = new View({ view: this.config.view_default });
    } else {
      this._view = view;
    }
  }

  // Update the card view.
  protected _changeView(view?: View | undefined): void {
    if (view === undefined) {
      this._view = new View({ view: this.config.view_default });
    } else {
      this._view = view;
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

  // Get the Frigate UI url.
  protected _getFrigateURLFromContext(): string | null {
    if (!this.config.frigate_url) {
      return null;
    }
    if (this._view.is('live')) {
      return `${this.config.frigate_url}/cameras/${this.config.frigate_camera_name}`;
    }
    return `${this.config.frigate_url}/events?camera=${this.config.frigate_camera_name}`;
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
    const classes = {
      'hover-menu': this.config.menu_mode.startsWith('hover-'),
    };
    return html`
      <frigate-card-menu
        class="${classMap(classes)}"
        .actionCallback=${this._menuActionHandler.bind(this)}
        .menuMode=${this.config.menu_mode}
        .buttons=${this._getMenuButtons()}
      ></frigate-card-menu>
    `;
  }

  protected _getBrowseMediaQueryParameters(): BrowseMediaQueryParameters {
    return {
      mediaType: this._view.view == 'clips' ? 'clips' : 'snapshots',
      clientId: this.config.frigate_client_id,
      // frigate_camera_name cannot be null, it will be set to a default value
      // in setConfig if not specified in the configuration.
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      cameraName: this.config.frigate_camera_name!,
      label: this.config.label,
      zone: this.config.zone,
    };
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
      ${this.config.menu_mode == 'above' ? this._renderMenu() : ''}
      <div class="container_16_9 outer">
        <div class="frigate-card-contents">
          ${this._view.is('clips') || this._view.is('snapshots')
            ? html` <frigate-card-gallery
                .hass=${this._hass}
                .view=${this._view}
                .browseMediaQueryParameters=${this._getBrowseMediaQueryParameters()}
                @frigate-card:change-view=${this._changeViewHandler}
              >
              </frigate-card-gallery>`
            : ``}
          ${this._view.is('clip') || this._view.is('snapshot')
            ? html` <frigate-card-viewer
                .hass=${this._hass}
                .view=${this._view}
                .browseMediaQueryParameters=${this._getBrowseMediaQueryParameters()}
                .nextPreviousControlStyle=${this.config.controls?.nextprev ?? 'thumbnails'}
                .autoplayClip=${this.config.autoplay_clip}
                @frigate-card:change-view=${this._changeViewHandler}
              >
              </frigate-card-viewer>`
            : ``}
          ${this._view.is('live')
            ? html` <frigate-card-live
                .hass=${this._hass}
                .config=${this.config}
              >
              </frigate-card-live>`
            : ``}
        </div>
      </div>
      ${this.config.menu_mode != 'above' ? this._renderMenu() : ''}
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
    return unsafeCSS(cardStyle);
  }

  // Get the Lovelace card size.
  public getCardSize(): number {
    return 6;
  }
}
