import { HomeAssistant } from 'custom-card-helpers';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { ConditionState, fetchStateAndEvaluateCondition } from '../card-condition.js';
import { localize } from '../localize/localize.js';
import elementsStyle from '../scss/elements.scss';
import {
  FrigateCardError,
  FrigateConditional,
  MenuButton,
  MenuIcon,
  MenuStateIcon,
  MenuSubmenu,
  MenuSubmenuSelect,
  PictureElements
} from '../types.js';
import { dispatchFrigateCardEvent } from '../utils/basic.js';
import { dispatchFrigateCardErrorEvent } from './message.js';

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

interface HuiConditionalElement extends HTMLElement {
  hass: HomeAssistant;
  setConfig(config: unknown): void;
}

// A small wrapper around a HA conditional element used to render a set of
// picture elements.
@customElement('frigate-card-elements-core')
export class FrigateCardElementsCore extends LitElement {
  @property({ attribute: false })
  protected elements: PictureElements;

  /**
   * Need to ensure card re-renders when conditionState changes, hence having it
   * as a property even though it is not currently directly used by this class.
   */
  @property({ attribute: false })
  protected conditionState?: ConditionState;

  protected _root: HuiConditionalElement | null = null;

  @property({ attribute: false })
  protected hass?: HomeAssistant;

  /**
   * Create a transparent render root.
   */
  createRenderRoot(): LitElement {
    return this;
  }

  /**
   * Create the root node for our picture elements.
   * @returns The newly created root.
   */
  protected _createRoot(): HuiConditionalElement {
    const elementConstructor = customElements.get('hui-conditional-element');
    if (!elementConstructor || !this.hass) {
      throw new Error(localize('error.could_not_render_elements'));
    }

    const element = new elementConstructor() as HuiConditionalElement;
    element.hass = this.hass;
    const config = {
      type: 'conditional',
      conditions: [],
      elements: this.elements,
    };
    try {
      element.setConfig(config);
    } catch (e) {
      console.error(e);
      throw new FrigateCardError(localize('error.invalid_elements_config'));
    }
    return element;
  }

  /**
   * Create the root as necessary prior to rendering.
   */
  protected willUpdate(changedProps: PropertyValues): void {
    try {
      // The root is only created once per elements configuration change, to
      // avoid the elements being continually re-created & destroyed (for some
      // elements, e.g. image, recreation causes a flicker).
      if (this.elements && (!this._root || changedProps.has('elements'))) {
        this._root = this._createRoot();
      }
    } catch (e) {
      return dispatchFrigateCardErrorEvent(this, e as FrigateCardError);
    }
  }

  /**
   * Render the elements.
   * @returns A rendered template or void.
   */
  protected render(): TemplateResult | void {
    return html`${this._root || ''}`;
  }

  protected updated(): void {
    if (this.hass && this._root) {
      // Always update hass. It is used as a trigger to re-evaluate conditions
      // down the chain, see the note on FrigateCardElementsConditional.
      this._root.hass = this.hass;
    }
  }
}

/**
 * The master <frigate-card-elements> class, handles event listeners and styles.
 */
@customElement('frigate-card-elements')
export class FrigateCardElements extends LitElement {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  protected elements: PictureElements;

  @property({ attribute: false })
  protected conditionState?: ConditionState;

  protected _boundMenuRemoveHandler = this._menuRemoveHandler.bind(this);

  /**
   * Handle a picture element to be removed from the menu.
   * @param ev The event.
   */
  protected _menuRemoveHandler(ev: Event): void {
    // Re-dispatch event from this element (instead of the disconnected one, as
    // there is no parent of the disconnected element).
    dispatchFrigateCardEvent<MenuButton>(
      this,
      'menu-remove',
      (ev as CustomEvent).detail,
    );
  }

  /**
   * Handle a picture element to be added to the menu.
   * @param ev The event.
   */
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
      this._boundMenuRemoveHandler,
    );

    path[0].addEventListener('frigate-card:menu-remove', this._boundMenuRemoveHandler);
  }

  /**
   * Connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();

    // Catch icons being added to the menu (so their removal can be subsequently
    // handled).
    this.addEventListener('frigate-card:menu-add', this._menuAddHandler);
  }

  /**
   * Disconnected callback.
   */
  disconnectedCallback(): void {
    this.removeEventListener('frigate-card:menu-add', this._menuAddHandler);
    super.disconnectedCallback();
  }

  /**
   * Render the template.
   * @returns A rendered template.
   */
  protected render(): TemplateResult {
    return html` <frigate-card-elements-core
      .hass=${this.hass}
      .conditionState=${this.conditionState}
      .elements=${this.elements}
    >
    </frigate-card-elements-core>`;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(elementsStyle);
  }
}

/**
 * An element that can render others based on Frigate state (e.g. only show
 * overlays in particular views). This is the Frigate Card equivalent to the HA
 * conditional card.
 */
@customElement('frigate-card-conditional')
export class FrigateCardElementsConditional extends LitElement {
  protected _config?: FrigateConditional;

  // Every set of hass is treated  as a reason to re-evaluate. Given that this
  // node may be buried down the DOM (as a descendent of non-Frigate card
  // elements), the hass object is used as the (only) trigger for condition
  // re-fetch even if hass itself has not changed.
  @property({ attribute: false, hasChanged: () => true })
  protected hass?: HomeAssistant;

  /**
   * Set the card configuration.
   * @param config The card configuration.
   */
  public setConfig(config: FrigateConditional): void {
    this._config = config;
  }

  /**
   * Create a root into which to render. This card is "transparent".
   * @returns
   */
  createRenderRoot(): LitElement {
    return this;
  }

  /**
   * Connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();

    // HA will automatically attach the 'element' class to picture elements. As
    // this is a transparent 'conditional' element (just like the stock HA
    // 'conditional' element), it should not have positioning.
    this.className = '';
  }

  /**
   * Render the card.
   */
  protected render(): TemplateResult | void {
    if (fetchStateAndEvaluateCondition(this, this._config.conditions)) {
      return html` <frigate-card-elements-core
        .hass=${this.hass}
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

  /**
   * Set the card config.
   * @param config The configuration.
   */
  public setConfig(config: T): void {
    this._config = config;
  }

  /**
   * Connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    if (this._config) {
      dispatchFrigateCardEvent<T>(this, 'menu-add', this._config);
    }
  }

  /**
   * Disconnected callback.
   */
  disconnectedCallback(): void {
    if (this._config) {
      dispatchFrigateCardEvent<T>(this, 'menu-remove', this._config);
    }
    super.disconnectedCallback();
  }
}

@customElement('frigate-card-menu-icon')
export class FrigateCardElementsMenuIcon extends FrigateCardElementsBaseMenuIcon<MenuIcon> {}

@customElement('frigate-card-menu-state-icon')
export class FrigateCardElementsMenuStateIcon extends FrigateCardElementsBaseMenuIcon<MenuStateIcon> {}

@customElement('frigate-card-menu-submenu')
export class FrigateCardElementsMenuSubmenu extends FrigateCardElementsBaseMenuIcon<MenuSubmenu> {}

@customElement('frigate-card-menu-submenu-select')
export class FrigateCardElementsMenuSubmenuSelect extends FrigateCardElementsBaseMenuIcon<MenuSubmenuSelect> {}
