import { LitElement, TemplateResult, html, CSSResultGroup, unsafeCSS } from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { customElement, property, query } from 'lit/decorators';

import {
  ExtendedHomeAssistant,
  FrigateConditional,
  MenuButton,
  MenuIcon,
  MenuStateIcon,
  PictureElements,
} from '../types';
import { dispatchErrorMessageEvent, dispatchEvent } from '../common';

import elementsStyle from '../scss/elements.scss';
import { localize } from '../localize/localize';
import { View } from '../view';

/* A note on picture element rendering:
 *
 * To avoid needing to deal with the rendering of all the picture elements
 * ourselves, instead the card relies on a stock conditional element (with no
 * conditions) to render elements (this._root). This has a few advantages:
 *
 * - Does not depend on (much of!) an internal API -- conditional picture
 *   elements are unlikely to go away or change.
 * - Forces usage of elements that HA understands. If the rendering is done
 *   directly, it is (ask me how I know!) very tempting to render things in such
 *   a way that a nested conditional element would not be able to render, i.e.
 *   the custom rendering logic would only apply at the first level.
 */

/* A note on custom elements:
 *
 * The native HA support for custom elements is used for the menu-icon and
 * menu-state-icon elements. This ensures multi-nested conditionals will work
 * correctly. These custom elements 'render' by firing events that are caught by
 * the card to call for inclusion/exclusion of the menu icon in question.
 *
 * One major complexity here is that the top <frigate-card-elements> element
 * will not necessarily know when a menu icon is no longer rendered because of a
 * conditional that no-longer evaluates to true. As such, it cannot know when to
 * signal for the menu icon removal. Furthermore, the menu icon element itself
 * will only know it's been removed _after_ it's been disconnected from the DOM,
 * so normal event propagation at that point will not work. Instead, we must
 * catch the menu icon _addition_ and register the eventhandler for the removal
 * directly on the child (which will have no parent at time of calling). That
 * then triggers <frigate-card-elements> to re-dispatch a removal event for
 * upper layers to handle correctly.
 */

// A small wrapper around a HA conditional element used to render a set of
// picture elements.
@customElement('frigate-card-elements-core')
class FrigateCardElementsCore extends LitElement {
  @property({ attribute: false })
  protected elements: PictureElements;

  @property({ attribute: false })
  protected view?: View;

  protected _root: HTMLElement | null = null;
  protected _hass!: HomeAssistant & ExtendedHomeAssistant;

  set hass(hass: HomeAssistant & ExtendedHomeAssistant) {
    if (this._root) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this._root as any).hass = hass;
    }
    this._hass = hass;
  }

  // Transparent to elements.
  createRenderRoot(): LitElement {
    return this;
  }

  protected _createRoot(): HTMLElement {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elementConstructor = customElements.get('hui-conditional-element') as any;
    if (!elementConstructor) {
      throw new Error(localize('error.could_not_render_elements'));
    }

    const element = new elementConstructor();
    element.hass = this._hass;
    const config = {
      type: 'conditional',
      conditions: [],
      elements: this.elements,
    };
    try {
      element.setConfig(config);
    } catch (e) {
      console.error(e, (e as Error).stack);
      throw new Error(localize('error.invalid_elements_config'));
    }
    return element;
  }

  protected render(): TemplateResult | void {
    try {
      // Recreate the root on each render to ensure conditional ancestors
      // re-fire events as necessary.
      this._root = this._createRoot();
    } catch (e) {
      return dispatchErrorMessageEvent(this, (e as Error).message);
    }
    return html`${this._root || ''}`;
  }
}

// THe master <frigate-card-elements> class, handles event listeners and styles.
@customElement('frigate-card-elements')
export class FrigateCardElements extends LitElement {
  @property({ attribute: false })
  protected elements: PictureElements;

  @property({ attribute: false })
  protected view!: View;

  protected _hass!: HomeAssistant & ExtendedHomeAssistant;

  @query('frigate-card-elements-core')
  _core!: FrigateCardElementsCore;

  set hass(hass: HomeAssistant & ExtendedHomeAssistant) {
    if (this._core) {
      this._core.hass = hass;
    }
    this._hass = hass;
  }

  protected _menuRemoveHandler(ev: Event): void {
    // Re-dispatch event from this element (instead of the disconnected one, as
    // there is no parent of the disconnected element).
    dispatchEvent<MenuButton>(this, 'menu-remove', (ev as CustomEvent).detail);
  }

