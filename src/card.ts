import { HomeAssistant, LovelaceCardEditor } from '@dermotduffy/custom-card-helpers';
import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { ifDefined } from 'lit/directives/if-defined.js';
import { Ref, createRef, ref } from 'lit/directives/ref.js';
import { styleMap } from 'lit/directives/style-map.js';
import 'web-dialog';
import { actionHandler } from './action-handler-directive.js';
import { ConditionsEvaluateRequestEvent } from './card-controller/conditions-manager.js';
import { CardController } from './card-controller/controller';
import { MenuButtonController } from './components-lib/menu-button-controller';
import './components/elements.js';
import { FrigateCardElements } from './components/elements.js';
import './components/loading.js';
import './components/menu.js';
import { FrigateCardMenu } from './components/menu.js';
import './components/message.js';
import { renderMessage } from './components/message.js';
import './components/overlay.js';
import { FrigateCardOverlay } from './components/overlay.js';
import './components/status-bar';
import './components/thumbnail-carousel.js';
import './components/views.js';
import { FrigateCardViews } from './components/views.js';
import {
  FrigateCardConfig,
  MenuItem,
  RawFrigateCardConfig,
  StatusBarItem,
} from './config/types';
import { REPO_URL } from './const.js';
import { localize } from './localize/localize.js';
import cardStyle from './scss/card.scss';
import { ExtendedHomeAssistant, MediaLoadedInfo, Message } from './types.js';
import { frigateCardHasAction } from './utils/action.js';
import { getReleaseVersion } from './utils/diagnostics';

// ***************************************************************************
//                         General Card-Wide Notes
// ***************************************************************************

/** Media callbacks:
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

/** Actions (action/menu/ll-custom events):
 *
 * The card supports actions being configured in a number of places (e.g. tap on
 * an element, double_tap on a menu item, hold on the live view). These actions
 * are handled by frigateCardHandleActionConfig(). For Frigate-card specific
 * actions, the frigateCardHandleActionConfig() call will result in an ll-custom
 * DOM event being fired, which needs to be caught at the card level to handle.
 */

// ***************************************************************************
//                          Static Initializers
// ***************************************************************************

