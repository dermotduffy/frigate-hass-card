import { LitElement, ReactiveControllerHost } from 'lit';
import { ActionEventTarget } from '../action-handler-directive';
import { setOrRemoveAttribute } from '../utils/basic';
import { isCardInPanel } from '../utils/ha';
import { CardElementAPI } from './types';

export type ScrollCallback = () => void;
export type MenuToggleCallback = () => void;

export type CardHTMLElement = LitElement & ReactiveControllerHost & ActionEventTarget;

export class CardElementManager {
  protected _api: CardElementAPI;

  protected _element: CardHTMLElement;
  protected _scrollCallback: ScrollCallback;
  protected _menuToggleCallback: MenuToggleCallback;

  constructor(
    api: CardElementAPI,
    element: CardHTMLElement,
    scrollCallback: ScrollCallback,
    menuToggleCallback: MenuToggleCallback,
  ) {
    this._api = api;

    this._element = element;
    this._scrollCallback = scrollCallback;
    this._menuToggleCallback = menuToggleCallback;
  }

  public getElement(): HTMLElement {
    return this._element;
  }

  public scrollReset(): void {
    this._scrollCallback();
  }

  public toggleMenu(): void {
    this._menuToggleCallback();
  }

  public update(): void {
    this._element.requestUpdate();
  }

  public hasUpdated(): boolean {
    return this._element.hasUpdated;
  }

  public getCardHeight(): number {
    return this._element.getBoundingClientRect().height;
  }

  public elementConnected(): void {
    // Set initial condition state. Must be done after the element is connected to
    // allow callbacks to interact with the card.
    this._api.getInteractionManager().initialize();
    this._api.getFullscreenManager().initialize();
    this._api.getExpandManager().initialize();
    this._api.getMediaLoadedInfoManager().initialize();

    // Whether or not the card is in panel mode on the dashboard.
    setOrRemoveAttribute(this._element, isCardInPanel(this._element), 'panel');

    this._api.getFullscreenManager().connect();

    this._element.addEventListener(
      'mousemove',
      this._api.getInteractionManager().reportInteraction,
    );
    this._element.addEventListener(
      'll-custom',
      this._api.getActionsManager().handleActionEvent,
    );
    this._element.addEventListener(
      '@action',
      this._api.getInteractionManager().reportInteraction,
    );

    // Listen for HA `navigate` actions.
    // See: https://github.com/home-assistant/frontend/blob/273992c8e9c3062c6e49481b6d7d688a07067232/src/common/navigate.ts#L43
    window.addEventListener(
      'location-changed',
      this._api.getQueryStringManager().executeAll,
    );

    // Listen for history state changes (i.e. user using the browser
    // back/forward controls).
    window.addEventListener('popstate', this._api.getQueryStringManager().executeAll);

    // Manually call the location change handler as the card will be
    // disconnected/reconnected when dashboard 'tab' changes happen within HA.
    this._api.getQueryStringManager().executeAll();
  }

  public elementDisconnected(): void {
    setOrRemoveAttribute(this._element, false, 'panel');

    // When the dashboard 'tab' is changed, the media is effectively unloaded.
    this._api.getMediaLoadedInfoManager().clear();
    this._api.getFullscreenManager().disconnect();

    this._element.removeEventListener(
      'mousemove',
      this._api.getInteractionManager().reportInteraction,
    );
    this._element.removeEventListener(
      'll-custom',
      this._api.getActionsManager().handleActionEvent,
    );
    this._element.removeEventListener(
      '@action',
      this._api.getInteractionManager().reportInteraction,
    );

    window.removeEventListener(
      'location-changed',
      this._api.getQueryStringManager().executeAll,
    );
    window.removeEventListener('popstate', this._api.getQueryStringManager().executeAll);
  }
}
