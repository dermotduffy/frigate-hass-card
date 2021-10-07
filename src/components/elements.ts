import { LitElement, TemplateResult, html, CSSResultGroup, unsafeCSS } from 'lit';
import { HomeAssistant } from 'custom-card-helpers';
import { customElement, property } from 'lit/decorators';

import { ExtendedHomeAssistant, PictureElement, PictureElements } from '../types';

import elementsStyle from '../scss/elements.scss';

@customElement('frigate-card-elements')
export class FrigateCardElements extends LitElement {
  @property({ attribute: false })
  protected _pictureElements: PictureElements;

  protected _hass!: HomeAssistant & ExtendedHomeAssistant;
  protected _elements: HTMLElement[] = [];

  set hass(hass: HomeAssistant & ExtendedHomeAssistant) {
    for (let i = 0; hass && i < this._elements.length; i++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (this._elements[i] as any).hass = hass;
    }
    this._hass = hass;
  }

  set pictureElements(pictureElements: PictureElements) {
    if (this._elements.length > 0) {
      this._elements.forEach((el: HTMLElement) => {
        if (el.parentElement) {
          el.parentElement.removeChild(el);
        }
      });
      this._elements = [];
    }
    if (!pictureElements) {
      return;
    }
    for (let i = 0; i < pictureElements.length && pictureElements[i]; i++) {
      const element = this._createPictureElement(pictureElements[i]);
      if (element) {
        this._elements.push(element);
      }
    }
  }

  @property({ attribute: false })
  protected _createPictureElement(pictureElement: PictureElement): HTMLElement | null {
    let customElementName: string | null = null;

    switch (pictureElement.type) {
      case 'state-badge':
      case 'state-icon':
      case 'state-label':
      case 'service-button':
      case 'icon':
      case 'image':
      case 'conditional':
        customElementName = `hui-${pictureElement.type}-element`;
        break;
    }

    if (!customElementName) {
      return null;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const elementConstructor = customElements.get(customElementName) as any;
    if (!elementConstructor) {
      return null;
    }

    const element = new elementConstructor();
    element.hass = this._hass;
    try {
      element.setConfig(pictureElement);
    } catch (e) {
      console.error(e, (e as Error).stack);
      return null;
    }
    element.classList.add('element');

    const targetStyle = pictureElement.style || {};
    Object.keys(targetStyle).forEach((prop) => {
      element.style.setProperty(prop, targetStyle[prop]);
    });
    return element;
  }

  protected render(): TemplateResult {
    return html`${this._elements.map((element) => element)}`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(elementsStyle);
  }
}

export function renderFrigateCardElements(
  hass: HomeAssistant & ExtendedHomeAssistant,
  pictureElements: PictureElements,
): TemplateResult {
  return html` <frigate-card-elements .hass=${hass} .pictureElements=${pictureElements}>
  </frigate-card-elements>`;
}