console.info(
  `%c FRIGATE-HASS-CARD \n` + `%c ${localize('common.version')} ` + getReleaseVersion(),
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

// ***************************************************************************
//                    Main FrigateCard Webcomponent
//
// Any non-rendering / non-lit related functionality should be added to
// CardController instead of this file.
// ***************************************************************************

@customElement('frigate-card')
class FrigateCard extends LitElement {
  protected _controller = new CardController(
    this,
    // Callback to scroll the main pane back to the top (example usecase: scrolling
    // half way down the gallery, then viewing diagnostics should result in
    // diagnostics starting at the top).
    () => this._refMain.value?.scroll({ top: 0 }),
    () => this._refMenu.value?.toggleMenu(),
    this._requestUpdateForComponentsThatUseConditions.bind(this),
  );

  protected _menuButtonController = new MenuButtonController();

  protected _refMenu: Ref<FrigateCardMenu> = createRef();
  protected _refOverlay: Ref<FrigateCardOverlay> = createRef();
  protected _refMain: Ref<HTMLElement> = createRef();
  protected _refElements: Ref<FrigateCardElements> = createRef();
  protected _refViews: Ref<FrigateCardViews> = createRef();

  // Convenience methods for very frequently accessed attributes.
  get _config(): FrigateCardConfig | null {
    return this._controller.getConfigManager().getConfig();
  }

  get _hass(): ExtendedHomeAssistant | null {
    return this._controller.getHASSManager().getHASS();
  }

  set hass(hass: ExtendedHomeAssistant) {
    this._controller.getHASSManager().setHASS(hass);

    // Manually set hass in the menu, elements and image. This is to allow these
    // to update, without necessarily re-rendering the entire card (re-rendering
    // is expensive).
    if (this._refMenu.value) {
      this._refMenu.value.hass = hass;
    }
    if (this._refElements.value) {
      this._refElements.value.hass = hass;
    }
    if (this._refViews.value) {
      this._refViews.value.hass = hass;
    }
  }

  public static async getConfigElement(): Promise<LovelaceCardEditor> {
    return await CardController.getConfigElement();
  }

  public static getStubConfig(_: HomeAssistant, entities: string[]): FrigateCardConfig {
    return CardController.getStubConfig(entities);
  }

  protected _requestUpdateForComponentsThatUseConditions(): void {
    // Update the components that need to know about condition changes. Trigger
    // updates directly on them to them to avoid the performance hit of a entire
    // card re-render (esp. when using card-mod).
    // https://github.com/dermotduffy/frigate-hass-card/issues/678
    if (this._refViews.value) {
      this._refViews.value.conditionsManagerEpoch =
        this._controller.getConditionsManager().getEpoch() ?? undefined;
    }
    if (this._refElements.value) {
      this._refElements.value.conditionsManagerEpoch =
        this._controller.getConditionsManager().getEpoch() ?? undefined;
    }
  }

  public setConfig(config: RawFrigateCardConfig): void {
    this._controller.getConfigManager().setConfig(config);
  }

  protected shouldUpdate(): boolean {
    // Do not allow a disconnected element to update, as it may cause cameras to
    // reinitialize/subscribe for an element that is no longer part of the
    // document.
    if (!this.isConnected) {
      return false;
    }

    // Always allow messages to render, as a message may be generated during
    // initialization.
    if (this._controller.getMessageManager().hasMessage()) {
      return true;
    }

    if (!this._controller.getInitializationManager().isInitializedMandatory()) {
      this._controller.getInitializationManager().initializeMandatory();
    }
    return true;
  }

  protected _renderMenuStatusContainer(
    position: 'top' | 'bottom' | 'overlay',
  ): TemplateResult | void {
    if (!this._config) {
      return;
    }

    const menuStyle = this._config.menu.style;
    const menuPosition = this._config.menu.position;
    const statusBarStyle = this._config.status_bar.style;
    const statusBarPosition = this._config.status_bar.position;

    if (
      // If there's nothing to render...
      (menuStyle === 'none' && statusBarStyle === 'none') ||
      // ... or the position I'm rendering does not contain the menu/status bar
      (position === 'overlay' &&
        menuStyle === 'outside' &&
        statusBarStyle === 'outside') ||
      (position !== 'overlay' &&
        (menuStyle !== 'outside' || menuPosition !== position) &&
        (statusBarStyle !== 'outside' || statusBarPosition !== position))
    ) {
      // ... then there's nothing to do.
      return;
    }

    const getContents = (kind: 'overlay' | 'outerlay'): TemplateResult => {
      const shouldRenderMenu =
        menuStyle !== 'none' &&
        ((menuStyle === 'outside' && kind === 'outerlay') ||
          (menuStyle !== 'outside' && kind === 'overlay'));

      const shouldRenderStatusBar =
        statusBarStyle !== 'none' &&
        ((statusBarStyle === 'outside' && kind === 'outerlay') ||
          (statusBarStyle !== 'outside' && kind === 'overlay'));

      // Complex logic to try to always put the menu in the right-looking place.
      const renderMenuFirst =
        menuPosition === 'left' ||
        menuPosition === 'right' ||
        (menuPosition === 'bottom' &&
          menuStyle === 'hidden' &&
          statusBarStyle !== 'popup') ||
        (menuPosition === 'top' &&
          (menuStyle !== 'hidden' || statusBarStyle === 'popup'));

      return html`
        ${shouldRenderMenu && renderMenuFirst ? this._renderMenu(menuPosition) : ''}
        ${shouldRenderStatusBar ? this._renderStatusBar(statusBarPosition) : ''}
        ${shouldRenderMenu && !renderMenuFirst ? this._renderMenu(menuPosition) : ''}
      `;
    };

    return html`
      ${position === 'overlay'
        ? html`<frigate-card-overlay>${getContents('overlay')}</frigate-card-overlay>`
        : html`<div class="outerlay" data-position="${position}">
            ${getContents('outerlay')}
          </div>`}
    `;
  }

  protected _renderMenu(slot?: string): TemplateResult | void {
    const view = this._controller.getViewManager().getView();
    if (!this._hass || !this._config) {
      return;
    }
    return html`
      <frigate-card-menu
        ${ref(this._refMenu)}
        slot=${ifDefined(slot)}
        .hass=${this._hass}
        .menuConfig=${this._config.menu}
        .buttons=${this._menuButtonController.calculateButtons(
          this._hass,
          this._config,
          this._controller.getCameraManager(),
          {
            inExpandedMode: this._controller.getExpandManager().isExpanded(),
            inFullscreenMode: this._controller.getFullscreenManager().isInFullscreen(),
            currentMediaLoadedInfo: this._controller.getMediaLoadedInfoManager().get(),
            showCameraUIButton: this._controller.getCameraURLManager().hasCameraURL(),
            mediaPlayerController: this._controller.getMediaPlayerManager(),
            microphoneManager: this._controller.getMicrophoneManager(),
            view: view,
            viewManager: this._controller.getViewManager(),
          },
        )}
        .entityRegistryManager=${this._controller.getEntityRegistryManager()}
      ></frigate-card-menu>
    `;
  }

  protected _renderStatusBar(slot?: string): TemplateResult | void {
    if (!this._config) {
      return;
    }

    return html`
      <frigate-card-status-bar
        slot=${ifDefined(slot)}
        .items=${this._controller.getStatusBarItemManager().calculateItems({
          statusConfig: this._config.status_bar,
          cameraManager: this._controller.getCameraManager(),
          view: this._controller.getViewManager().getView(),
          mediaLoadedInfo: this._controller.getMediaLoadedInfoManager().get(),
        })}
        .config=${this._config.status_bar}
      ></frigate-card-status-bar>
    `;
  }

  protected updated(): void {
    if (this._controller.getInitializationManager().isInitializedMandatory()) {
      this._controller.getQueryStringManager().executeIfNecessary();
    }
  }

  protected _renderInDialogIfNecessary(contents: TemplateResult): TemplateResult | void {
    if (this._controller.getExpandManager().isExpanded()) {
      return html` <web-dialog
        open
        center
        @close=${() => {
          this._controller.getExpandManager().setExpanded(false);
        }}
      >
        ${contents}
      </web-dialog>`;
    } else {
      return contents;
    }
  }

  protected render(): TemplateResult | void {
    if (!this._hass) {
      return;
    }

    const mainClasses = {
      main: true,
      'curve-top':
        this._config?.menu.style !== 'outside' || this._config?.menu.position !== 'top',
      'curve-bottom':
        this._config?.menu.style !== 'outside' || this._config?.menu.position === 'top',
    };

    const actions = this._controller.getActionsManager().getMergedActions();
    const cameraManager = this._controller.getCameraManager();
    const renderLoadingSpinner =
      this._config?.performance?.features.animated_progress_indicator !== false;
    const showLoadingSpinner =
      !this._controller.getInitializationManager().wasEverInitialized() &&
      !this._controller.getMessageManager().hasMessage();

    // Caution: Keep the main div and the menu next to one another in order to
    // ensure the hover menu styling continues to work.
    return this._renderInDialogIfNecessary(
      html` <ha-card
        id="ha-card"
        .actionHandler=${actionHandler({
          hasHold: frigateCardHasAction(actions.hold_action),
          hasDoubleClick: frigateCardHasAction(actions.double_tap_action),
        })}
        style="${styleMap(this._controller.getStyleManager().getAspectRatioStyle())}"
        @frigate-card:message=${(ev: CustomEvent<Message>) =>
          this._controller.getMessageManager().setMessageIfHigherPriority(ev.detail)}
        @frigate-card:media:loaded=${(ev: CustomEvent<MediaLoadedInfo>) =>
          this._controller.getMediaLoadedInfoManager().set(ev.detail)}
        @frigate-card:media:unloaded=${() =>
          this._controller.getMediaLoadedInfoManager().clear()}
        @frigate-card:media:volumechange=${
          () => this.requestUpdate() /* Refresh mute menu button */
        }
        @frigate-card:media:play=${
          () => this.requestUpdate() /* Refresh play/pause menu button */
        }
        @frigate-card:media:pause=${
          () => this.requestUpdate() /* Refresh play/pause menu button */
        }
        @frigate-card:focus=${() => this.focus()}
      >
        ${renderLoadingSpinner
          ? html`<frigate-card-loading .show=${showLoadingSpinner}>
            </frigate-card-loading>`
          : ''}
        ${this._renderMenuStatusContainer('top')}
        ${this._renderMenuStatusContainer('overlay')}
        <div ${ref(this._refMain)} class="${classMap(mainClasses)}">
          <frigate-card-views
            ${ref(this._refViews)}
            .hass=${this._hass}
            .viewManagerEpoch=${this._controller.getViewManager().getEpoch()}
            .cameraManager=${cameraManager}
            .resolvedMediaCache=${this._controller.getResolvedMediaCache()}
            .nonOverriddenConfig=${this._controller
              .getConfigManager()
              .getNonOverriddenConfig()}
            .overriddenConfig=${this._controller.getConfigManager().getConfig()}
            .cardWideConfig=${this._controller.getConfigManager().getCardWideConfig()}
            .rawConfig=${this._controller.getConfigManager().getRawConfig()}
            .configManager=${this._controller.getConfigManager()}
            .conditionsManagerEpoch=${this._controller
              .getConditionsManager()
              ?.getEpoch()}
            .hide=${!!this._controller.getMessageManager().hasMessage()}
            .microphoneManager=${this._controller.getMicrophoneManager()}
            .triggeredCameraIDs=${this._config?.view.triggers.show_trigger_status
              ? this._controller.getTriggersManager().getTriggeredCameraIDs()
              : undefined}
            .deviceRegistryManager=${this._controller.getDeviceRegistryManager()}
          ></frigate-card-views>
          ${
            // Keep message rendering to last to show messages that may have been
            // generated during the render.
            renderMessage(this._controller.getMessageManager().getMessage())
          }
        </div>
        ${this._renderMenuStatusContainer('bottom')}
        ${this._config?.elements
          ? // Elements need to render after the main views so it can render 'on
            // top'.
            html` <frigate-card-elements
              ${ref(this._refElements)}
              .hass=${this._hass}
              .elements=${this._config?.elements}
              .conditionsManagerEpoch=${this._controller
                .getConditionsManager()
                ?.getEpoch()}
              @frigate-card:menu:add=${(ev: CustomEvent<MenuItem>) => {
                this._menuButtonController.addDynamicMenuButton(ev.detail);
                this.requestUpdate();
              }}
              @frigate-card:menu:remove=${(ev: CustomEvent<MenuItem>) => {
                this._menuButtonController.removeDynamicMenuButton(ev.detail);
                this.requestUpdate();
              }}
              @frigate-card:status-bar:add=${(ev: CustomEvent<StatusBarItem>) => {
                this._controller
                  .getStatusBarItemManager()
                  .addDynamicStatusBarItem(ev.detail);
              }}
              @frigate-card:status-bar:remove=${(ev: CustomEvent<StatusBarItem>) => {
                this._controller
                  .getStatusBarItemManager()
                  .removeDynamicStatusBarItem(ev.detail);
              }}
              @frigate-card:conditions:evaluate=${(
                ev: ConditionsEvaluateRequestEvent,
              ) => {
                ev.evaluation = this._controller
                  .getConditionsManager()
                  ?.evaluateConditions(ev.conditions);
              }}
            >
            </frigate-card-elements>`
          : ``}
      </ha-card>`,
    );
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(cardStyle);
  }

  public getCardSize(): number {
    // This method is called before the card is rendered. As such, we don't
    // actually know what height the card will end up being, and for this card
    // it may change significantly with usage. As such, we just return a fixed
    // size guess (stock HA cards, such as the picture glance card, do similar).

    // Lovelace card size is expressed in units of 50px. A 16:9 aspect-ratio
    // camera will likely render as a 276.75px height masonary card => 5.52
    // units of 50, round up to 6.
    return 6;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card': FrigateCard;
  }
}
