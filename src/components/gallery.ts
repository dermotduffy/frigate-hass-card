import {
  css,
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property, state } from 'lit/decorators.js';
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
import { CameraManager, ExtendedMediaQueryResult } from '../camera/manager.js';
import { View } from '../view/view.js';
import { renderProgressIndicator } from './message.js';
import './thumbnail.js';
import { THUMBNAIL_DETAILS_WIDTH_MIN } from './thumbnail.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import { MediaQueriesClassifier } from '../view/media-queries-classifier';
import { EventMediaQueries, RecordingMediaQueries } from '../view/media-queries';
import { EventQuery, MediaQuery, RecordingQuery } from '../camera/types';
import { MediaQueriesResults } from '../view/media-queries-results';
import { errorToConsole } from '../utils/basic';
import "./media-filter";

const GALLERY_MEDIA_CHUNK_SIZE = 100;

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

    // TODO Make this slot choice configuration left/right.
    return html`
      <frigate-card-surround-basic
        .drawerIcons=${{
          'right': {
            closed: 'mdi:filter-cog-outline',
            open: 'mdi:filter-cog'
          }
        }}
      >
        <frigate-card-media-filter
          .hass=${this.hass}
          .cameras=${this.cameras}
          .cameraManager=${this.cameraManager}
          .view=${this.view}
          .mediaLimit=${GALLERY_MEDIA_CHUNK_SIZE}
          slot="right"
        >
        </frigate-card-media-filter>
        <frigate-card-gallery-core
          .hass=${this.hass}
          .view=${this.view}
          .galleryConfig=${this.galleryConfig}
          .cameras=${this.cameras}
          .cameraManager=${this.cameraManager}
        >
        </frigate-card-gallery-core>
      </frigate-card-surround-basic>
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

  protected _intersectionObserver: IntersectionObserver;
  protected _resizeObserver: ResizeObserver;
  protected _refLoader: Ref<HTMLElement> = createRef();

  @state()
  protected _showExtensionLoader = true;

  constructor() {
    super();
    this._resizeObserver = new ResizeObserver(this._resizeHandler.bind(this));
    this._intersectionObserver = new IntersectionObserver(
      this._intersectionHandler.bind(this),
    );
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    this._resizeObserver.observe(this);

    // Request update in order to ensure the intersection observer reconnects
    // with the loader sentinel.
    this.requestUpdate();
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    this._resizeObserver.disconnect();
    this._intersectionObserver.disconnect();
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

  protected async _intersectionHandler(
    entries: IntersectionObserverEntry[],
  ): Promise<void> {
    if (!this.cameraManager || !this.hass || !this.view) {
      return;
    }
    if (entries.every((entry) => !entry.isIntersecting)) {
      return;
    }

    this._showExtensionLoader = false;

    const query = this.view?.query;
    const rawQueries: MediaQuery[] | null = query?.getQueries() ?? null;
    const existingMedia = this.view.queryResults?.getResults();
    if (!query || !rawQueries || !existingMedia) {
      return;
    }

    let extension: ExtendedMediaQueryResult<MediaQuery> | null;
    try {
      extension = await this.cameraManager.extendMediaQueries(
        this.hass,
        rawQueries,
        existingMedia,
        'earlier',
        GALLERY_MEDIA_CHUNK_SIZE,
      );
    } catch (e) {
      errorToConsole(e as Error);
      return;
    }

    if (extension) {
      const newMediaQueries = MediaQueriesClassifier.areEventQueries(query)
        ? new EventMediaQueries(extension.queries as EventQuery[])
        : MediaQueriesClassifier.areRecordingQueries(query)
        ? new RecordingMediaQueries(extension.queries as RecordingQuery[])
        : null;

      if (newMediaQueries) {
        this.view
          ?.evolve({
            query: newMediaQueries,
            queryResults: new MediaQueriesResults(extension.results),
          })
          .dispatchChangeEvent(this);
      }
    }
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
    if (changedProps.has('view')) {
      this._showExtensionLoader = true;
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

    return html`
      ${results.map(
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
      )}
      ${this._showExtensionLoader
        ? html` <ha-card ${ref(this._refLoader)}>
            <span class="dotdotdot"></span>
          </ha-card>`
        : ''}
    `;
  }

  public updated(): void {
    if (this._refLoader.value) {
      this._intersectionObserver.disconnect();
      this._intersectionObserver.observe(this._refLoader.value);
    }
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
