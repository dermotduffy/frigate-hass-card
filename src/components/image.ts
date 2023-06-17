import { HomeAssistant } from 'custom-card-helpers';
import { HassEntity } from 'home-assistant-js-websocket';
import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { live } from 'lit/directives/live.js';
import { createRef, ref, Ref } from 'lit/directives/ref.js';
import isEqual from 'lodash-es/isEqual';
import { CachedValueController } from '../cached-value-controller.js';
import defaultImage from '../images/frigate-bird-in-sky.jpg';
import { localize } from '../localize/localize.js';
import imageStyle from '../scss/image.scss';
import {
  CameraConfig,
  FrigateCardMediaPlayer,
  ImageViewConfig,
  MediaLoadedInfo
} from '../types.js';
import { contentsChanged } from '../utils/basic.js';
import { isHassDifferent } from '../utils/ha';
import {
  createMediaLoadedInfo,
  dispatchExistingMediaLoadedInfoAsEvent,
  dispatchMediaPauseEvent,
  dispatchMediaPlayEvent
} from '../utils/media-info.js';
import { updateElementStyleFromMediaLayoutConfig } from '../utils/media-layout.js';
import { View } from '../view/view.js';
import { dispatchErrorMessageEvent } from './message.js';

// See TOKEN_CHANGE_INTERVAL in https://github.com/home-assistant/core/blob/dev/homeassistant/components/camera/__init__.py .
const HASS_REJECTION_CUTOFF_MS = 5 * 60 * 1000;

@customElement('frigate-card-image')
export class FrigateCardImage extends LitElement implements FrigateCardMediaPlayer {
  @property({ attribute: false })
  public hass?: HomeAssistant;

  @property({ attribute: false })
  public view?: Readonly<View>;

  @property({ attribute: false })
  public cameraConfig?: CameraConfig;

  // Using contentsChanged to ensure overridden configs (e.g. when the
  // 'show_image_during_load' option is true for live views, an overridden
  // config may be used here).
  @property({ attribute: false, hasChanged: contentsChanged })
  public imageConfig?: ImageViewConfig;

  protected _refImage: Ref<HTMLImageElement> = createRef();

  protected _cachedValueController?: CachedValueController<string>;
  protected _boundVisibilityHandler = this._visibilityHandler.bind(this);

  protected _mediaLoadedInfo: MediaLoadedInfo | null = null;

  public async play(): Promise<void> {
    this._cachedValueController?.startTimer();
  }

  public async pause(): Promise<void> {
    this._cachedValueController?.stopTimer();
  }

  public async mute(): Promise<void> {
    // Not implemented.
  }

  public async unmute(): Promise<void> {
    // Not implemented.
  }

