import {
  css,
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import galleryStyle from '../scss/gallery.scss';
import {
  CameraConfig,
  CardWideConfig,
  ExtendedHomeAssistant,
  frigateCardConfigDefaults,
  GalleryConfig,
  THUMBNAIL_WIDTH_MAX,
} from '../types.js';
import { stopEventFromActivatingCardWideActions } from '../utils/action.js';
import {
  changeViewToRecentEventsForCameraAndDependents,
  changeViewToRecentRecordingForCameraAndDependents,
} from '../utils/media-to-view.js';
import { CameraManager } from '../camera/manager.js';
import { View } from '../view/view.js';
import { renderProgressIndicator } from './message.js';
import './thumbnail.js';
import { THUMBNAIL_DETAILS_WIDTH_MIN } from './thumbnail.js';
import './media-filter';

@customElement('frigate-card-gallery')
export class FrigateCardGallery extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public galleryConfig?: GalleryConfig;

  @property({ attribute: false })
  public cameras?: Map<string, CameraConfig>;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    if (
      !this.hass ||
      !this.view ||
      !this.cameras ||
      !this.view.isGalleryView() ||
      !this.cameraManager
    ) {
      return;
    }

    if (!this.view.query) {
      if (this.view.is('recordings')) {
        changeViewToRecentRecordingForCameraAndDependents(
          this,
          this.hass,
          this.cameraManager,
          this.cameras,
          this.view,
        );
      } else {
        const mediaType = this.view.is('snapshots')
          ? 'snapshots'
          : this.view.is('clips')
          ? 'clips'
          : null;
        changeViewToRecentEventsForCameraAndDependents(
          this,
          this.hass,
          this.cameraManager,
          this.cameras,
          this.view,
          {
            ...(mediaType && { mediaType: mediaType }),
          },
        );
      }
      return renderProgressIndicator({ cardWideConfig: this.cardWideConfig });
    }

    return html`
      <frigate-card-gallery-core
        .hass=${this.hass}
        .view=${this.view}
        .galleryConfig=${this.galleryConfig}
        .cameras=${this.cameras}
        .cameraManager=${this.cameraManager}
      >
      </frigate-card-gallery-core>
    `;
  }

  /**
   * Get element styles.
   */
  static get styles(): CSSResultGroup {
    return css`
      :host {
        display: block;
        width: 100%;
        height: 100%;
      }
    `;
  }
}

@customElement('frigate-card-gallery-core')
export class FrigateCardGalleryCore extends LitElement {
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public galleryConfig?: GalleryConfig;

  @property({ attribute: false })
  public cameras?: Map<string, CameraConfig>;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  protected _resizeObserver: ResizeObserver;

  constructor() {
    super();
    this._resizeObserver = new ResizeObserver(this._resizeHandler.bind(this));
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    this._resizeObserver.observe(this);
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    this._resizeObserver.disconnect();
    super.disconnectedCallback();
  }

  /**
   * Set gallery columns.
   */
  protected _setColumnCount(): void {
    const thumbnailSize =
      this.galleryConfig?.controls.thumbnails.size ??
      frigateCardConfigDefaults.event_gallery.controls.thumbnails.size;
    const columns = this.galleryConfig?.controls.thumbnails.show_details
      ? Math.max(1, Math.floor(this.clientWidth / THUMBNAIL_DETAILS_WIDTH_MIN))
      : Math.max(
          1,
          Math.ceil(this.clientWidth / THUMBNAIL_WIDTH_MAX),
          Math.ceil(this.clientWidth / thumbnailSize),
        );

    this.style.setProperty('--frigate-card-gallery-columns', String(columns));
  }

  /**
   * Handle gallery resize.
   */
  protected _resizeHandler(): void {
    this._setColumnCount();
  }

  /**
   * Called when an update will occur.
   * @param changedProps The changed properties
   */
  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('galleryConfig')) {
      if (this.galleryConfig?.controls.thumbnails.show_details) {
        this.setAttribute('details', '');
      } else {
        this.removeAttribute('details');
      }
      this._setColumnCount();
      if (this.galleryConfig?.controls.thumbnails.size) {
        this.style.setProperty(
          '--frigate-card-thumbnail-size',
          `${this.galleryConfig.controls.thumbnails.size}px`,
        );
      }
    }
  }

  /**
   * Master render method.
   * @returns A rendered template.
   */
  protected render(): TemplateResult | void {
    const results = this.view?.queryResults?.getResults();

    if (
      !results ||
      !this.hass ||
      !this.view ||
      !this.view.isGalleryView() ||
      !this.cameras
    ) {
      return html``;
    }

    return html` ${results.map(
      (media, index) =>
        html`<frigate-card-thumbnail
          .hass=${this.hass}
          .cameraManager=${this.cameraManager}
          .media=${media}
          .cameraConfig=${this.cameras?.get(media.getCameraID())}
          .view=${this.view}
          ?details=${!!this.galleryConfig?.controls.thumbnails.show_details}
          ?show_favorite_control=${!!this.galleryConfig?.controls.thumbnails
            .show_favorite_control}
          ?show_timeline_control=${!!this.galleryConfig?.controls.thumbnails
            .show_timeline_control}
          @click=${(ev: Event) => {
            if (this.view) {
              this.view
                .evolve({
                  view: 'media',
                  queryResults: this.view.queryResults?.clone().selectResult(index),
                })
                .dispatchChangeEvent(this);
            }
            stopEventFromActivatingCardWideActions(ev);
          }}
        >
        </frigate-card-thumbnail>`,
    )}`;
  }

  /**
   * Get styles.
   */
  static get styles(): CSSResultGroup {
    return unsafeCSS(galleryStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-gallery-core': FrigateCardGalleryCore;
    'frigate-card-gallery': FrigateCardGallery;
  }
}
