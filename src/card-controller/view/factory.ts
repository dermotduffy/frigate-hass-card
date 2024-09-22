import { sub } from 'date-fns';
import {
  FRIGATE_CARD_VIEW_DEFAULT,
  FrigateCardConfig,
  FrigateCardView,
  ViewDisplayMode,
} from '../../config/types';
import { localize } from '../../localize/localize';
import { ClipsOrSnapshotsOrAll } from '../../types';
import { MediaQueriesClassifier } from '../../view/media-queries-classifier';
import { View, ViewParameters } from '../../view/view';
import { getCameraIDsForViewName } from '../../view/view-to-cameras';
import { CardViewAPI } from '../types';
import { QueryExecutor } from './query-executor';
import {
  QueryExecutorOptions,
  QueryWithResults,
  ViewFactoryOptions,
  ViewIncompatible,
  ViewNoCameraError,
} from './types';

export class ViewFactory {
  protected _api: CardViewAPI;
  protected _executor: QueryExecutor;

  constructor(api: CardViewAPI, executor?: QueryExecutor) {
    this._api = api;
    this._executor = executor ?? new QueryExecutor(api);
  }

  public getViewDefault(options?: ViewFactoryOptions): View | null {
    const config = this._api.getConfigManager().getConfig();
    if (!config) {
      return null;
    }

    // Neither options.baseView.camera nor options.baseView.view are respected
    // here, since this is the default view / camera.
    // See: https://github.com/dermotduffy/frigate-hass-card/issues/1564

    let cameraID: string | null = null;
    const viewName = options?.params?.view ?? config.view.default;

    if (options?.params?.camera) {
      cameraID = options.params.camera;
    } else {
      const cameraIDs = [
        ...getCameraIDsForViewName(this._api.getCameraManager(), viewName),
      ];
      if (!cameraIDs.length) {
        return null;
      }

      if (options?.baseView?.camera && config.view.default_cycle_camera) {
        const currentIndex = cameraIDs.indexOf(options.baseView.camera);
        const targetIndex = currentIndex + 1 >= cameraIDs.length ? 0 : currentIndex + 1;
        cameraID = cameraIDs[targetIndex];
      } else {
        cameraID = cameraIDs[0];
      }
    }

    return this.getViewByParameters({
      params: {
        ...options?.params,
        view: viewName,
        camera: cameraID,
      },
      baseView: options?.baseView,
    });
  }

  public getViewByParameters(options?: ViewFactoryOptions): View | null {
    const config = this._api.getConfigManager().getConfig();
    if (!config) {
      return null;
    }

    let cameraID: string | null =
      options?.params?.camera ?? options?.baseView?.camera ?? null;
    let viewName =
      options?.params?.view ?? options?.baseView?.view ?? config.view.default;

    const allCameraIDs = this._api.getCameraManager().getStore().getCameraIDs();

    if (!cameraID || !allCameraIDs.has(cameraID)) {
      const viewCameraIDs = getCameraIDsForViewName(
        this._api.getCameraManager(),
        viewName,
      );

      // Reset to the default camera.
      cameraID = viewCameraIDs.keys().next().value;
    }

    if (!cameraID) {
      const camerasToCapabilities = [
        ...this._api.getCameraManager().getStore().getCameras(),
      ].reduce((acc, [cameraID, camera]) => {
        const capabilities = camera.getCapabilities()?.getRawCapabilities();
        if (capabilities) {
          acc[cameraID] = capabilities;
        }
        return acc;
      }, {});

      throw new ViewNoCameraError(localize('error.no_supported_cameras'), {
        view: viewName,
        cameras_capabilities: camerasToCapabilities,
      });
    }

    if (!this.isViewSupportedByCamera(cameraID, viewName)) {
      if (
        options?.failSafe &&
        this.isViewSupportedByCamera(cameraID, FRIGATE_CARD_VIEW_DEFAULT)
      ) {
        viewName = FRIGATE_CARD_VIEW_DEFAULT;
      } else {
        const capabilities = this._api
          .getCameraManager()
          .getStore()
          .getCamera(cameraID)
          ?.getCapabilities()
          ?.getRawCapabilities();

        throw new ViewIncompatible(localize('error.no_supported_camera'), {
          view: viewName,
          camera: cameraID,
          ...(capabilities && { camera_capabilities: capabilities }),
        });
      }
    }

    const displayMode =
      options?.params?.displayMode ??
      options?.baseView?.displayMode ??
      this._getDefaultDisplayModeForView(viewName, config);

    const viewParameters: ViewParameters = {
      ...options?.params,
      view: viewName,
      camera: cameraID,
      displayMode: displayMode,
    };

    const view = options?.baseView
      ? options.baseView.evolve(viewParameters)
      : new View(viewParameters);

    if (options?.modifiers) {
      options.modifiers.forEach((modifier) => modifier.modify(view));
    }
    return view;
  }

  public async getViewDefaultWithNewQuery(
    options?: ViewFactoryOptions,
  ): Promise<View | null> {
    return this._executeNewQuery(this.getViewDefault(options), {
      ...options,
      queryExecutorOptions: {
        useCache: false,
        ...options?.queryExecutorOptions,
      },
    });
  }

  public async getViewByParametersWithNewQuery(
    options?: ViewFactoryOptions,
  ): Promise<View | null> {
    return this._executeNewQuery(this.getViewByParameters(options), {
      ...options,
      queryExecutorOptions: {
        useCache: false,
        ...options?.queryExecutorOptions,
      },
    });
  }

  public async getViewByParametersWithExistingQuery(
    options?: ViewFactoryOptions,
  ): Promise<View | null> {
    const view = this.getViewByParameters(options);
    if (view?.query) {
      view.queryResults = await this._executor.execute(
        view.query,
        options?.queryExecutorOptions,
      );
    }
    return view;
  }

