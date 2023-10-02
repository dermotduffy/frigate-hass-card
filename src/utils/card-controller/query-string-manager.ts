import { FrigateCardCustomAction, FrigateCardViewAction } from '../../types';
import { createFrigateCardCustomAction } from '../action.js';
import { CardQueryStringAPI } from './types';
import { ViewManagerSetViewParameters } from './view-manager';

interface QueryStringViewIntent {
  view?: ViewManagerSetViewParameters & {
    default?: boolean;
  };
  other?: FrigateCardCustomAction[];
}

export class QueryStringManager {
  protected _api: CardQueryStringAPI;

  constructor(api: CardQueryStringAPI) {
    this._api = api;
  }

  public hasViewRelatedActions(): boolean {
    return !!this._calculateIntent().view;
  }

  public executeNonViewRelated(): void {
    this._executeNonViewRelated(this._calculateIntent());
  }

  public executeViewRelated(): void {
    this._executeViewRelated(this._calculateIntent());
  }

  public executeAll(): void {
    const intent = this._calculateIntent();
    this._executeViewRelated(intent);
    this._executeNonViewRelated(intent);
  }

  protected _executeViewRelated(intent: QueryStringViewIntent): void {
    if (intent.view) {
      if (intent.view.default) {
        this._api.getViewManager().setViewDefault({
          ...(intent.view.cameraID && { cameraID: intent.view.cameraID }),
          ...(intent.view.substream && { substream: intent.view.substream }),
        });
      } else {
        this._api.getViewManager().setViewByParameters({
          ...(intent.view.viewName && { viewName: intent.view.viewName }),
          ...(intent.view.cameraID && { cameraID: intent.view.cameraID }),
          ...(intent.view.substream && { substream: intent.view.substream }),
        });
      }
    }
  }

  protected _executeNonViewRelated(intent: QueryStringViewIntent): void {
    // Only execute non-view actions when the card has rendered at least once.
    if (!this._api.getCardElementManager().hasUpdated()) {
      return;
    }

    intent.other?.forEach((action) =>
      this._api.getActionsManager().executeAction(action),
    );
  }

  protected _calculateIntent(): QueryStringViewIntent {
    const result: QueryStringViewIntent = {};
    for (const action of this._getActions()) {
      if (this._isViewAction(action)) {
        (result.view ??= {}).viewName = action.frigate_card_action;
        (result.view ??= {}).default = undefined;
      } else if (action.frigate_card_action === 'default') {
        (result.view ??= {}).default = true;
        (result.view ??= {}).viewName = undefined;
      } else if (action.frigate_card_action === 'camera_select') {
        (result.view ??= {}).cameraID = action.camera;
      } else if (action.frigate_card_action === 'live_substream_select') {
        (result.view ??= {}).substream = action.camera;
      } else {
        (result.other ??= []).push(action);
      }
    }
    return result;
  }

  protected _getActions(): FrigateCardCustomAction[] {
    const params = new URLSearchParams(window.location.search);
    const actions: FrigateCardCustomAction[] = [];
    const actionRE = new RegExp(
      /^frigate-card-action([.:](?<cardID>\w+))?[.:](?<action>\w+)/,
    );
    for (const [key, value] of params.entries()) {
      const match = key.match(actionRE);
      if (!match || !match.groups) {
        continue;
      }
      const cardID: string | undefined = match.groups['cardID'];
      const action = match.groups['action'];

      let customAction: FrigateCardCustomAction | null = null;
      switch (action) {
        case 'camera_select':
        case 'live_substream_select':
          if (value) {
            customAction = createFrigateCardCustomAction(action, {
              camera: value,
              cardID: cardID,
            });
          }
          break;
        case 'camera_ui':
        case 'clip':
        case 'clips':
        case 'default':
        case 'diagnostics':
        case 'download':
        case 'expand':
        case 'image':
        case 'live':
        case 'menu_toggle':
        case 'recording':
        case 'recordings':
        case 'snapshot':
        case 'snapshots':
        case 'timeline':
          customAction = createFrigateCardCustomAction(action, {
            cardID: cardID,
          });
          break;
        default:
          console.warn(
            `Frigate card received unknown card action in query string: ${action}`,
          );
      }
      if (customAction) {
        actions.push(customAction);
      }
    }
    return actions;
  }

  protected _isViewAction = (
    action: FrigateCardCustomAction,
  ): action is FrigateCardViewAction => {
    switch (action.frigate_card_action) {
      case 'clip':
      case 'clips':
      case 'diagnostics':
      case 'image':
      case 'live':
      case 'recording':
      case 'recordings':
      case 'snapshot':
      case 'snapshots':
      case 'timeline':
        return true;
    }
    return false;
  };
}
