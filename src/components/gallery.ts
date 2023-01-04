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
  getFullDependentBrowseMediaQueryParametersOrDispatchError,
} from '../utils/ha/browse-media';
import { changeViewToRecentEventsForCameraAndDependents, changeViewToRecentRecordingForCameraAndDependents } from '../utils/media-to-view.js';
import { CameraManager } from '../camera/manager.js';
import { View } from '../view/view.js';
import { renderProgressIndicator } from './message.js';
import './thumbnail.js';
import { THUMBNAIL_DETAILS_WIDTH_MIN } from './thumbnail.js';

interface GalleryViewContext {
  // Keep track of the previous view to allow returning to a higher-level folder.
  previous?: View;
}

declare module 'view' {
  interface ViewContext {
    gallery?: GalleryViewContext;
  }
}

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
    // const mediaType = this.view?.getMediaType();
    // if (
    //   !this.hass ||
    //   !this.view ||
    //   !this.cameras ||
    //   !this.view.isGalleryView() ||
    //   !mediaType ||
    //   !this.cameraManager
    // ) {
    //   return;
    // }

    // if (!this.view.query) {
    //   if (mediaType === 'recordings') {
    //     changeViewToRecentRecordingForCameraAndDependents(
    //       this,
    //       this.hass,
    //       this.cameraManager,
    //       this.cameras,
    //       this.view,
    //       {
    //         targetView: 'recordings',
    //       },
    //     );
    //   } else {
    //     changeViewToRecentEventsForCameraAndDependents(
    //       this,
    //       this.hass,
    //       this.cameraManager,
    //       this.cameras,
    //       this.view,
    //       {
    //         targetView: mediaType,
    //       },
    //     );
    //   }
    //   return renderProgressIndicator({ cardWideConfig: this.cardWideConfig });
    // }

    // return html`
    //   <frigate-card-gallery-core
    //     .hass=${this.hass}
    //     .view=${this.view}
    //     .galleryConfig=${this.galleryConfig}
    //     .cameras=${this.cameras}
    //   >
    //   </frigate-card-gallery-core>
    // `;
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

// @customElement('frigate-card-gallery-core')
// export class FrigateCardGalleryCore extends LitElement {
//   @property({ attribute: false })
//   public hass?: ExtendedHomeAssistant;

//   @property({ attribute: false })
//   public view?: Readonly<View>;

//   @property({ attribute: false })
//   public galleryConfig?: GalleryConfig;

//   @property({ attribute: false })
//   public cameras?: Map<string, CameraConfig>;

//   protected _resizeObserver: ResizeObserver;

//   constructor() {
//     super();
//     this._resizeObserver = new ResizeObserver(this._resizeHandler.bind(this));
//   }

//   /**
//    * Component connected callback.
//    */
//   connectedCallback(): void {
//     super.connectedCallback();
//     this._resizeObserver.observe(this);
//   }

//   /**
//    * Component disconnected callback.
//    */
//   disconnectedCallback(): void {
//     this._resizeObserver.disconnect();
//     super.disconnectedCallback();
//   }

//   /**
//    * Set gallery columns.
//    */
//   protected _setColumnCount(): void {
//     const thumbnailSize =
//       this.galleryConfig?.controls.thumbnails.size ??
//       frigateCardConfigDefaults.event_gallery.controls.thumbnails.size;
//     const columns = this.galleryConfig?.controls.thumbnails.show_details
//       ? Math.max(1, Math.floor(this.clientWidth / THUMBNAIL_DETAILS_WIDTH_MIN))
//       : Math.max(
//           1,
//           Math.ceil(this.clientWidth / THUMBNAIL_WIDTH_MAX),
//           Math.ceil(this.clientWidth / thumbnailSize),
//         );

//     this.style.setProperty('--frigate-card-gallery-columns', String(columns));
//   }

//   /**
//    * Handle gallery resize.
//    */
//   protected _resizeHandler(): void {
//     this._setColumnCount();
//   }

