import isEqual from 'lodash-es/isEqual';
import { ViewContext } from 'view';
import {
  FRIGATE_CARD_VIEW_DEFAULT,
  FrigateCardConfig,
  FrigateCardView,
  ViewDisplayMode,
} from '../config/types';
import { localize } from '../localize/localize';
import { log } from '../utils/debug';
import { executeMediaQueryForView } from '../utils/media-to-view';
import { View } from '../view/view';
import { getCameraIDsForViewName } from '../view/view-to-cameras';
import { CardViewAPI } from './types';

interface ViewManagerSetViewDefaultParameters {
  cameraID?: string;
  substream?: string;

  // When failSafe is true, the view will be changed to the default view, or the
  // `live` view if the default view is not supported, or failing that an error
  // message is shown. Without `failSafe` the view will just not be changed if
  // unsupported.
  failSafe?: boolean;
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
      const viewName = config.view.default;

      if (!forceCameraID && this._view?.camera && config.view.update_cycle_camera) {
        const cameraIDs = [
          ...getCameraIDsForViewName(this._api.getCameraManager(), viewName),
        ];
        const currentIndex = cameraIDs.indexOf(this._view.camera);
        const targetIndex = currentIndex + 1 >= cameraIDs.length ? 0 : currentIndex + 1;
        forceCameraID = cameraIDs[targetIndex];
      }

      this.setViewByParameters({
        ...params,
        viewName: viewName,
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

      let viewName = params?.viewName ?? this._view?.view ?? config.view.default;
      const allCameraIDs = this._api.getCameraManager().getStore().getCameraIDs();
      if (params?.cameraID && allCameraIDs.has(params.cameraID)) {
        cameraID = params.cameraID;
      } else {
        const viewCameraIDs = getCameraIDsForViewName(
          this._api.getCameraManager(),
          viewName,
        );

        // Reset to the default camera.
        cameraID = viewCameraIDs.keys().next().value;
      }

      if (!cameraID) {
        if (params.failSafe) {
          const camerasToCapabilities = [
            ...this._api.getCameraManager().getStore().getCameras(),
          ].reduce((acc, [cameraID, camera]) => {
            const capabilities = camera.getCapabilities()?.getRawCapabilities();
            if (capabilities) {
              acc[cameraID] = capabilities;
            }
            return acc;
          }, {});

          this._api.getMessageManager().setMessageIfHigherPriority({
            type: 'error',
            message: localize('error.no_supported_cameras'),
            context: {
              view: viewName,
              cameras_capabilities: camerasToCapabilities,
            },
          });
        }
        return;
      }

      if (!this.isViewSupportedByCamera(cameraID, viewName)) {
        if (params.failSafe) {
          if (this.isViewSupportedByCamera(cameraID, FRIGATE_CARD_VIEW_DEFAULT)) {
            viewName = FRIGATE_CARD_VIEW_DEFAULT;
          } else {
            const capabilities = this._api
              .getCameraManager()
              .getStore()
              .getCamera(cameraID)
              ?.getCapabilities()
              ?.getRawCapabilities();
            this._api.getMessageManager().setMessageIfHigherPriority({
              type: 'error',
              message: localize('error.no_supported_camera'),
              context: {
                view: viewName,
                camera: cameraID,
                ...(capabilities && { camera_capabilities: capabilities }),
              },
            });
            return;
          }
        } else {
          return;
        }
      }

      const displayMode =
        this._view?.displayMode ?? this._getDefaultDisplayModeForView(viewName, config);
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

  public setViewWithMergedContext(context: ViewContext | null): void {
    if (this._view) {
      return this._setView(this._view?.clone().mergeInContext(context));
    }
  }

  public reset(): void {
    this._view = null;
  }

  protected _getCameraIDsInvolvedInView(view: View): Set<string> {
    return view.supportsMultipleDisplayModes() && view.isGrid()
      ? getCameraIDsForViewName(this._api.getCameraManager(), view.view)
      : getCameraIDsForViewName(this._api.getCameraManager(), view.view, view.camera);
  }

  public async setViewWithNewDisplayMode(displayMode: ViewDisplayMode): Promise<void> {
    const hass = this._api.getHASSManager().getHASS();

    if (this._view && hass) {
      const view = this._view.evolve({
        displayMode: displayMode,
      });

      const expectedCameraIDs = this._getCameraIDsInvolvedInView(view);
      const queryCameraIDs = view.query?.getQueryCameraIDs();

      if (!isEqual(expectedCameraIDs, queryCameraIDs) && view && view.query) {
        // If the user requests a grid but the current query does not have a
        // query for more than one camera, reset the query results, change the
        // existing query to refer to all cameras and execute it to fetch new
        // results.
        let viewWithNewQuery: View | null = null;
        try {
          viewWithNewQuery = await executeMediaQueryForView(
            this._api.getCameraManager(),
            view,
            view.query.clone().setQueryCameraIDs(expectedCameraIDs),
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
    return !!getCameraIDsForViewName(this._api.getCameraManager(), view, cameraID).size;
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
