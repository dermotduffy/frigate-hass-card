import { ViewContext } from 'view';
import { FrigateCardConfig, FrigateCardView, ViewDisplayMode } from '../config/types';
import { View } from '../view/view';
import { log } from '../utils/debug';
import { executeMediaQueryForView } from '../utils/media-to-view';
import { CardViewAPI } from './types';

interface ViewManagerSetViewDefaultParameters {
  cameraID?: string;
  substream?: string;
}

export interface ViewManagerSetViewParameters
  extends ViewManagerSetViewDefaultParameters {
  viewName?: FrigateCardView;
}

export class ViewManager {
  protected _view: View | null = null;
  protected _api: CardViewAPI;

  constructor(api: CardViewAPI) {
    this._api = api;
  }

  public getView(): View | null {
    return this._view;
  }

  public hasView(): boolean {
    return !!this.getView();
  }

  public setView(view: View): void {
    this._setView(view);
  }

  public setViewDefault(params?: ViewManagerSetViewDefaultParameters): void {
    const config = this._api.getConfigManager().getConfig();
    if (config) {
      let forceCameraID: string | null = params?.cameraID ?? null;
      if (!forceCameraID && this._view?.camera && config.view.update_cycle_camera) {
        const cameraIDs = [
          ...this._api.getCameraManager().getStore().getVisibleCameraIDs(),
        ];
        const currentIndex = cameraIDs.indexOf(this._view.camera);
        const targetIndex = currentIndex + 1 >= cameraIDs.length ? 0 : currentIndex + 1;
        forceCameraID = cameraIDs[targetIndex];
      }

      this.setViewByParameters({
        ...params,
        viewName: config.view.default,
        ...(forceCameraID && { cameraID: forceCameraID }),
      });

      // Restart the refresh timer, so the default view is refreshed at a fixed
      // interval from now (if so configured).
      this._api.getAutoUpdateManager().startDefaultViewTimer();
    }
  }

  public setViewByParameters(params: ViewManagerSetViewParameters): void {
    const config = this._api.getConfigManager().getConfig();

    if (config) {
      let cameraID: string | null = null;

      const cameras = this._api.getCameraManager().getStore().getVisibleCameraIDs();
      if (cameras.size) {
        if (params?.cameraID && cameras.has(params.cameraID)) {
          cameraID = params.cameraID;
        } else {
          // Reset to the default camera.
          cameraID = cameras.keys().next().value;
        }
      }
      const viewName = params?.viewName ?? this._view?.view ?? config.view.default;
      if (cameraID && viewName && this.isViewSupportedByCamera(cameraID, viewName)) {
        const displayMode =
          this._view?.displayMode ??
          this._getDefaultDisplayModeForView(viewName, config);
        let view: View = new View({
          view: viewName,
          camera: cameraID,
          displayMode: displayMode,
        });
        if (params.substream) {
          view = this._createViewWithSelectedSubstream(view, params.substream);
        }
        this._setView(view);
      }
    }
  }

  public setViewWithNewContext(context: ViewContext): void {
    if (this._view) {
      return this._setView(this._view?.clone().mergeInContext(context));
    }
  }

  public reset(): void {
    this._view = null;
  }

  public async setViewWithNewDisplayMode(displayMode: ViewDisplayMode): Promise<void> {
    const hass = this._api.getHASSManager().getHASS();

    if (this._view && hass) {
      const view = this._view.evolve({
        displayMode: displayMode,
      });

      const cameraCount = this._api
        .getCameraManager()
        .getStore()
        .getVisibleCameraCount();
      const queryCameraCount = view.query?.getQueryCameraIDs()?.size ?? 0;
      const generateNewQuery =
        view?.query &&
        queryCameraCount &&
        ((view.isGrid() && queryCameraCount < cameraCount) ||
          (!view.isGrid() && queryCameraCount > 1));

      if (generateNewQuery && view && view.query) {
        // If the user requests a grid but the current query does not have a
        // query for more than one camera, reset the query results, change the
        // existing query to refer to all cameras and execute it to fetch new
        // results.
        let viewWithNewQuery: View | null = null;
        try {
          viewWithNewQuery = await executeMediaQueryForView(
            this._api.getCameraManager(),
            view,
            view.query
              .clone()
              .setQueryCameraIDs(
                view.isGrid()
                  ? this._api.getCameraManager().getStore().getVisibleCameraIDs()
                  : view.camera,
              ),
          );
        } catch (e: unknown) {
          this._api.getMessageManager().setErrorIfHigherPriority(e);
        }

        if (viewWithNewQuery) {
          return this._setView(viewWithNewQuery);
        }
      } else {
        return this._setView(view);
      }
    }
  }