//   /**
//    * Determine whether the back arrow should be displayed.
//    * @returns `true` if the back arrow should be displayed, `false` otherwise.
//    */
//   protected _shouldShowBackArrow(): boolean {
//     return (
//       !!this.view?.context?.gallery?.previous &&
//       !!this.view.context.gallery.previous.query &&
//       this.view.context.gallery.previous.view === this.view.view
//     );
//   }

//   /**
//    * Called when an update will occur.
//    * @param changedProps The changed properties
//    */
//   protected willUpdate(changedProps: PropertyValues): void {
//     if (changedProps.has('galleryConfig')) {
//       if (this.galleryConfig?.controls.thumbnails.show_details) {
//         this.setAttribute('details', '');
//       } else {
//         this.removeAttribute('details');
//       }
//       this._setColumnCount();
//       if (this.galleryConfig?.controls.thumbnails.size) {
//         this.style.setProperty(
//           '--frigate-card-thumbnail-size',
//           `${this.galleryConfig.controls.thumbnails.size}px`,
//         );
//       }
//     }
//   }

//   // TODO: This is still going to show the gallery view (akin to HA media
//   // browser). 

//   /**
//    * Master render method.
//    * @returns A rendered template.
//    */
//   protected render(): TemplateResult | void {
//     const results = this.view?.queryResults?.getResults();

//     if (
//       !results ||
//       !this.hass ||
//       !this.view ||
//       !this.view.isGalleryView() ||
//       !this.cameras
//     ) {
//       return html``;
//     }

//     return html`
//       ${this._shouldShowBackArrow()
//         ? html` <ha-card
//             @click=${(ev) => {
//               if (this.view && this.view.context?.gallery?.previous) {
//                 this.view.context.gallery.previous.dispatchChangeEvent(this);
//               }
//               stopEventFromActivatingCardWideActions(ev);
//             }}
//             outlined=""
//           >
//             <ha-icon .icon=${'mdi:arrow-left'}></ha-icon>
//           </ha-card>`
//         : ''}
//       ${results.map((child, index) =>
//           html`
//             ${child.can_expand
//               ? html`
//                   <ha-card
//                     @click=${(ev) => {
//                       if (this.hass && this.view) {
//                         fetchChildMediaAndDispatchViewChange(
//                           this,
//                           this.hass,
//                           this.view,
//                           child,
//                           {
//                             gallery: {
//                               previous: this.view,
//                             },
//                           },
//                         );
//                       }
//                       stopEventFromActivatingCardWideActions(ev);
//                     }}
//                     outlined=""
//                   >
//                     <div>${child.title}</div>
//                   </ha-card>
//                 `
//               : html`<frigate-card-thumbnail
//                   .view=${this.view}
//                   .target=${this.view?.target ?? null}
//                   .childIndex=${index}
//                   .hass=${this.hass}
//                   .cameraConfig=${child.frigate?.cameraID
//                     ? this.cameras?.get(child.frigate.cameraID)
//                     : undefined}
//                   ?details=${!!this.galleryConfig?.controls.thumbnails.show_details}
//                   ?show_favorite_control=${!!this.galleryConfig?.controls.thumbnails
//                     .show_favorite_control}
//                   ?show_timeline_control=${!!this.galleryConfig?.controls.thumbnails
//                     .show_timeline_control}
//                   @click=${(ev: Event) => {
//                     if (this.view) {
//                       const targetView = this.view.getViewerViewForGalleryView();
//                       if (targetView) {
//                         this.view
//                           .evolve({
//                             view: targetView,
//                             childIndex: index,
//                           })
//                           .dispatchChangeEvent(this);
//                       }
//                     }
//                     stopEventFromActivatingCardWideActions(ev);
//                   }}
//                 >
//                 </frigate-card-thumbnail>`}
//           `,
//       )}
//     `;
//   }

//   /**
//    * Get styles.
//    */
//   static get styles(): CSSResultGroup {
//     return unsafeCSS(galleryStyle);
//   }
// }

declare global {
  interface HTMLElementTagNameMap {
    //'frigate-card-gallery-core': FrigateCardGalleryCore;
    'frigate-card-gallery': FrigateCardGallery;
  }
}
