import { dispatchFrigateCardEvent } from '../../../utils/basic';

export function dispatchLiveErrorEvent(element: EventTarget): void {
  dispatchFrigateCardEvent(element, 'live:error');
}
