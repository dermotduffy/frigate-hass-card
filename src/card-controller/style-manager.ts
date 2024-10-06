import { StyleInfo } from 'lit/directives/style-map';
import { FrigateCardConfig } from '../config/types';
import irisLogo from '../images/camera-iris.svg';
import { aspectRatioToStyle, setOrRemoveAttribute } from '../utils/basic';
import { View } from '../view/view';
import { CardStyleAPI } from './types';

export class StyleManager {
  protected _api: CardStyleAPI;

  constructor(api: CardStyleAPI) {
    this._api = api;
  }

  public initialize(): void {
    this._setCommonStyleProperties();
  }

  public setLightOrDarkMode = (): void => {
    const config = this._api.getConfigManager().getConfig();
    const isDarkMode =
      config?.view.dark_mode === 'on' ||
      (config?.view.dark_mode === 'auto' &&
        (!this._api.getInteractionManager().hasInteraction() ||
          !!this._api.getHASSManager().getHASS()?.themes.darkMode));

    setOrRemoveAttribute(
      this._api.getCardElementManager().getElement(),
      isDarkMode,
      'dark',
    );
  };

  public setExpandedMode(): void {
    const card = this._api.getCardElementManager().getElement();
    const view = this._api.getViewManager().getView();

    // When a new media loads, set the aspect ratio for when the card is
    // expanded/popped-up. This is based exclusively on last media content,
    // as dimension configuration does not apply in fullscreen or expanded mode.
    const lastKnown = this._api.getMediaLoadedInfoManager().getLastKnown();
    card.style.setProperty(
      '--frigate-card-expand-aspect-ratio',
      view?.isAnyMediaView() && lastKnown
        ? `${lastKnown.width} / ${lastKnown.height}`
        : 'unset',
    );
    // Non-media may have no intrinsic dimensions (or multiple media items in a
    // grid) and so we need to explicit request the dialog to use all available
    // space.
    const isGrid = view?.isGrid();
    card.style.setProperty(
      '--frigate-card-expand-width',
      !isGrid && view?.isAnyMediaView()
        ? 'none'
        : 'var(--frigate-card-expand-max-width)',
    );
    card.style.setProperty(
      '--frigate-card-expand-height',
      !isGrid && view?.isAnyMediaView()
        ? 'none'
        : 'var(--frigate-card-expand-max-height)',
    );
  }

  public setMinMaxHeight(): void {
    const config = this._api.getConfigManager().getConfig();
    if (config) {
      const card = this._api.getCardElementManager().getElement();
      card.style.setProperty('--frigate-card-height', config.dimensions.height);
    }
  }

  public setPerformance(): void {
    const STYLE_DISABLE_MAP = {
      box_shadow: 'none',
      border_radius: '0px',
    };
    const element = this._api.getCardElementManager().getElement();
    const performance = this._api.getConfigManager().getCardWideConfig()?.performance;

    const styles = performance?.style ?? {};
    for (const configKey of Object.keys(styles)) {
      const CSSKey = `--frigate-card-css-${configKey.replaceAll('_', '-')}`;
      if (styles[configKey] === false) {
        element.style.setProperty(CSSKey, STYLE_DISABLE_MAP[configKey]);
      } else {
        element.style.removeProperty(CSSKey);
      }
    }
  }

  protected _isAspectRatioEnforced(
    config: FrigateCardConfig,
    view?: View | null,
  ): boolean {
    const aspectRatioMode = config.dimensions.aspect_ratio_mode;

    // Do not artifically constrain aspect ratio if:
    // - It's fullscreen.
    // - It's in expanded mode.
    // - Aspect ratio enforcement is disabled.
    // - Aspect ratio enforcement is dynamic and it's a media view (i.e. not the
    //   gallery) or diagnostics / timeline.
    return !(
      this._api.getFullscreenManager().isInFullscreen() ||
      this._api.getExpandManager().isExpanded() ||
      aspectRatioMode === 'unconstrained' ||
      (aspectRatioMode === 'dynamic' &&
        (!view ||
          view?.isAnyMediaView() ||
          view?.is('timeline') ||
          view?.is('diagnostics')))
    );
  }

  /**
   * Get the aspect ratio padding required to enforce the aspect ratio (if it is
   * required).
   * @returns A padding percentage.
   */
  public getAspectRatioStyle(): StyleInfo {
    const config = this._api.getConfigManager().getConfig();
    const view = this._api.getViewManager().getView();

    if (config) {
      if (!this._isAspectRatioEnforced(config, view)) {
        return aspectRatioToStyle();
      }

      const aspectRatioMode = config.dimensions.aspect_ratio_mode;

      const lastKnown = this._api.getMediaLoadedInfoManager().getLastKnown();
      if (lastKnown && aspectRatioMode === 'dynamic') {
        return aspectRatioToStyle({ ratio: [lastKnown.width, lastKnown.height] });
      }
      return aspectRatioToStyle({ ratio: config.dimensions.aspect_ratio });
    }
    return aspectRatioToStyle({ defaultStatic: true });
  }

  protected _setCommonStyleProperties(): void {
    this._api
      .getCardElementManager()
      .getElement()
      .style.setProperty('--frigate-card-media-background-image', `url("${irisLogo}")`);
  }
}
