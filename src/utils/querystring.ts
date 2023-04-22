import { FrigateCardCustomAction } from '../types';
import { createFrigateCardCustomAction } from './action.js';

export const getActionsFromQueryString = (): FrigateCardCustomAction[] => {
  const params = new URLSearchParams(window.location.search);
  const actions: FrigateCardCustomAction[] = [];
  const actionRE = new RegExp(/^frigate-card-action(:(?<cardID>\w+))?:(?<action>\w+)/);

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
};