  public setViewWithSubstream(substream?: string): void {
    if (!this._view) {
      return;
    }
    this._setView(
      substream
        ? this._createViewWithSelectedSubstream(this._view, substream)
        : this._createViewWithNextStream(this._view),
    );
  }

  public setViewWithoutSubstream(): void {
    const view = this._createViewWithoutSubstream();
    if (view) {
      return this._setView(view);
    }
  }

  public isViewSupportedByCamera(cameraID: string, view: FrigateCardView): boolean {
    const capabilities = this._api.getCameraManager().getCameraCapabilities(cameraID);
    switch (view) {
      case 'live':
      case 'image':
      case 'diagnostics':
        return true;
      case 'clip':
      case 'clips':
        return !!capabilities?.supportsClips;
      case 'snapshot':
      case 'snapshots':
        return !!capabilities?.supportsSnapshots;
      case 'recording':
      case 'recordings':
        return !!capabilities?.supportsRecordings;
      case 'timeline':
        return !!capabilities?.supportsTimeline;
      case 'media':
        return (
          !!capabilities?.supportsClips ||
          !!capabilities?.supportsSnapshots ||
          !!capabilities?.supportsRecordings
        );
    }
  }

  protected _getDefaultDisplayModeForView(
    viewName: FrigateCardView,
    config?: FrigateCardConfig,
  ): ViewDisplayMode {
    let mode: ViewDisplayMode | null = null;
    switch (viewName) {
      case 'media':
      case 'clip':
      case 'recording':
      case 'snapshot':
        mode = config?.media_viewer.display?.mode ?? null;
        break;
      case 'live':
        mode = config?.live.display?.mode ?? null;
        break;
    }
    return mode ?? 'single';
  }

  protected _setView(view: View): void {
    const oldView = this._view;
    View.adoptFromViewIfAppropriate(view, oldView);

    log(
      this._api.getConfigManager().getCardWideConfig(),
      `Frigate Card view change: `,
      view,
    );
    this._view = view;

    if (View.isMajorMediaChange(oldView, view)) {
      this._api.getMediaLoadedInfoManager().clear();
    }

    if (oldView?.view !== view.view) {
      this._api.getCardElementManager().scrollReset();
    }

    this._api.getMessageManager().reset();
    this._api.getStyleManager().setExpandedMode();

    this._api.getConditionsManager()?.setState({
      view: view.view,
      camera: view.camera,
      displayMode: view.displayMode ?? undefined,
    });
    this._api.getCardElementManager().update();
  }

  protected _createViewWithSelectedSubstream(baseView: View, substreamID: string): View {
    const overrides: Map<string, string> =
      baseView?.context?.live?.overrides ?? new Map();
    overrides.set(baseView.camera, substreamID);
    return baseView.clone().mergeInContext({
      live: { overrides: overrides },
    });
  }

  protected _createViewWithNextStream(baseView: View): View {
    const dependencies = [
      ...this._api.getCameraManager().getStore().getAllDependentCameras(baseView.camera),
    ];
    if (dependencies.length <= 1) {
      return baseView.clone();
    }

    const view = baseView.clone();
    const overrides: Map<string, string> = view.context?.live?.overrides ?? new Map();
    const currentOverride = overrides.get(view.camera) ?? view.camera;
    const currentIndex = dependencies.indexOf(currentOverride);
    const newIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % dependencies.length;
    overrides.set(view.camera, dependencies[newIndex]);
    view.mergeInContext({ live: { overrides: overrides } });

    return view;
  }

  protected _createViewWithoutSubstream(): View | null {
    if (!this._view) {
      return null;
    }
    const view = this._view.clone();
    const overrides: Map<string, string> | undefined = view.context?.live?.overrides;
    if (overrides && overrides.has(view.camera)) {
      view.context?.live?.overrides?.delete(view.camera);
    }
    return view;
  }
}
