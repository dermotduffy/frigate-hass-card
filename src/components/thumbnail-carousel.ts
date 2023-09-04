import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { CameraManager } from '../camera-manager/manager.js';
import thumbnailCarouselStyle from '../scss/thumbnail-carousel.scss';
import { ExtendedHomeAssistant, ThumbnailsControlConfig } from '../types.js';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import { dispatchFrigateCardEvent } from '../utils/basic.js';
import { CarouselDirection } from '../utils/embla/carousel-controller.js';
import { MediaQueriesResults } from '../view/media-queries-results';
import { View } from '../view/view.js';
import './carousel.js';
import './thumbnail.js';

export interface ThumbnailCarouselTap {
  queryResults: MediaQueriesResults;
}

@customElement('frigate-card-thumbnail-carousel')
export class FrigateCardThumbnailCarousel extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public config?: ThumbnailsControlConfig;

  protected _thumbnailSlides: TemplateResult[] = [];

  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('config')) {
      if (this.config?.size) {
        this.style.setProperty('--frigate-card-thumbnail-size', `${this.config.size}px`);
      }
      const direction = this._getDirection();
      if (direction) {
        this.setAttribute('direction', direction);
      } else {
        this.removeAttribute('direction');
      }
    }

    const renderProperties = [
      'cameraManager',
      'config',
      'transitionEffect',
      'view',
    ] as const;
    if (renderProperties.some((prop) => changedProps.has(prop))) {
      this._thumbnailSlides = this._renderSlides();
    }

    if (changedProps.has('view')) {
      this.style.setProperty(
        '--frigate-card-carousel-thumbnail-opacity',
        this._getSelectedSlide() === null ? '1.0' : '0.4',
      );
    }
  }

  protected _getSelectedSlide(view?: View): number | null {
    return (view ?? this.view)?.queryResults?.getSelectedIndex() ?? null;
  }

  protected _renderSlides(): TemplateResult[] {
    const slides: TemplateResult[] = [];
    const seekTarget = this.view?.context?.mediaViewer?.seek;
    const selectedIndex = this._getSelectedSlide();

    for (const media of this.view?.queryResults?.getResults() ?? []) {
      const index = slides.length;
      const classes = {
        embla__slide: true,
        'slide-selected': selectedIndex === index,
      };

      slides.push(html` <frigate-card-thumbnail
        class="${classMap(classes)}"
        .cameraManager=${this.cameraManager}
        .hass=${this.hass}
        .media=${media}
        .view=${this.view}
        .seek=${seekTarget && media.includesTime(seekTarget) ? seekTarget : undefined}
        ?details=${!!this.config?.show_details}
        ?show_favorite_control=${this.config?.show_favorite_control}
        ?show_timeline_control=${this.config?.show_timeline_control}
        ?show_download_control=${this.config?.show_download_control}
        @click=${(ev: Event) => {
          if (this.view && this.view.queryResults) {
            dispatchFrigateCardEvent<ThumbnailCarouselTap>(
              this,
              'thumbnail-carousel:tap',
              {
                queryResults: this.view.queryResults.clone().selectIndex(index),
              },
            );
          }
          stopEventFromActivatingCardWideActions(ev);
        }}
      >
      </frigate-card-thumbnail>`);
    }
    return slides;
  }

  protected _getDirection(): CarouselDirection | null {
    if (this.config?.mode === 'left' || this.config?.mode === 'right') {
      return 'vertical';
    } else if (this.config?.mode === 'above' || this.config?.mode === 'below') {
      return 'horizontal';
    }
    return null;
  }

  protected render(): TemplateResult | void {
    const direction = this._getDirection();
    if (!this._thumbnailSlides.length || !this.config || !direction) {
      return;
    }

    return html`<frigate-card-carousel
      direction=${direction}
      .selected=${this._getSelectedSlide() ?? 0}
      .dragFree=${true}
    >
      ${this._thumbnailSlides}
    </frigate-card-carousel>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(thumbnailCarouselStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-thumbnail-carousel': FrigateCardThumbnailCarousel;
  }
}
