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
import { StyleInfo, styleMap } from 'lit/directives/style-map.js';
import { until } from 'lit/directives/until.js';
import {
  HomeAssistant,
  LovelaceCardEditor,
  getLovelace,
} from 'custom-card-helpers';
import screenfull from 'screenfull';
import { z } from 'zod';

import {
  Actions,
  ActionType,
  CameraConfig,
  RawFrigateCardConfig,
  entitySchema,
  frigateCardConfigSchema,
  FrigateCardCustomAction,
} from './types.js';
import type {
  Entity,
  ExtendedHomeAssistant,
  FrigateCardConfig,
  MediaShowInfo,
  MenuButton,
  Message,
} from './types.js';

import { CARD_VERSION, REPO_URL } from './const.js';
import { FrigateCardElements } from './components/elements.js';
import { FRIGATE_BUTTON_MENU_ICON, FrigateCardMenu } from './components/menu.js';
import { View } from './view.js';
import {
  contentsChanged,
  convertActionToFrigateCardCustomAction,
  createFrigateCardCustomAction,
  frigateCardHandleAction,
  frigateCardHasAction,
  getActionConfigGivenAction,
  getCameraIcon,
  getCameraTitle,
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
import './components/thumbnail-carousel.js';
import './patches/ha-camera-stream.js';
import './patches/ha-hls-player.js';

import cardStyle from './scss/card.scss';
import { ResolvedMediaCache } from './resolved-media.js';
import { BrowseMediaUtil } from './browse-media-util.js';
import { isConfigUpgradeable } from './config-mgmt.js';
import { actionHandler } from './action-handler-directive.js';
import {
  ConditionState,
  conditionStateRequestHandler,
  getOverriddenConfig,
  getOverridesByKey,
} from './card-condition.js';

/** A note on media callbacks:
 *
 * Media elements (e.g. <video>, <img> or <canvas>) need to callback when:
 *  - Metadata is loaded / dimensions are known (for aspect-ratio)
 *  - Media is playing / paused (to avoid reloading)
 *
 * A number of different approaches used to attach event handlers to
 * get these callbacks (which need to be attached directly to the media
 * elements, which may be 'buried' down the DOM):
 *  - Extend the `ha-hls-player` and `ha-camera-stream` to specify the required
 *    hooks (as querySelecting the media elements after rendering was a fight
 *    with the Lit rendering engine and was very fragile) .
 *  - For non-Lit elements (e.g. WebRTC) query selecting after rendering.
 *  - Library provided hooks (e.g. JSMPEG)
 *  - Directly specifying hooks (e.g. for snapshot viewing with simple <img> tags)
 */

/** A note on action/menu/ll-custom events:
 *
 * The card supports actions being configured in a number of places (e.g. tap on an
 * element, double_tap on a menu item, hold on the live view). These actions are
 * handled frigateCardHandleAction(). For Frigate-card specific actions,
 * frigateCardHandleAction() call will result in an ll-custom DOM event being
 * fired, which needs to be caught at the card level to handle.
 */

/* eslint no-console: 0 */
console.info(
  `%c  FRIGATE-HASS-CARD \n%c  ${localize('common.version')} ${CARD_VERSION}    `,
  'color: pink; font-weight: bold; background: black',
  'color: white; font-weight: bold; background: dimgray',
);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).customCards = (window as any).customCards || [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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
  protected _hass?: HomeAssistant & ExtendedHomeAssistant;

  @state()
  public _baseConfig!: FrigateCardConfig;

  @state()
  public _overriddenConfig?: FrigateCardConfig;

  @property({ attribute: false })
  protected _view?: View;

  @state()
  protected _conditionState?: ConditionState;

  @query('frigate-card-menu')
  _menu!: FrigateCardMenu;

  @query('frigate-card-elements')
  _elements?: FrigateCardElements;

  // user interaction timer ("screensaver" functionality, return to default
  // view after user interaction).
  protected _interactionTimerID: number | null = null;

  // Automated refreshes of the default view.
  protected _updateTimerID: number | null = null;

  // Information about the most recently loaded media item.
  protected _mediaShowInfo: MediaShowInfo | null = null;

  // Array of dynamic menu buttons to be added to menu.
  protected _dynamicMenuButtons: MenuButton[] = [];

  @state()
  protected _cameras?: Map<string, CameraConfig>;

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
      cameras: [
        {
          camera_entity: cameraEntity,
        },
      ],
      // Need to use 'as unknown' to convince Typescript that this really isn't a
      // mistake, despite the miniscule size of the configuration vs the full type
      // description.
    } as unknown as FrigateCardConfig;
  }

  /**
   * Generate the state used to evaluate conditions.
   */
  protected _generateConditionState(): void {
    this._conditionState = {
      view: this._view?.view,
      fullscreen: screenfull.isEnabled && screenfull.isFullscreen,
      camera: this._view?.camera,
    };

    const overriddenConfig = getOverriddenConfig(
      this._baseConfig,
      this._baseConfig.overrides,
      this._conditionState,
    ) as FrigateCardConfig;

    // Save on Lit re-rendering costs by only updating the configuration if it
    // actually changes.
    if (contentsChanged(overriddenConfig, this._overriddenConfig)) {
      this._overriddenConfig = overriddenConfig;
    }
  }

  /**
   * Get the style of emphasized menu items.
   * @returns A StyleInfo.
   */
  protected _getEmphasizedStyle(): StyleInfo {
    return {
      color: 'var(--primary-color, white)',
    };
  }

  /**
   * Get the menu buttons to display.
   * @returns An array of menu buttons.
   */
  protected _getMenuButtons(): MenuButton[] {
    const buttons: MenuButton[] = [];

    if (this._getConfig().menu.buttons.frigate) {
      buttons.push({
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.frigate'),
        // Use a magic icon value that the menu will use to render the icon as
        // it deems appropriate (certain menu configurations change the menu
        // icon for the 'Frigate' button).
        icon: FRIGATE_BUTTON_MENU_ICON,
        tap_action: FrigateCardMenu.isHidingMenu(this._getConfig().menu)
          ? (createFrigateCardCustomAction('menu_toggle') as FrigateCardCustomAction)
          : (createFrigateCardCustomAction('default') as FrigateCardCustomAction),
      });
    }

    if (
      this._getConfig().menu.buttons.cameras &&
      this._cameras &&
      this._cameras.size > 1
    ) {
      const menuItems = Array.from(this._cameras, ([camera, config]) => {
        return {
          icon: getCameraIcon(this._hass, config),
          entity: config.camera_entity,
          state_color: true,
          title: getCameraTitle(this._hass, config),
          selected: this._view?.camera === camera,
          tap_action: createFrigateCardCustomAction('camera_select', camera),
        };
      });

      buttons.push({
        type: 'custom:frigate-card-menu-submenu',
        title: localize('config.menu.buttons.cameras'),
        icon: 'mdi:video-switch',
        items: menuItems,
      });
    }

    if (this._getConfig().menu.buttons.live) {
      buttons.push({
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.view.views.live'),
        icon: 'mdi:cctv',
        style: this._view?.is('live') ? this._getEmphasizedStyle() : {},
        tap_action: createFrigateCardCustomAction('live') as FrigateCardCustomAction,
      });
    }

    if (this._getConfig().menu.buttons.clips) {
      buttons.push({
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.view.views.clips'),
        icon: 'mdi:filmstrip',
        style: this._view?.is('clips') ? this._getEmphasizedStyle() : {},
        tap_action: createFrigateCardCustomAction('clips') as FrigateCardCustomAction,
        hold_action: createFrigateCardCustomAction('clip') as FrigateCardCustomAction,
      });
    }

    if (this._getConfig().menu.buttons.snapshots) {
      buttons.push({
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.view.views.snapshots'),
        icon: 'mdi:camera',
        style: this._view?.is('snapshots') ? this._getEmphasizedStyle() : {},
        tap_action: createFrigateCardCustomAction(
          'snapshots',
        ) as FrigateCardCustomAction,
        hold_action: createFrigateCardCustomAction(
          'snapshot',
        ) as FrigateCardCustomAction,
      });
    }

    if (this._getConfig().menu.buttons.image) {
      buttons.push({
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.view.views.image'),
        icon: 'mdi:image',
        style: this._view?.is('image') ? this._getEmphasizedStyle() : {},
        tap_action: createFrigateCardCustomAction('image') as FrigateCardCustomAction,
      });
    }

    if (this._getConfig().menu.buttons.download && this._view?.isViewerView()) {
      buttons.push({
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.download'),
        icon: 'mdi:download',
        tap_action: createFrigateCardCustomAction('download') as FrigateCardCustomAction,
      });
    }

    const cameraConfig = this._getSelectedCameraConfig();
    if (
      this._getConfig().menu.buttons.frigate_ui &&
      cameraConfig &&
      cameraConfig.frigate_url
    ) {
      buttons.push({
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.frigate_ui'),
        icon: 'mdi:web',
        tap_action: createFrigateCardCustomAction(
          'frigate_ui',
        ) as FrigateCardCustomAction,
      });
    }

    if (this._getConfig().menu.buttons.fullscreen && screenfull.isEnabled) {
      buttons.push({
        type: 'custom:frigate-card-menu-icon',
        title: localize('config.menu.buttons.fullscreen'),
        icon: screenfull.isFullscreen ? 'mdi:fullscreen-exit' : 'mdi:fullscreen',
        tap_action: createFrigateCardCustomAction(
          'fullscreen',
        ) as FrigateCardCustomAction,
        style: screenfull.isFullscreen ? this._getEmphasizedStyle() : {},
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
   * Fully load the configured cameras.
   */
  protected async _loadCameras(): Promise<void> {
    const cameras: Map<string, CameraConfig> = new Map();
    let errorFree = true;

    const addCameraConfig = async (config: CameraConfig) => {
      if (!config.camera_name && config.camera_entity) {
        const resolvedName = await this._getFrigateCameraNameFromEntity(
          config.camera_entity,
        );
        if (resolvedName) {
          config.camera_name = resolvedName;
        }
      }

      const id =
        config.id || config.camera_entity || config.webrtc?.entity || config.camera_name;

      if (!id) {
        this._setMessageAndUpdate({
          message: localize('error.no_camera_id') + `: ${JSON.stringify(config)}`,
          type: 'error',
        });
        errorFree = false;
      } else if (cameras.has(id)) {
        this._setMessageAndUpdate({
          message: localize('error.duplicate_camera_id') + `: ${JSON.stringify(config)}`,
          type: 'error',
        });
        errorFree = false;
      } else {
        cameras.set(id, config);
      }
    };

    if (this._getConfig().cameras && Array.isArray(this._getConfig().cameras)) {
      await Promise.all(this._getConfig().cameras.map(addCameraConfig.bind(this)));
    }

    if (!cameras.size) {
      return this._setMessageAndUpdate({
        message: localize('error.no_cameras'),
        type: 'error',
      });
      errorFree = false;
    }

    if (errorFree) {
      this._cameras = cameras;
    }
  }

  /**
   * Get the camera configuration for the selected camera.
   * @returns The CameraConfig object or null if not found.
   */
  protected _getSelectedCameraConfig(): CameraConfig | null {
    if (!this._cameras || !this._cameras.size || !this._view?.camera) {
      return null;
    }
    return this._cameras.get(this._view.camera) || null;
  }

  /**
   * Get the Frigate camera name from an entity name.
   * @returns The Frigate camera name or null if unavailable.
   */
  protected async _getFrigateCameraNameFromEntity(
    entity: string,
  ): Promise<string | null> {
    if (!this._hass) {
      return null;
    }

    // Find entity unique_id in registry.
    const request = {
      type: 'config/entity_registry/get',
      entity_id: entity,
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
    } catch (e: unknown) {
      // Pass.
    }

    return null;
  }

  /**
   * Get configuration parse errors.
   * @param error The ZodError object from parsing.
   * @returns An array of string error paths.
   */
  protected _getParseErrorPaths<T>(error: z.ZodError<T>): Set<string> | null {
    /* Zod errors involving unions are complex, as Zod may not be able to tell
     * where the 'real' error is vs simply a union option not matching. This
     * function finds all ZodError "issues" that don't have an error with 'type'
     * in that object ('type' is the union discriminator for picture elements,
     * the major union in the schema). An array of user-readable error
     * locations is returned, or an empty list if none is available. None being
     * available suggests the configuration has an error, but we can't tell
     * exactly why (or rather Zod simply says it doesn't match any of the
     * available unions). This usually suggests the user specified an incorrect
     * type name entirely. */
    const contenders = new Set<string>();
    if (error && error.issues) {
      for (let i = 0; i < error.issues.length; i++) {
        const issue = error.issues[i];
        if (issue.code == 'invalid_union') {
          const unionErrors = (issue as z.ZodInvalidUnionIssue).unionErrors;
          for (let j = 0; j < unionErrors.length; j++) {
            const nestedErrors = this._getParseErrorPaths(unionErrors[j]);
            if (nestedErrors && nestedErrors.size) {
              nestedErrors.forEach(contenders.add, contenders);
            }
          }
        } else if (issue.code == 'invalid_type') {
          if (issue.path[issue.path.length - 1] == 'type') {
            return null;
          }
          contenders.add(this._getParseErrorPathString(issue.path));
        } else if (issue.code != 'custom') {
          contenders.add(this._getParseErrorPathString(issue.path));
        }
      }
    }
    return contenders;
  }

  /**
   * Convert an array of strings and indices into a more user readable string,
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
  public setConfig(inputConfig: RawFrigateCardConfig): void {
    if (!inputConfig) {
      throw new Error(localize('error.invalid_configuration'));
    }

    const configUpgradeable = isConfigUpgradeable(inputConfig);
    const parseResult = frigateCardConfigSchema.safeParse(inputConfig);
    if (!parseResult.success) {
      const hint = this._getParseErrorPaths(parseResult.error);
      let upgradeMessage = '';
      if (configUpgradeable && getLovelace().mode !== 'yaml') {
        upgradeMessage = `${localize('error.upgrade_available')}. `;
      }
      throw new Error(
        upgradeMessage +
          `${localize('error.invalid_configuration')}: ` +
          (hint && hint.size
            ? JSON.stringify([...hint], null, ' ')
            : localize('error.invalid_configuration_no_hint')),
      );
    }
    const config = parseResult.data;

    if (config.test_gui) {
      getLovelace().setEditMode(true);
    }

    this._baseConfig = config;
    this._cameras = undefined;
    this._view = undefined;

    this._changeView();
  }

  /**
   * Card the card config, prioritizing the overriden config if present.
   * @returns A FrigateCardConfig.
   */
  protected _getConfig(): FrigateCardConfig {
    return this._overriddenConfig || this._baseConfig;
  }

  protected _changeView(args?: { view?: View; resetMessage?: boolean }): void {
    if (args?.resetMessage ?? true) {
      this._message = null;
    }

    if (args?.view === undefined) {
      // Load the default view.
      let camera = this._view?.camera;
      if (this._cameras?.size) {
        if (!camera) {
          camera = this._cameras.keys().next().value;
        } else if (this._getConfig().view.update_cycle_camera) {
          const keys = Array.from(this._cameras.keys());
          const currentIndex = keys.indexOf(camera);
          const targetIndex = currentIndex + 1 >= keys.length ? 0 : currentIndex + 1;
          camera = keys[targetIndex];
        }
      }

      if (camera) {
        this._view = new View({
          view: this._getConfig().view.default,
          camera: camera,
        });
        this._generateConditionState();

        // The default view has been loaded, so can abandon any running
        // 'screensaver' timer.
        this._clearInteractionTimer();

        // Restart the update timer, so the default view is refreshed at a fixed
        // interval from now (if so configured).
        this._startUpdateTimer();
      }
    } else {
      this._view = args.view;
      this._generateConditionState();
    }
  }

  /**
   * Handle a change view event.
   * @param e The change view event.
   */
  protected _changeViewHandler(e: CustomEvent<View>): void {
    this._changeView({ view: e.detail });
  }

  /**
   * Determine whether the card should be updated.
   * @param changedProps The changed properties if any.
   * @returns True if the card should be updated.
   */
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (changedProps.size > 1) {
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
      if (
        this._isAutomatedViewUpdateAllowed() &&
        shouldUpdateBasedOnHass(
          this._hass,
          oldHass,
          this._getConfig().view.update_entities || [],
        )
      ) {
        // If entities being monitored have changed then reset the view to the
        // default. Note that as per the Lit lifecycle, the setting of the view
        // itself will not trigger an *additional* re-render here.
        this._changeView();
        return true;
      }
      return false;
    }
    return true;
  }

  /**
   * Download media being displayed in the viewer.
   */
  protected async _downloadViewerMedia(): Promise<void> {
    if (!this._hass || !this._view?.isViewerView()) {
      // Should not occur.
      return;
    }

    if (!this._view.media) {
      this._setMessageAndUpdate({
        message: localize('error.download_no_media'),
        type: 'error',
      });
      return;
    }
    const event_id = BrowseMediaUtil.extractEventID(this._view.media);
    if (!event_id) {
      this._setMessageAndUpdate({
        message: localize('error.download_no_event_id'),
        type: 'error',
      });
      return;
    }

    const cameraConfig = this._getSelectedCameraConfig();
    if (!cameraConfig) {
      return;
    }

    const path =
      `/api/frigate/${cameraConfig.client_id}` +
      `/notifications/${event_id}/` +
      `${this._view.isClipRelatedView() ? 'clip.mp4' : 'snapshot.jpg'}` +
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
      });
      return;
    }

    if (
      navigator.userAgent.startsWith('Home Assistant/') ||
      navigator.userAgent.startsWith('HomeAssistant/')
    ) {
      // Home Assistant companion apps cannot download files without opening a
      // new browser window.
      //
      // User-agents are specified here:
      //  - Android: https://github.com/home-assistant/android/blob/master/app/src/main/java/io/homeassistant/companion/android/webview/WebViewActivity.kt#L107
      //  - iOS: https://github.com/home-assistant/iOS/blob/master/Sources/Shared/API/HAAPI.swift#L75
      window.open(response, '_blank');
    } else {
      // Use the HTML5 download attribute to prevent a new window from
      // temporarily opening.
      const link = document.createElement('a');
      link.setAttribute('download', '');
      link.href = response;
      link.click();
      link.remove();
    }
  }

  /**
   * Handle a request for a card action.
   * @param ev The action requested.
   */
  protected _cardActionHandler(ev: CustomEvent<ActionType>): void {
    // These interactions should only be handled by the card, as nothing
    // upstream has the user-provided configuration.
    ev.stopPropagation();

    const frigateCardAction = convertActionToFrigateCardCustomAction(ev.detail);
    if (!frigateCardAction) {
      return;
    }
    const action = frigateCardAction.frigate_card_action;

    switch (action) {
      case 'default':
        this._changeView();
        break;
      case 'clip':
      case 'clips':
      case 'image':
      case 'live':
      case 'snapshot':
      case 'snapshots':
        if (this._view) {
          this._changeView({
            view: new View({
              view: action,
              camera: this._view.camera,
            }),
          });
        }
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
      case 'camera_select':
        const camera = frigateCardAction.camera;
        if (this._cameras?.has(camera) && this._view) {
          this._changeView({
            view: new View({
              view: this._view.view,
              camera: camera,
            }),
          });
        }
        break;
      default:
        console.warn(`Frigate card received unknown card action: ${action}`);
    }
  }

  /**
   * Get the Frigate UI URL from context.
   * @returns The URL or null if unavailable.
   */
  protected _getFrigateURLFromContext(): string | null {
    const cameraConfig = this._getSelectedCameraConfig();
    if (!cameraConfig || !cameraConfig.frigate_url || !this._view) {
      return null;
    }
    if (!cameraConfig.camera_name) {
      return cameraConfig.frigate_url;
    }
    if (this._view.isViewerView() || this._view.isGalleryView()) {
      return `${cameraConfig.frigate_url}/events?camera=${cameraConfig.camera_name}`;
    }
    return `${cameraConfig.frigate_url}/cameras/${cameraConfig.camera_name}`;
  }

  /**
   * Handle an action called on an element.
   * @param ev The actionHandler event.
   */
  protected _actionHandler(ev: CustomEvent, config?: Actions): void {
    const interaction = ev.detail.action;
    const node: HTMLElement | null = ev.currentTarget as HTMLElement | null;
    if (
      config &&
      node &&
      interaction &&
      // Don't call frigateCardHandleAction() unless there is explicitly an
      // action defined (as it uses a default that is unhelpful for views that
      // have default tap/click actions).
      getActionConfigGivenAction(interaction, config)
    ) {
      frigateCardHandleAction(
        node,
        this._hass as HomeAssistant,
        config,
        ev.detail.action,
      );
    }

    // Set the 'screensaver' timer.
    this._startInteractionTimer();
  }

  /**
   * Clear the user interaction ('screensaver') timer.
   */
  protected _clearInteractionTimer(): void {
    if (this._interactionTimerID) {
      window.clearTimeout(this._interactionTimerID);
      this._interactionTimerID = null;
    }
  }

  /**
   * Start the user interaction ('screensaver') timer to reset the view to
   * default `view.timeout_seconds` after user interaction.
   */
  protected _startInteractionTimer(): void {
    this._clearInteractionTimer();
    if (this._getConfig().view.timeout_seconds) {
      this._interactionTimerID = window.setTimeout(() => {
        this._changeView();
      }, this._getConfig().view.timeout_seconds * 1000);
    }
  }

  /**
   * Set the update timer to trigger an update refresh every
   * `view.update_seconds`.
   */
  protected _startUpdateTimer(): void {
    if (this._updateTimerID) {
      window.clearTimeout(this._updateTimerID);
      this._updateTimerID = null;
    }
    if (this._getConfig().view.update_seconds) {
      this._updateTimerID = window.setTimeout(() => {
        if (this._isAutomatedViewUpdateAllowed()) {
          this._changeView();
        } else {
          // Not allowed to update this time around, but try again at the next
          // interval.
          this._startUpdateTimer();
        }
      }, this._getConfig().view.update_seconds * 1000);
    }
  }

  /**
   * Determine if an automated view update is allowed.
   * @returns `true` if it's allowed, `false` otherwise.
   */
  protected _isAutomatedViewUpdateAllowed(): boolean {
    return this._getConfig().view.update_force || !this._interactionTimerID;
  }

  /**
   * Render the card menu.
   * @returns A rendered template.
   */
  protected _renderMenu(): TemplateResult | void {
    const classes = {
      'hover-menu': this._getConfig().menu.mode.startsWith('hover-'),
    };
    return html`
      <frigate-card-menu
        .hass=${this._hass}
        .menuConfig=${this._getConfig().menu}
        .buttons=${this._getMenuButtons()}
        .conditionState=${this._conditionState}
        class="${classMap(classes)}"
      ></frigate-card-menu>
    `;
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
      this._view?.isGalleryView() &&
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
    this._generateConditionState();
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
    const aspectRatioMode = this._getConfig().dimensions.aspect_ratio_mode;

    // Do not artifically constrain aspect ratio if:
    // - It's fullscreen.
    // - Aspect ratio enforcement is disabled.
    // - Aspect ratio enforcement is dynamic and it's a media view (i.e. not the gallery).
    // - There is a message to display to the user.

    return !(
      (screenfull.isEnabled && screenfull.isFullscreen) ||
      aspectRatioMode == 'unconstrained' ||
      (aspectRatioMode == 'dynamic' && this._view?.isMediaView()) ||
      this._message != null
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

    const aspectRatioMode = this._getConfig().dimensions.aspect_ratio_mode;
    if (aspectRatioMode == 'dynamic' && this._mediaShowInfo) {
      return (this._mediaShowInfo.height / this._mediaShowInfo.width) * 100;
    }

    const defaultAspectRatio = this._getConfig().dimensions.aspect_ratio;
    if (defaultAspectRatio) {
      return (defaultAspectRatio[1] / defaultAspectRatio[0]) * 100;
    } else {
      return (9 / 16) * 100;
    }
  }

  /**
   * Merge card-wide and view-specific actions.
   * @returns A combined set of action.
   */
  protected _getMergedActions(): Actions {
    let specificActions: Actions | undefined = undefined;

    if (this._view?.is('live')) {
      specificActions = this._getConfig().live.actions;
    } else if (this._view?.isGalleryView()) {
      specificActions = this._getConfig().event_gallery?.actions;
    } else if (this._view?.isViewerView()) {
      specificActions = this._getConfig().event_viewer.actions;
    } else if (this._view?.is('image')) {
      specificActions = this._getConfig().image?.actions;
    }
    return { ...this._getConfig().view.actions, ...specificActions };
  }

  /**
   * Master render method for the card.
   */
  protected render(): TemplateResult | void {
    const padding = this._getAspectRatioPadding();
    const outerStyle = {};

    // Padding to force a particular aspect ratio.
    if (padding != null) {
      outerStyle['padding-top'] = `${padding}%`;
    }

    const contentClasses = {
      'frigate-card-contents': true,
      absolute: padding != null,
    };

    const actions = this._getMergedActions();

    return html` <ha-card
      .actionHandler=${actionHandler({
        hasHold: frigateCardHasAction(actions.hold_action),
        hasDoubleClick: frigateCardHasAction(actions.double_tap_action),
      })}
      @action=${(ev: CustomEvent) => this._actionHandler(ev, actions)}
      @ll-custom=${this._cardActionHandler.bind(this)}
      @frigate-card:message=${this._messageHandler}
      @frigate-card:change-view=${this._changeViewHandler}
      @frigate-card:media-show=${this._mediaShowHandler}
    >
      ${this._getConfig().menu.mode == 'above' ? this._renderMenu() : ''}
      <div class="container outer" style="${styleMap(outerStyle)}">
        <div class="${classMap(contentClasses)}">
          ${this._cameras === undefined
            ? until(
                (async () => {
                  await this._loadCameras();
                  // Don't reset messages as errors may have been generated
                  // during the camera load.
                  this._changeView({ resetMessage: false });
                  return this._render();
                })(),
                renderProgressIndicator(),
              )
            : // Always want to call render even if there's a message, to
              // ensure live preload is always present (even if not displayed).
              this._render()}
          ${this._getConfig().elements
            ? // Always show elements to allow for custom menu items (etc.) to
              // be present even if a particular view has an error. Elements
              // need to render after the main views so it can render 'on top'.
              html` <frigate-card-elements
                .hass=${this._hass}
                .elements=${this._getConfig().elements}
                .conditionState=${this._conditionState}
                @frigate-card:menu-add=${(e) => {
                  this._addDynamicMenuButton(e.detail);
                }}
                @frigate-card:menu-remove=${(e) => {
                  this._removeDynamicMenuButton(e.detail);
                }}
                @frigate-card:condition-state-request=${(ev) => {
                  conditionStateRequestHandler(ev, this._conditionState);
                }}
              >
              </frigate-card-elements>`
            : ``}
          ${
            // Keep message rendering to last to show messages that may have
            // been generated during the render.
            this._message ? renderMessage(this._message) : ''
          }
        </div>
      </div>
      ${this._getConfig().menu.mode != 'above' ? this._renderMenu() : ''}
    </ha-card>`;
  }

  /**
   * Sub-render method for the card.
   */
  protected _render(): TemplateResult | void {
    const cameraConfig = this._getSelectedCameraConfig();

    if (!this._hass || !this._view || !cameraConfig) {
      return html``;
    }

    // Render but hide the live view if there's a message, or if it's preload
    // mode and the view is not live.
    const liveClasses = {
      hidden:
        !!this._message || (this._getConfig().live.preload && !this._view.is('live')),
    };

    return html`
      ${!this._message && this._view.is('image')
        ? html` <frigate-card-image
            .imageConfig=${this._getConfig().image}
            .view=${this._view}
          >
          </frigate-card-image>`
        : ``}
      ${!this._message && this._view.isGalleryView()
        ? html` <frigate-card-gallery
            .hass=${this._hass}
            .view=${this._view}
            .cameraConfig=${cameraConfig}
            .galleryConfig=${this._getConfig().event_gallery}
          >
          </frigate-card-gallery>`
        : ``}
      ${!this._message && this._view.isViewerView()
        ? html` <frigate-card-viewer
            .hass=${this._hass}
            .view=${this._view}
            .cameraConfig=${cameraConfig}
            .viewerConfig=${this._getConfig().event_viewer}
            .resolvedMediaCache=${this._resolvedMediaCache}
          >
          </frigate-card-viewer>`
        : ``}
      ${
        // Note: Subtle difference in condition below vs the other views in order
        // to always render the live view for live.preload mode.

        // Note: <frigate-card-live> uses the baseConfig rather than the
        // overriden config, as it does it's own overriding as part of the
        // camera carousel.
        this._getConfig().live.preload || (!this._message && this._view.is('live'))
          ? html`
              <frigate-card-live
                .hass=${this._hass}
                .view=${this._view}
                .liveConfig=${this._baseConfig.live}
                .conditionState=${this._conditionState}
                .liveOverrides=${getOverridesByKey(this._getConfig().overrides, 'live')}
                .cameras=${this._cameras}
                .preloaded=${this._getConfig().live.preload && !this._view.is('live')}
                class="${classMap(liveClasses)}"
              >
              </frigate-card-live>
            `
          : ``
      }
    `;
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
