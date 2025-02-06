import { dispatchAdvancedCameraCardEvent } from '../../../utils/basic';

export function dispatchLiveErrorEvent(element: EventTarget): void {
  dispatchAdvancedCameraCardEvent(element, 'live:error');
}
