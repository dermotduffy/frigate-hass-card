import { CSSResultGroup, LitElement, TemplateResult, html, unsafeCSS } from 'lit';
import { customElement, property } from 'lit/decorators';
import { until } from 'lit/directives/until.js';
import { HomeAssistant } from 'custom-card-helpers';

import dayjs from 'dayjs';
import dayjs_custom_parse_format from 'dayjs/plugin/customParseFormat';

import { resolvedMediaSchema } from '../types';
import type {
  BrowseMediaNeighbors,
  BrowseMediaQueryParameters,
  BrowseMediaSource,
  ExtendedHomeAssistant,
  NextPreviousControlStyle,
  ResolvedMedia,
} from '../types';
import { localize } from '../localize/localize';
import {
  browseMediaQuery,
  dispatchMediaLoadEvent,
  dispatchPauseEvent,
  dispatchPlayEvent,
  getFirstTrueMediaChildIndex,
  homeAssistantWSRequest,
} from '../common';

import { View } from '../view';
import {
  renderMessage,
  renderErrorMessage,
  renderProgressIndicator,
} from '../components/message';

import './next-prev-control';

import viewerStyle from '../scss/viewer.scss';

// Load dayjs plugin(s).
dayjs.extend(dayjs_custom_parse_format);

@customElement('frigate-card-viewer')
export class FrigateCardViewer extends LitElement {
  @property({ attribute: false })
  protected hass!: HomeAssistant & ExtendedHomeAssistant;

  @property({ attribute: false })
  protected view!: View;

  @property({ attribute: false })
  protected browseMediaQueryParameters!: BrowseMediaQueryParameters;

  @property({ attribute: false })
  protected nextPreviousControlStyle!: NextPreviousControlStyle;

  @property({ attribute: false })
  protected autoplayClip!: boolean;

  protected async _resolveMedia(
    mediaSource: BrowseMediaSource | null,
  ): Promise<ResolvedMedia | null> {
    if (!mediaSource) {
      return null;
    }
    const request = {
      type: 'media_source/resolve_media',
      media_content_id: mediaSource.media_content_id,
    };
    return homeAssistantWSRequest(this.hass, resolvedMediaSchema, request);
  }

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
  protected _getMediaNeighbors(
    parent: BrowseMediaSource,
    index: number | null,
  ): BrowseMediaNeighbors | null {
    if (index == null || !parent.children) {
      return null;
    }

    // Work backwards from the index to get the previous real media.
    let prevIndex: number | null = null;
    for (let i = index - 1; i >= 0; i--) {
      const media = parent.children[i];
      if (media && !media.can_expand) {
        prevIndex = i;
        break;
      }
    }

    // Work forwards from the index to get the next real media.
    let nextIndex: number | null = null;
    for (let i = index + 1; i < parent.children.length; i++) {
      const media = parent.children[i];
      if (media && !media.can_expand) {
        nextIndex = i;
        break;
      }
    }

    return {
      previousIndex: prevIndex,
      previous: prevIndex != null ? parent.children[prevIndex] : null,
      nextIndex: nextIndex,
      next: nextIndex != null ? parent.children[nextIndex] : null,
    };
  }

  // Get a clip at the same time as a snapshot.
  protected async _findRelatedClips(
    snapshot: BrowseMediaSource | null,
  ): Promise<BrowseMediaSource | null> {
    if (!snapshot) {
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
      } catch (e: any) {
        // Pass. This is best effort.
      }
    }
    return null;
  }

  protected render(): TemplateResult | void {
    return html`${until(this._render(), renderProgressIndicator())}`;
  }

  protected async _render(): Promise<TemplateResult> {
    let autoplay = true;

    let parent: BrowseMediaSource | null = null;
    let childIndex: number | null = null;
    let mediaToRender: BrowseMediaSource | null = null;

    if (this.view.target) {
      parent = this.view.target;
      childIndex = this.view.childIndex ?? null;
      mediaToRender = this.view.media ?? null;
    } else {
      try {
        parent = await browseMediaQuery(this.hass, this.browseMediaQueryParameters);
      } catch (e) {
        return renderErrorMessage((e as Error).message);
      }
      childIndex = getFirstTrueMediaChildIndex(parent);
      if (!parent || !parent.children || childIndex == null) {
        return renderMessage(
          this.view.is('clip')
            ? localize('common.no_clip')
            : localize('common.no_snapshot'),
          this.view.is('clip') ? 'mdi:filmstrip-off' : 'mdi:camera-off',
        );
      }
      mediaToRender = parent.children[childIndex];

      // In this block, no clip has been manually selected, so this is loading
      // the most recent clip on card load. In this mode, autoplay of the clip
      // may be disabled by configuration. If does not make sense to disable
      // autoplay when the user has explicitly picked an event to play in the
      // gallery.
      autoplay = this.autoplayClip;
    }
    const resolvedMedia = await this._resolveMedia(mediaToRender);
    if (!mediaToRender || !resolvedMedia) {
      // Home Assistant could not resolve media item.
      return renderErrorMessage(localize('error.could_not_resolve'));
    }

    const neighbors = this._getMediaNeighbors(parent, childIndex);

    return html` <div>
      ${neighbors?.previousIndex != null
        ? html`<frigate-card-next-previous-control
            .control=${'previous'}
            .controlStyle=${this.nextPreviousControlStyle}
            .parent=${parent}
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
              ?autoplay="${autoplay}"
            >
            </frigate-card-ha-hls-player>`
          : html`<video
              title="${mediaToRender.title}"
              muted
              controls
              playsinline
              ?autoplay="${autoplay}"
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
            .parent=${parent}
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