  protected async _executeNewQuery(
    view: View | null,
    options?: ViewFactoryOptions,
  ): Promise<View | null> {
    const config = this._api.getConfigManager().getConfig();
    if (
      !config ||
      /* istanbul ignore next: this path cannot be reached as the only way for
         view to be null here, is if the config is also null -- @preserve */
      !view
    ) {
      return null;
    }

    const executeMediaQuery = async (
      mediaType: ClipsOrSnapshotsOrAll | 'recordings' | null,
    ): Promise<boolean> => {
      /* istanbul ignore if: this path cannot be reached -- @preserve */
      if (!mediaType) {
        return false;
      }
      return await this._executeMediaQuery(
        view,
        mediaType === 'recordings' ? 'recordings' : 'events',
        {
          eventsMediaType: mediaType === 'recordings' ? undefined : mediaType,
          executorOptions: options?.queryExecutorOptions,
        },
      );
    };

    // Implementation note: For new queries, if the query itself fails that is
    // just ignored and the view is returned anyway (e.g. if the user changes to
    // live but the thumbnail fetch fails, it is better to change to live and
    // show no thumbnails than not change to live).
    const mediaType = view.getDefaultMediaType();
    const baseView = options?.baseView;
    const switchingToGalleryFromViewer =
      baseView?.isViewerView() && view.isGalleryView();

    const alreadyHasMatchingQuery =
      mediaType === MediaQueriesClassifier.getMediaType(baseView?.query);

    if (
      switchingToGalleryFromViewer &&
      alreadyHasMatchingQuery &&
      baseView?.query &&
      baseView?.queryResults
    ) {
      // If the user is currently using the viewer, and then switches to the
      // gallery we make an attempt to keep the query/queryResults the same so
      // the gallery can be used to click back and forth to the viewer, and the
      // selected media can be centered in the gallery. See the matching code in
      // `updated()` in `gallery.ts`. We specifically must ensure that the new
      // target media of the gallery (e.g. clips, snapshots or recordings) is
      // equal to the queries that are currently used in the viewer.
      //
      // See: https://github.com/dermotduffy/frigate-hass-card/issues/885
      view.query = baseView.query;
      view.queryResults = baseView.queryResults;
    } else {
      switch (view.view) {
        case 'live':
          if (config.live.controls.thumbnails.mode !== 'none') {
            await executeMediaQuery(
              config.live.controls.thumbnails.media_type === 'recordings'
                ? 'recordings'
                : config.live.controls.thumbnails.events_media_type,
            );
          }
          break;

        case 'media':
          // If the user is looking at media in the `media` view and then
          // changes camera (via the menu) it should default to showing clips
          // for the new camera.
          if (baseView && view.camera !== baseView.camera) {
            await executeMediaQuery('clips');
          }
          break;

        // Gallery views:
        case 'clips':
        case 'snapshots':
        case 'recordings':
          await executeMediaQuery(mediaType);
          break;

        // Viewer views:
        case 'clip':
        case 'snapshot':
        case 'recording':
          if (config.media_viewer.controls.thumbnails.mode !== 'none') {
            await executeMediaQuery(mediaType);
          }
          break;
      }
    }

    this._setOrRemoveTimelineWindow(view);
    this._setOrRemoveSeekTime(
      view,
      options?.queryExecutorOptions?.selectResult?.time?.time,
    );
    return view;
  }

  protected _setOrRemoveTimelineWindow(view: View): void {
    if (view.is('live')) {
      // For live views, always force the timeline to now, regardless of
      // presence or not of events.
      const now = new Date();
      const liveConfig = this._api.getConfigManager().getConfig()?.live;

      /* istanbul ignore if: this if branch cannot be reached as if the config is
         empty this function is never called -- @preserve */
      if (!liveConfig) {
        return;
      }

      view.mergeInContext({
        // Force the window to start at the most recent time, not
        // necessarily when the most recent event/recording was:
        // https://github.com/dermotduffy/frigate-hass-card/issues/1301
        timeline: {
          window: {
            start: sub(now, {
              seconds: liveConfig.controls.timeline.window_seconds,
            }),
            end: now,
          },
        },
      });
    } else {
      // For non-live views stick to default timeline behavior (will select and
      // scroll to event).
      view.removeContextProperty('timeline', 'window');
    }
  }

  protected _setOrRemoveSeekTime(view: View, time?: Date): void {
    if (time) {
      view.mergeInContext({
        mediaViewer: {
          seek: time,
        },
      });
    } else {
      view.removeContextProperty('mediaViewer', 'seek');
    }
  }

  protected async _executeMediaQuery(
    view: View,
    mediaType: 'events' | 'recordings',
    options?: {
      eventsMediaType?: ClipsOrSnapshotsOrAll;
      executorOptions?: QueryExecutorOptions;
    },
  ): Promise<boolean> {
    const queryWithResults: QueryWithResults | null =
      mediaType === 'events'
        ? await this._executor.executeDefaultEventQuery({
            ...(!view.isGrid() && { cameraID: view.camera }),
            eventsMediaType: options?.eventsMediaType,
            executorOptions: options?.executorOptions,
          })
        : mediaType === 'recordings'
          ? await this._executor.executeDefaultRecordingQuery({
              ...(!view.isGrid() && { cameraID: view.camera }),
              executorOptions: options?.executorOptions,
            })
          : /* istanbul ignore next -- @preserve */
            null;
    if (!queryWithResults) {
      return false;
    }

    view.query = queryWithResults.query;
    view.queryResults = queryWithResults.queryResults;
    return true;
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
}
