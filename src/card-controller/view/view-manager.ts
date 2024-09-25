import { ViewContext } from 'view';
import { FrigateCardView } from '../../config/types';
import { log } from '../../utils/debug';
import { getStreamCameraID } from '../../utils/substream';
import { View } from '../../view/view';
import { getCameraIDsForViewName } from '../../view/view-to-cameras';
import { CardViewAPI } from '../types';
import { ViewFactory } from './factory';
import { ViewFactoryOptions, ViewManagerEpoch, ViewManagerInterface } from './types';

export class ViewManager implements ViewManagerInterface {
  protected _view: View | null = null;
  protected _factory: ViewFactory;
  protected _api: CardViewAPI;
  protected _epoch: ViewManagerEpoch = this._createEpoch();

  constructor(api: CardViewAPI, factory?: ViewFactory) {
    this._api = api;
    this._factory = factory ?? new ViewFactory(api);
  }

  public getEpoch(): ViewManagerEpoch {
    return this._epoch;
  }
  protected _createEpoch(oldView?: View | null): ViewManagerEpoch {
    return {
      manager: this,
      ...(oldView && { oldView }),
    };
  }

  public getView(): View | null {
    return this._view;
  }
  public hasView(): boolean {
    return !!this.getView();
  }
  public reset(): void {
    if (this._view) {
      this._setView(null);
    }
  }

  setViewDefault = (options?: ViewFactoryOptions): void =>
    this._setViewGeneric(this._factory.getViewDefault.bind(this._factory), options);

  setViewByParameters = (options?: ViewFactoryOptions): void =>
    this._setViewGeneric(this._factory.getViewByParameters.bind(this._factory), options);

  setViewDefaultWithNewQuery = async (options?: ViewFactoryOptions): Promise<void> =>
    await this._setViewGenericAsync(
      this._factory.getViewDefaultWithNewQuery.bind(this._factory),
      options,
    );

  setViewByParametersWithNewQuery = async (
    options?: ViewFactoryOptions,
  ): Promise<void> =>
    await this._setViewGenericAsync(
      this._factory.getViewByParametersWithNewQuery.bind(this._factory),
      options,
    );

  setViewByParametersWithExistingQuery = async (
    options?: ViewFactoryOptions,
  ): Promise<void> =>
    await this._setViewGenericAsync(
      this._factory.getViewByParametersWithExistingQuery.bind(this._factory),
      options,
    );

  protected _setViewGeneric(
    factoryFunc: (options?: ViewFactoryOptions) => View | null,
    options?: ViewFactoryOptions,
  ): void {
    let view: View | null = null;
    try {
      view = factoryFunc({
        baseView: this._view,
        ...options,
      });
    } catch (e) {
      return this._api.getMessageManager().setErrorIfHigherPriority(e);
    }
    view && this._setView(view);
  }

  protected async _setViewGenericAsync(
    factoryFunc: (options?: ViewFactoryOptions) => Promise<View | null>,
    options?: ViewFactoryOptions,
  ): Promise<void> {
    let view: View | null = null;
    try {
      view = await factoryFunc({
        baseView: this._view,
        ...options,
      });
    } catch (e) {
      return this._api.getMessageManager().setErrorIfHigherPriority(e);
    }
    view && this._setView(view);
  }

  public setViewWithMergedContext(context: ViewContext | null): void {
    if (this._view) {
      return this._setView(this._view?.clone().mergeInContext(context));
    }
  }

  public isViewSupportedByCamera(cameraID: string, view: FrigateCardView): boolean {
    return !!getCameraIDsForViewName(this._api.getCameraManager(), view, cameraID).size;
  }

  /**
   * Detect if the current view has a major "media change" for the given previous view.
   * @param oldView The previous view.
   * @returns True if the view change is a real media change.
   */
  public hasMajorMediaChange(oldView?: View | null): boolean {
    return (
      !!oldView !== !!this._view ||
      oldView?.view !== this._view?.view ||
      oldView?.camera !== this._view?.camera ||
      // When in live mode, take overrides (substreams) into account in deciding
      // if this is a major media change.
      (this._view?.view === 'live' &&
        oldView &&
        getStreamCameraID(oldView) !== getStreamCameraID(this._view)) ||
      // When in the live view, the queryResults contain the events that
      // happened in the past -- not reflective of the actual live media viewer
      // the user is seeing.
      (this._view?.view !== 'live' && oldView?.queryResults !== this._view?.queryResults)
    );
  }

  public initialize = async (): Promise<boolean> => {
    // If the query string contains a view related action, we don't set any view
    // here and allow that action to be triggered by the next call of to execute
    // query actions (called at least once per render cycle).
    // Related: https://github.com/dermotduffy/frigate-hass-card/issues/1200
    if (!this._api.getQueryStringManager().hasViewRelatedActionsToRun()) {
      await this.setViewDefaultWithNewQuery({ failSafe: true });
    }
    return true;
  };

  protected _setView(view: View | null): void {
    const oldView = this._view;

    log(
      this._api.getConfigManager().getCardWideConfig(),
      `Frigate Card view change: `,
      view,
    );

    this._view = view;
    this._epoch = this._createEpoch(oldView);

    if (this.hasMajorMediaChange(oldView)) {
      this._api.getMediaLoadedInfoManager().clear();
    }

    if (oldView?.view !== view?.view) {
      this._api.getCardElementManager().scrollReset();
    }

    this._api.getMessageManager().reset();
    this._api.getStyleManager().setExpandedMode();

    this._api.getConditionsManager()?.setState({
      view: view?.view,
      camera: view?.camera,
      displayMode: view?.displayMode ?? undefined,
    });

    this._api.getCardElementManager().update();
  }
}
