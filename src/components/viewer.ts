import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators.js';
import { until } from 'lit/directives/until.js';
import { HomeAssistant } from 'custom-card-helpers';

import dayjs from 'dayjs';
import dayjs_custom_parse_format from 'dayjs/plugin/customParseFormat.js';

import type {
  BrowseMediaNeighbors,
  BrowseMediaQueryParameters,
  BrowseMediaSource,
  ExtendedHomeAssistant,
  NextPreviousControlStyle,
} from '../types.js';
import { localize } from '../localize/localize.js';
import {
  browseMediaQuery,
  dispatchErrorMessageEvent,
  dispatchMediaLoadEvent,
  dispatchMessageEvent,
  dispatchPauseEvent,
  dispatchPlayEvent,
  getFirstTrueMediaChildIndex,
} from '../common.js';

import { View } from '../view.js';
import {
  renderProgressIndicator,
} from '../components/message.js';

import './next-prev-control.js';

import viewerStyle from '../scss/viewer.scss';
import { ResolvedMediaCache, ResolvedMediaUtil } from '../resolved-media.js';

// Load dayjs plugin(s).
dayjs.extend(dayjs_custom_parse_format);

@customElement('frigate-card-viewer')
export class FrigateCardViewer extends LitElement {
  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view?: View;

  @property({ attribute: false })
  protected browseMediaQueryParameters?: BrowseMediaQueryParameters;

  @property({ attribute: false })
  protected nextPreviousControlStyle?: NextPreviousControlStyle;

  @property({ attribute: false })
  protected autoplayClip?: boolean;

  @property({ attribute: false })
  protected resolvedMediaCache?: ResolvedMediaCache;

  protected render(): TemplateResult | void {
    return html`${until(this._render(), renderProgressIndicator())}`;
  }

