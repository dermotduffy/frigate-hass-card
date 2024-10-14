import {
  CSSResultGroup,
  html,
  LitElement,
  PropertyValues,
  TemplateResult,
  unsafeCSS,
} from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { guard } from 'lit/directives/guard.js';
import { createRef, Ref, ref } from 'lit/directives/ref.js';
import { CameraManager } from '../../camera-manager/manager.js';
import { ViewManagerEpoch } from '../../card-controller/view/types.js';
import { ZoomSettingsObserved } from '../../components-lib/zoom/types.js';
import { handleZoomSettingsObservedEvent } from '../../components-lib/zoom/zoom-view-context.js';
import { CardWideConfig, ViewerConfig } from '../../config/types.js';
import '../../patches/ha-hls-player.js';
import viewerProviderStyle from '../../scss/viewer-provider.scss';
import { ExtendedHomeAssistant, FrigateCardMediaPlayer } from '../../types.js';
import { mayHaveAudio } from '../../utils/audio.js';
import { aspectRatioToString } from '../../utils/basic.js';
import { canonicalizeHAURL } from '../../utils/ha/index.js';
import { ResolvedMediaCache, resolveMedia } from '../../utils/ha/resolved-media.js';
import {
  dispatchMediaLoadedEvent,
  dispatchMediaPauseEvent,
  dispatchMediaPlayEvent,
  dispatchMediaVolumeChangeEvent,
} from '../../utils/media-info.js';
import { updateElementStyleFromMediaLayoutConfig } from '../../utils/media-layout.js';
import {
  hideMediaControlsTemporarily,
  MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
  playMediaMutingIfNecessary,
  setControlsOnVideo,
} from '../../utils/media.js';
import { screenshotMedia } from '../../utils/screenshot.js';
import { ViewMediaClassifier } from '../../view/media-classifier.js';
import { MediaQueriesClassifier } from '../../view/media-queries-classifier.js';
import { VideoContentType, ViewMedia } from '../../view/media.js';
import { renderProgressIndicator } from '../message.js';