  protected _menuAddHandler(ev: Event): void {
    ev = ev as CustomEvent<MenuButton>;
    const path = ev.composedPath();
    if (!path.length) {
      return;
    }

    // See 'A note on custom elements' above to explain what's going on here.

    // Ensure listener is only attached 1 time by removing it first.
    path[0].removeEventListener(
      'frigate-card:menu-remove',
      this._menuRemoveHandler.bind(this),
    );

    path[0].addEventListener(
      'frigate-card:menu-remove',
      this._menuRemoveHandler.bind(this),
    );
  }

  connectedCallback(): void {
    super.connectedCallback();

    // Catch icons being added to the menu (so their removal can be subsequently
    // handled).
    this.addEventListener('frigate-card:menu-add', this._menuAddHandler);
  }

  disconnectedCallback(): void {
    this.removeEventListener('frigate-card:menu-add', this._menuAddHandler);
    super.disconnectedCallback();
  }

  protected render(): TemplateResult {
    return html` <frigate-card-elements-core
      .hass=${this._hass}
      .view=${this.view}
      .elements=${this.elements}
    >
    </frigate-card-elements-core>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(elementsStyle);
  }
}

class StateRequestEvent extends Event {
  public view: View | undefined;
}

// An element that can render others based on Frigate state (e.g. only show
// overlays in particular views). This is the Frigate Card equivalent to the HA
// conditional card.
@customElement('frigate-card-conditional')
export class FrigateCardElementsConditional extends LitElement {
  protected _config: FrigateConditional | null = null;
  protected _hass!: HomeAssistant & ExtendedHomeAssistant;

  @query('frigate-card-elements-core')
  _core!: FrigateCardElementsCore;

  set hass(hass: HomeAssistant & ExtendedHomeAssistant) {
    if (this._core) {
      this._core.hass = hass;
    }
    this._hass = hass;
  }

  public setConfig(config: FrigateConditional): void {
    this._config = config;
  }

  // Transparent to elements.
  createRenderRoot(): LitElement {
    return this;
  }

  protected evaluate(stateEvent: StateRequestEvent): boolean {
    if (stateEvent.view && this._config.conditions.view) {
      return this._config.conditions.view.includes(stateEvent.view.view);
    }
    return true;
  }

  connectedCallback(): void {
    super.connectedCallback();

    // HA will automatically attach the 'element' class to picture elements. As
    // this is a transparent 'conditional' element (just like the stock HA
    // 'conditional' element), it should not have positioning.
    this.className = '';
  }

  protected render(): TemplateResult | void {
    const stateEvent = new StateRequestEvent(`frigate-card:state-request`, {
      bubbles: true,
      composed: true,
    });

    /* Special note on what's going on here:
     *
     * Picture elements all are descendents of <frigate-card-elements>, but
     * there may be arbitrary complexity and layers (that this card doesn't
     * control) between that master element and this custom conditional element.
     * This element needs Frigate card state to function (e.g. view), but
     * there's no clean way to pass state from the rest of card down through
     * these layers. Instead, we dispatch a "request for state"
     * (StateRequestEvent) event upwards which is caught by the outer card and
     * state added to the event object. Because event propagation is handled
     * synchronously, the state will be added to the event before the flow
     * proceeds.
     */
    this.dispatchEvent(stateEvent);
    if (this.evaluate(stateEvent)) {
      return html` <frigate-card-elements-core
        .hass=${this._hass}
        .elements=${this._config.elements}
      >
      </frigate-card-elements-core>`;
    }
  }
}

// A base class for rendering menu icons / menu state icons.
export class FrigateCardElementsBaseMenuIcon<T> extends LitElement {
  @property({ attribute: false })
  protected _config: T | null = null;

  public setConfig(config: T): void {
    this._config = config;
  }

  connectedCallback(): void {
    super.connectedCallback();
    if (this._config) {
      dispatchEvent<T>(this, 'menu-add', this._config);
    }
  }

  disconnectedCallback(): void {
    if (this._config) {
      dispatchEvent<T>(this, 'menu-remove', this._config);
    }
    super.disconnectedCallback();
  }
}

@customElement('frigate-card-menu-icon')
export class FrigateCardElementsMenuIcon extends FrigateCardElementsBaseMenuIcon<MenuIcon> {}

@customElement('frigate-card-menu-state-icon')
export class FrigateCardElementsMenuStateIcon extends FrigateCardElementsBaseMenuIcon<MenuStateIcon> {}