  protected async _render(): Promise<TemplateResult | void> {
    if (!this.hass || !this.view || !this.browseMediaQueryParameters) {
      return html``;
    }

    let autoplay = true;
    let view = this.view;

    if (!view.target) {
      let parent: BrowseMediaSource | null = null;
      try {
        parent = await browseMediaQuery(this.hass, this.browseMediaQueryParameters);
      } catch (e) {
        return dispatchErrorMessageEvent(this, (e as Error).message);
      }
      const childIndex = getFirstTrueMediaChildIndex(parent);
      if (!parent || !parent.children || childIndex == null) {
        return dispatchMessageEvent(
          this,
          this.view.is('clip')
            ? localize('common.no_clip')
            : localize('common.no_snapshot'),
          this.view.is('clip') ? 'mdi:filmstrip-off' : 'mdi:camera-off',
        );
      }
      view = new View({
        view: this.view.view,
        target: parent,
        childIndex: childIndex,
      })

      // In this block, no clip has been manually selected, so this is loading
      // the most recent clip on card load. In this mode, autoplay of the clip
      // may be disabled by configuration. If does not make sense to disable
      // autoplay when the user has explicitly picked an event to play in the
      // gallery.
      autoplay = this.autoplayClip ?? true;
    }

    const resolvedMedia = await ResolvedMediaUtil.resolveMedia(
      this.hass, view.media, this.resolvedMediaCache);
    if (!resolvedMedia) {
      // Home Assistant could not resolve media item.
      return dispatchErrorMessageEvent(this, localize('error.could_not_resolve'));
    }

    return html`
      <frigate-card-viewer-core
        .view=${view}
        .nextPreviousControlStyle=${this.nextPreviousControlStyle}
        .resolvedMediaCache=${this.resolvedMediaCache}
        .autoplayClip=${autoplay}
        .hass=${this.hass}
        .browseMediaQueryParameters=${this.browseMediaQueryParameters}
      >
      </frigate-card-viewer-core>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerStyle);
  }
}


@customElement('frigate-card-viewer-core')
export class FrigateCardViewerCore extends LitElement {
  @property({ attribute: false })
  protected view?: View;

  @property({ attribute: false })
  protected nextPreviousControlStyle?: NextPreviousControlStyle;

  @property({ attribute: false })
  protected resolvedMediaCache?: ResolvedMediaCache;

  @property({ attribute: false })
  protected autoplayClip?: boolean;

  @property({ attribute: false })
  protected hass?: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected browseMediaQueryParameters?: BrowseMediaQueryParameters;

  protected _extractEventStartTimeFromBrowseMedia(
    browseMedia: BrowseMediaSource,
  ): number | null {
    // Example: 2021-08-27 20:57:22 [10s, Person 76%]
    const result = browseMedia.title.match(/^(?<iso_datetime>.+) \[/);
    if (result && result.groups) {
      const iso_datetime_str = result.groups['iso_datetime'];
      if (iso_datetime_str) {
        const iso_datetime = dayjs(iso_datetime_str, 'YYYY-MM-DD HH:mm:ss', true);
        if (iso_datetime.isValid()) {
          return iso_datetime.unix();
        }
      }
    }
    return null;
  }

  // Get the previous and next real media items, given the index
  protected _getMediaNeighbors() : BrowseMediaNeighbors | null {
    if (!this.view ||
        !this.view.target ||
        !this.view.target.children ||
        this.view.childIndex === undefined) {
      return null;
    }

    // Work backwards from the index to get the previous real media.
    let prevIndex: number | null = null;
    for (let i = this.view.childIndex - 1; i >= 0; i--) {
      const media = this.view.target.children[i];
      if (media && !media.can_expand) {
        prevIndex = i;
        break;
      }
    }

    // Work forwards from the index to get the next real media.
    let nextIndex: number | null = null;
    for (let i = this.view.childIndex + 1; i < this.view.target.children.length; i++) {
      const media = this.view.target.children[i];
      if (media && !media.can_expand) {
        nextIndex = i;
        break;
      }
    }

    return {
      previousIndex: prevIndex,
      previous: prevIndex != null ? this.view.target.children[prevIndex] : null,
      nextIndex: nextIndex,
      next: nextIndex != null ? this.view.target.children[nextIndex] : null,
    };
  }

  // Get a clip at the same time as a snapshot.
  protected async _findRelatedClips(
    snapshot: BrowseMediaSource | null,
  ): Promise<BrowseMediaSource | null> {
    if (!snapshot || !this.hass || !this.browseMediaQueryParameters) {
      return null;
    }

    const startTime = this._extractEventStartTimeFromBrowseMedia(snapshot);
    if (startTime) {
      try {
        // Fetch clips within the same second (same camera/zone/label, etc).
        const clipsAtSameTime = await browseMediaQuery(this.hass, {
          ...this.browseMediaQueryParameters,
          mediaType: 'clips',
          before: startTime + 1,
          after: startTime,
        });
        if (clipsAtSameTime) {
          const index = getFirstTrueMediaChildIndex(clipsAtSameTime);
          if (index != null && clipsAtSameTime.children?.length) {
            return clipsAtSameTime.children[index];
          }
        }
      } catch (e) {
        // Pass. This is best effort.
      }
    }
    return null;
  }

  protected render(): TemplateResult | void {
    if (!this.view || !this.resolvedMediaCache) {
      return html``;
    }

    const mediaToRender = this.view.media;
    const resolvedMedia = mediaToRender ? this.resolvedMediaCache.get(
      mediaToRender.media_content_id) : undefined;
    if (!mediaToRender || !resolvedMedia) {
      return html``;
    }

    const neighbors = this._getMediaNeighbors();
    return html` <div>
      ${neighbors?.previousIndex != null
        ? html`<frigate-card-next-previous-control
            .control=${'previous'}
            .controlStyle=${this.nextPreviousControlStyle}
            .parent=${this.view.target}
            .childIndex=${neighbors.previousIndex}
            .view=${this.view}
          ></frigate-card-next-previous-control>`
        : ``}
      ${this.view.is('clip')
        ? resolvedMedia?.mime_type.toLowerCase() == 'application/x-mpegurl'
          ? html`<frigate-card-ha-hls-player
              .hass=${this.hass}
              .url=${resolvedMedia.url}
              title="${mediaToRender.title}"
              muted
              controls
              playsinline
              allow-exoplayer
              ?autoplay="${this.autoplayClip}"
            >
            </frigate-card-ha-hls-player>`
          : html`<video
              title="${mediaToRender.title}"
              muted
              controls
              playsinline
              ?autoplay="${this.autoplayClip}"
              @loadedmetadata=${(e) => dispatchMediaLoadEvent(this, e)}a
              @play=${() => dispatchPlayEvent(this)}
              @pause=${() => dispatchPauseEvent(this)}
            >
              <source src="${resolvedMedia.url}" type="${resolvedMedia.mime_type}" />
            </video>`
        : html`<img
            src=${resolvedMedia.url}
            title="${mediaToRender.title}"
            @click=${() => {
              // Get clips potentially related to this snapshot.
              this._findRelatedClips(mediaToRender).then((relatedClip) => {
                if (relatedClip) {
                  new View({
                    view: 'clip',
                    target: relatedClip,
                  }).dispatchChangeEvent(this);
                }
              });
            }}
            @load=${(e) => {
              dispatchMediaLoadEvent(this, e);
            }}
          />`}
      ${neighbors?.nextIndex != null
        ? html`<frigate-card-next-previous-control
            .control=${'next'}
            .controlStyle=${this.nextPreviousControlStyle}
            .parent=${this.view.target}
            .childIndex=${neighbors.nextIndex}
            .view=${this.view}
          ></frigate-card-next-previous-control>`
        : ``}
    </div>`;
  }

  static get styles(): CSSResultGroup {
    return unsafeCSS(viewerStyle);
  }
}