@customElement('frigate-card-viewer-provider')
export class FrigateCardViewerProvider
  extends LitElement
  implements FrigateCardMediaPlayer
{
  @property({ attribute: false })
  public hass?: ExtendedHomeAssistant;

  @property({ attribute: false })
  public viewManagerEpoch?: ViewManagerEpoch;

  @property({ attribute: false })
  public media?: ViewMedia;

  @property({ attribute: false })
  public viewerConfig?: ViewerConfig;

  @property({ attribute: false })
  public resolvedMediaCache?: ResolvedMediaCache;

  // Whether or not to load the viewer media. If `false`, no contents are
  // rendered until this attribute is set to `true` (this is useful for lazy
  // loading).
  @property({ attribute: false })
  public load = false;

  @property({ attribute: false })
  public cameraManager?: CameraManager;

  @property({ attribute: false })
  public cardWideConfig?: CardWideConfig;

  protected _refFrigateCardMediaPlayer: Ref<Element & FrigateCardMediaPlayer> =
    createRef();
  protected _refVideoProvider: Ref<HTMLVideoElement> = createRef();
  protected _refImageProvider: Ref<HTMLImageElement> = createRef();

  public async play(): Promise<void> {
    await playMediaMutingIfNecessary(
      this,
      this._refFrigateCardMediaPlayer.value ?? this._refVideoProvider.value,
    );
  }

  public async pause(): Promise<void> {
    (this._refFrigateCardMediaPlayer.value || this._refVideoProvider.value)?.pause();
  }

  public async mute(): Promise<void> {
    if (this._refFrigateCardMediaPlayer.value) {
      this._refFrigateCardMediaPlayer.value?.mute();
    } else if (this._refVideoProvider.value) {
      this._refVideoProvider.value.muted = true;
    }
  }

  public async unmute(): Promise<void> {
    if (this._refFrigateCardMediaPlayer.value) {
      this._refFrigateCardMediaPlayer.value?.mute();
    } else if (this._refVideoProvider.value) {
      this._refVideoProvider.value.muted = false;
    }
  }

  public isMuted(): boolean {
    if (this._refFrigateCardMediaPlayer.value) {
      return this._refFrigateCardMediaPlayer.value?.isMuted() ?? true;
    } else if (this._refVideoProvider.value) {
      return this._refVideoProvider.value.muted;
    }
    return true;
  }

  public async seek(seconds: number): Promise<void> {
    if (this._refFrigateCardMediaPlayer.value) {
      return this._refFrigateCardMediaPlayer.value.seek(seconds);
    } else if (this._refVideoProvider.value) {
      hideMediaControlsTemporarily(this._refVideoProvider.value);
      this._refVideoProvider.value.currentTime = seconds;
    }
  }

  public async setControls(controls?: boolean): Promise<void> {
    if (this._refFrigateCardMediaPlayer.value) {
      return this._refFrigateCardMediaPlayer.value.setControls(controls);
    } else if (this._refVideoProvider.value) {
      setControlsOnVideo(
        this._refVideoProvider.value,
        controls ?? this.viewerConfig?.controls.builtin ?? true,
      );
    }
  }

  public isPaused(): boolean {
    if (this._refFrigateCardMediaPlayer.value) {
      return this._refFrigateCardMediaPlayer.value.isPaused();
    } else if (this._refVideoProvider.value) {
      return this._refVideoProvider.value.paused;
    }
    return true;
  }

  public async getScreenshotURL(): Promise<string | null> {
    if (this._refFrigateCardMediaPlayer.value) {
      return await this._refFrigateCardMediaPlayer.value.getScreenshotURL();
    } else if (this._refVideoProvider.value) {
      return screenshotMedia(this._refVideoProvider.value);
    } else if (this._refImageProvider.value) {
      return this._refImageProvider.value.src;
    }
    return null;
  }

  protected async _switchToRelatedClipView(): Promise<void> {
    const view = this.viewManagerEpoch?.manager.getView();
    if (
      !this.hass ||
      !view ||
      !this.cameraManager ||
      !this.media ||
      // If this specific media item has no clip, then do nothing (even if all
      // the other media items do).
      !ViewMediaClassifier.isEvent(this.media) ||
      !MediaQueriesClassifier.areEventQueries(view.query)
    ) {
      return;
    }

    // Convert the query to a clips equivalent.
    const clipQuery = view.query.clone();
    clipQuery.convertToClipsQueries();

    const queries = clipQuery.getQueries();
    if (!queries) {
      return;
    }

    await this.viewManagerEpoch?.manager.setViewByParametersWithExistingQuery({
      params: {
        view: 'media',
        query: clipQuery,
      },
      queryExecutorOptions: {
        selectResult: {
          id: this.media.getID() ?? undefined,
        },
        rejectResults: (results) => !results.hasSelectedResult(),
      },
    });
  }

  protected willUpdate(changedProps: PropertyValues): void {
    const mediaContentID = this.media ? this.media.getContentID() : null;

    if (
      (changedProps.has('load') ||
        changedProps.has('media') ||
        changedProps.has('viewerConfig') ||
        changedProps.has('resolvedMediaCache') ||
        changedProps.has('hass')) &&
      this.hass &&
      mediaContentID &&
      !this.resolvedMediaCache?.has(mediaContentID) &&
      (!this.viewerConfig?.lazy_load || this.load)
    ) {
      resolveMedia(this.hass, mediaContentID, this.resolvedMediaCache).then(() => {
        this.requestUpdate();
      });
    }

    if (changedProps.has('viewerConfig') && this.viewerConfig?.zoomable) {
      import('../zoomer.js');
    }

    if (changedProps.has('media') || changedProps.has('cameraManager')) {
      const cameraID = this.media?.getCameraID();
      const cameraConfig = cameraID
        ? this.cameraManager?.getStore().getCameraConfig(cameraID)
        : null;
      updateElementStyleFromMediaLayoutConfig(this, cameraConfig?.dimensions?.layout);

      this.style.aspectRatio = aspectRatioToString({
        ratio: cameraConfig?.dimensions?.aspect_ratio,
      });
    }
  }

  protected _useZoomIfRequired(template: TemplateResult): TemplateResult {
    if (!this.media) {
      return template;
    }
    const cameraID = this.media.getCameraID();
    const mediaID = this.media.getID() ?? undefined;
    const cameraConfig = this.cameraManager?.getStore().getCameraConfig(cameraID);
    const view = this.viewManagerEpoch?.manager.getView();

    return this.viewerConfig?.zoomable
      ? html` <frigate-card-zoomer
          .defaultSettings=${guard([cameraConfig?.dimensions?.layout], () =>
            cameraConfig?.dimensions?.layout
              ? {
                  pan: cameraConfig.dimensions.layout.pan,
                  zoom: cameraConfig.dimensions.layout.zoom,
                }
              : undefined,
          )}
          .settings=${mediaID ? view?.context?.zoom?.[mediaID]?.requested : undefined}
          @frigate-card:zoom:zoomed=${() => this.setControls(false)}
          @frigate-card:zoom:unzoomed=${() => this.setControls()}
          @frigate-card:zoom:change=${(ev: CustomEvent<ZoomSettingsObserved>) =>
            handleZoomSettingsObservedEvent(ev, this.viewManagerEpoch?.manager, mediaID)}
        >
          ${template}
        </frigate-card-zoomer>`
      : template;
  }

  protected render(): TemplateResult | void {
    if (!this.load || !this.media || !this.hass || !this.viewerConfig) {
      return;
    }

    const mediaContentID = this.media.getContentID();
    const resolvedMedia = mediaContentID
      ? this.resolvedMediaCache?.get(mediaContentID)
      : null;
    if (!resolvedMedia) {
      // Media will be resolved with the call in willUpdate() then this will be
      // re-rendered.
      return renderProgressIndicator({
        cardWideConfig: this.cardWideConfig,
      });
    }

    // Note: crossorigin="anonymous" is required on <video> below in order to
    // allow screenshot of motionEye videos which currently go cross-origin.
    return this._useZoomIfRequired(html`
      ${ViewMediaClassifier.isVideo(this.media)
        ? this.media.getVideoContentType() === VideoContentType.HLS
          ? html`<frigate-card-ha-hls-player
              ${ref(this._refFrigateCardMediaPlayer)}
              allow-exoplayer
              aria-label="${this.media.getTitle() ?? ''}"
              ?autoplay=${false}
              controls
              muted
              playsinline
              title="${this.media.getTitle() ?? ''}"
              url=${canonicalizeHAURL(this.hass, resolvedMedia?.url) ?? ''}
              .hass=${this.hass}
              ?controls=${this.viewerConfig.controls.builtin}
            >
            </frigate-card-ha-hls-player>`
          : html`
              <video
                ${ref(this._refVideoProvider)}
                aria-label="${this.media.getTitle() ?? ''}"
                title="${this.media.getTitle() ?? ''}"
                muted
                playsinline
                crossorigin="anonymous"
                ?autoplay=${false}
                ?controls=${this.viewerConfig.controls.builtin}
                @loadedmetadata=${(ev: Event) => {
                  if (ev.target && !!this.viewerConfig?.controls.builtin) {
                    hideMediaControlsTemporarily(
                      ev.target as HTMLVideoElement,
                      MEDIA_LOAD_CONTROLS_HIDE_SECONDS,
                    );
                  }
                }}
                @loadeddata=${(ev: Event) => {
                  dispatchMediaLoadedEvent(this, ev, {
                    player: this,
                    capabilities: {
                      supportsPause: true,
                      hasAudio: mayHaveAudio(ev.target as HTMLVideoElement),
                    },
                    technology: ['hls'],
                  });
                }}
                @volumechange=${() => dispatchMediaVolumeChangeEvent(this)}
                @play=${() => dispatchMediaPlayEvent(this)}
                @pause=${() => dispatchMediaPauseEvent(this)}
              >
                <source
                  src=${canonicalizeHAURL(this.hass, resolvedMedia?.url) ?? ''}
                  type="video/mp4"
                />
              </video>
            `
        : html`<img
            ${ref(this._refImageProvider)}
            aria-label="${this.media.getTitle() ?? ''}"
            src="${canonicalizeHAURL(this.hass, resolvedMedia?.url) ?? ''}"
            title="${this.media.getTitle() ?? ''}"
            @click=${() => {
              if (this.viewerConfig?.snapshot_click_plays_clip) {
                this._switchToRelatedClipView();
              }
            }}
            @load=${(ev: Event) => {
              dispatchMediaLoadedEvent(this, ev, { player: this, technology: ['jpg'] });
            }}
          />`}
    `);
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerProviderStyle);
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-viewer-provider': FrigateCardViewerProvider;
  }
}
