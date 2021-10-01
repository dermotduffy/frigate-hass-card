import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators';
import { classMap } from 'lit/directives/class-map.js';

import { MenuButton } from '../types';
import type { FrigateMenuMode } from '../types';

import menuStyle from '../scss/menu.scss';

type FrigateCardMenuCallback = (name: string) => void;

export const MENU_HEIGHT = 46;

// A menu for the Frigate card.
@customElement('frigate-card-menu')
export class FrigateCardMenu extends LitElement {
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
        this.menuMode.startsWith('hidden-') ||
        this.menuMode.startsWith('overlay-') ||
        this.menuMode.startsWith('hover-'),
      'expanded-horizontal':
        (this.menuMode.startsWith('overlay-') ||
          this.menuMode.startsWith('hover-') ||
          this.expand) &&
        (this.menuMode.endsWith('-top') || this.menuMode.endsWith('-bottom')),
      'expanded-vertical':
        (this.menuMode.startsWith('overlay-') ||
          this.menuMode.startsWith('hover-') ||
          this.expand) &&
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
    return unsafeCSS(menuStyle);
  }
}
