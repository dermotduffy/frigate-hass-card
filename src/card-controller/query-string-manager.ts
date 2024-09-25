import { FrigateCardCustomAction, ViewActionConfig } from '../config/types';
import { createCameraAction, createGeneralAction } from '../utils/action.js';
import { ViewParameters } from '../view/view';
import { CardQueryStringAPI } from './types';
import { SubstreamSelectViewModifier } from './view/modifiers/substream-select';

interface QueryStringViewIntent {
  view?: Partial<ViewParameters> & {
    default?: boolean;
    substream?: string;
  };
  other?: FrigateCardCustomAction[];
}

export class QueryStringManager {
  protected _api: CardQueryStringAPI;
  protected _shouldRun = true;

  constructor(api: CardQueryStringAPI) {
    this._api = api;
  }

  public hasViewRelatedActionsToRun(): boolean {
    return !!this._calculateIntent().view && this._shouldRun;
  }

  public requestExecution = (): void => {
    this._shouldRun = true;
    this._api.getCardElementManager().update();
  };

  public executeIfNecessary = async (): Promise<void> => {
    if (this._shouldRun) {
      this._shouldRun = false;
      await this._executeViewRelated(this._calculateIntent());
      await this._executeNonViewRelated(this._calculateIntent());
    }
  };

  protected async _executeViewRelated(intent: QueryStringViewIntent): Promise<void> {
    if (intent.view) {
      if (intent.view.default) {
        await this._api.getViewManager().setViewDefaultWithNewQuery({
          params: {
            camera: intent.view.camera,
          },
          ...(intent.view.substream && {
            modifiers: [new SubstreamSelectViewModifier(intent.view.substream)],
          }),
        });
      } else {
        await this._api.getViewManager().setViewByParametersWithNewQuery({
          params: {
            ...(intent.view.view && { view: intent.view.view }),
            ...(intent.view.camera && { camera: intent.view.camera }),
          },
          ...(intent.view.substream && {
            modifiers: [new SubstreamSelectViewModifier(intent.view.substream)],
          }),
        });
      }
    }
  }

  protected async _executeNonViewRelated(intent: QueryStringViewIntent): Promise<void> {
    if (intent.other) {
      await this._api.getActionsManager().executeActions(intent.other);
    }
  }

  protected _calculateIntent(): QueryStringViewIntent {
    const result: QueryStringViewIntent = {};
    for (const action of this._getActions()) {
      if (this._isViewAction(action)) {
        (result.view ??= {}).view = action.frigate_card_action;
        (result.view ??= {}).default = undefined;
      } else if (action.frigate_card_action === 'default') {
        (result.view ??= {}).default = true;
        (result.view ??= {}).view = undefined;
      } else if (action.frigate_card_action === 'camera_select') {
        (result.view ??= {}).camera = action.camera;
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
            customAction = createCameraAction(action, value, {
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
          customAction = createGeneralAction(action, {
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
  ): action is ViewActionConfig => {
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