  public isMuted(): boolean {
    return true;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async seek(_seconds: number): Promise<void> {
    // Not implemented.
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  public async setControls(_controls: boolean): Promise<void> {
    // Not implemented.
  }

  public isPaused(): boolean {
    return !this._cachedValueController?.hasTimer() ?? true;
  }

  public async getScreenshotURL(): Promise<string | null> {
    return this._cachedValueController?.value ?? null;
  }

  /**
   * Get the camera entity for the current camera configuration.
   * @returns The entity or undefined if no camera entity is available.
   */
  protected _getCameraEntity(): string | null {
    return (
      (this.cameraConfig?.camera_entity || this.cameraConfig?.webrtc_card?.entity) ??
      null
    );
  }

  /**
   * Determine whether the element should be updated.
   * @param changedProps The changed properties if any.
   * @returns `true` if the element should be updated.
   */
  protected shouldUpdate(changedProps: PropertyValues): boolean {
    if (!this.hass || document.visibilityState !== 'visible') {
      return false;
    }

    const cameraEntity = this._getCameraEntity();
    if (
      changedProps.has('hass') &&
      changedProps.size == 1 &&
      this.imageConfig?.mode === 'camera' &&
      cameraEntity
    ) {
      if (isHassDifferent(this.hass, changedProps.get('hass'), [cameraEntity])) {
        // If the state of the camera entity has changed, remove the cached
        // value (will be re-calculated in willUpdate). This is important to
        // ensure a changed access token is immediately used.
        this._cachedValueController?.clearValue();
        return true;
      }
      return false;
    }
    return true;
  }

  /**
   * Ensure there is a cached value before an update.
   * @param _changedProps The changed properties
   */
  protected willUpdate(changedProps: PropertyValues): void {
    if (changedProps.has('imageConfig')) {
      if (this._cachedValueController) {
        this._cachedValueController.removeController();
      }
      if (this.imageConfig) {
        this._cachedValueController = new CachedValueController(
          this,
          this.imageConfig.refresh_seconds,
          this._getImageSource.bind(this),
          () => dispatchMediaPlayEvent(this),
          () => dispatchMediaPauseEvent(this),
        );
      }
      updateElementStyleFromMediaLayoutConfig(this, this.imageConfig?.layout);

      if (changedProps.has('imageConfig') && this.imageConfig?.zoomable) {
        import('./zoomer.js');
      }
    }

    // If the camera or view changed, immediately discard the old value (view to
    // allow pressing of the image button to fetch a fresh image). Likewise, if
    // the state is not acceptable, discard the old value (to allow a stock or
    // backup image to be displayed).
    if (
      changedProps.has('cameraConfig') ||
      changedProps.has('view') ||
      (this.imageConfig?.mode === 'camera' &&
        !this._getAcceptableState(this._getCameraEntity()))
    ) {
      this._cachedValueController?.clearValue();
    }

    if (!this._cachedValueController?.value) {
      this._cachedValueController?.updateValue();
    }
  }

  /**
   * Determine if a given entity is acceptable as the basis for an image render
   * (detects old or disconnected states). Using an old state is problematic as
   * it runs the risk that the JS has an old access token for the camera, and
   * that results in a notification on the HA UI about a failed login. See:
   * https://github.com/dermotduffy/frigate-hass-card/issues/398 .
   * @param entity The entity.
   * @returns The state or null if not acceptable.
   */
  protected _getAcceptableState(entity: string | null): HassEntity | null {
    const state = (entity ? this.hass?.states[entity] : null) ?? null;

    return !!this.hass &&
      this.hass.connected &&
      !!state &&
      Date.now() - Date.parse(state.last_updated) < HASS_REJECTION_CUTOFF_MS
      ? state
      : null;
  }

  /**
   * Component connected callback.
   */
  connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener('visibilitychange', this._boundVisibilityHandler);
    this._cachedValueController?.startTimer();
  }

  /**
   * Component disconnected callback.
   */
  disconnectedCallback(): void {
    this._cachedValueController?.stopTimer();
    document.removeEventListener('visibilitychange', this._boundVisibilityHandler);
    super.disconnectedCallback();
  }

  /**
   * Handle document visibility changes.
   */
  protected _visibilityHandler(): void {
    if (!this._refImage.value) {
      return;
    }
    if (document.visibilityState === 'hidden') {
      // Set the image to default when the document is hidden. This is to avoid
      // some browsers (e.g. Firefox) eagerly re-loading the old image when the
      // document regains visibility -- for some images (e.g. camera mode) the
      // image may be using an old-expired token and re-use prior to
      // re-generation of a new URL would generate an unauthorized request
      // (401), see:
      // https://github.com/dermotduffy/frigate-hass-card/issues/398
      this._cachedValueController?.stopTimer();
      this._cachedValueController?.clearValue();
      this._forceSafeImage();
    } else {
      // If the document is freshly re-visible, immediately re-render it to
      // restore the image src. If the HASS object is old (i.e. browser tab was
      // inactive for some time) this update request may be (correctly)
      // rejected.
      this._cachedValueController?.startTimer();
      this.requestUpdate();
    }
  }

  /**
   * Build a working absolute image URL that the browser will not cache.
   * @param url An input URL (may be relative to document origin)
   * @returns A new URL (absolute, will not be browser cached).
   */
  protected _buildImageURL(url: string): string {
    const urlObj = new URL(url, document.baseURI);
    urlObj.searchParams.append('_t', String(Date.now()));
    return urlObj.toString();
  }

  protected _getImageSource(): string {
    if (this.hass && this.imageConfig?.mode === 'camera') {
      const state = this._getAcceptableState(this._getCameraEntity());
      if (state?.attributes.entity_picture) {
        return this._buildImageURL(state.attributes.entity_picture);
      }
    }
    if (this.imageConfig?.mode !== 'screensaver' && this.imageConfig?.url) {
      return this._buildImageURL(this.imageConfig.url);
    }
    return defaultImage;
  }

  /**
   * Force the img element to a safe image.
   */
  protected _forceSafeImage(stockOnly?: boolean): void {
    if (this._refImage.value) {
      this._refImage.value.src =
        !stockOnly && this.imageConfig?.url ? this.imageConfig.url : defaultImage;
    }
  }

  protected _useZoomIfRequired(template: TemplateResult): TemplateResult {
    return this.imageConfig?.zoomable
      ? html` <frigate-card-zoomer> ${template} </frigate-card-zoomer>`
      : template;
  }

  protected render(): TemplateResult | void {
    const src = this._cachedValueController?.value;
    // Note the use of live() below to ensure the update will restore the image
    // src if it's been changed via _forceSafeImage().
    return src
      ? this._useZoomIfRequired(html` <img
          ${ref(this._refImage)}
          src=${live(src)}
          @load=${(ev: Event) => {
            const mediaLoadedInfo = createMediaLoadedInfo(ev, {
              player: this,
              capabilities: {
                supportsPause: !!this.imageConfig?.refresh_seconds,
              },
            });
            // Avoid the media being reported as repeatedly loading unless the
            // media info changes.
            if (mediaLoadedInfo && !isEqual(this._mediaLoadedInfo, mediaLoadedInfo)) {
              this._mediaLoadedInfo = mediaLoadedInfo;
              dispatchExistingMediaLoadedInfoAsEvent(this, mediaLoadedInfo);
            }
          }}
          @error=${() => {
            if (this.imageConfig?.mode === 'camera') {
              // In camera mode, the user has likely not made an error, but HA
              // may be unavailble, so show the stock image. Don't let the URL
              // override the stock image in this case, as this could create an
              // error loop if that URL subsequently failed to load.
              this._forceSafeImage(true);
            } else if (this.imageConfig?.mode === 'url') {
              // In url mode, the user likely specified a URL that cannot be
              // resolved. Show an error message.
              dispatchErrorMessageEvent(this, localize('error.image_load_error'), {
                context: this.imageConfig,
              });
            }
          }}
        />`)
      : html``;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(imageStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-image': FrigateCardImage;
  }
}
