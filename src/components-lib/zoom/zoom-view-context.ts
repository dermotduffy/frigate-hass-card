import { ViewContext } from 'view';
import { dispatchViewContextChangeEvent } from '../../view/view.js';
import { ZoomSettingsObserved, PartialZoomSettings } from './types.js';

interface ZoomViewContext {
  observed?: ZoomSettingsObserved;

  // Populate this to request zoom to a particular scale/x/y. An empty object
  // will reset to default, null will make no change.
  requested?: PartialZoomSettings | null;
}

interface ZoomsViewContext {
  [targetID: string]: ZoomViewContext;
}

declare module 'view' {
  interface ViewContext {
    zoom?: ZoomsViewContext;
  }
}

export const generateViewContextForZoom = (
  targetID: string,
  options?: {
    observed?: ZoomSettingsObserved;
    requested?: PartialZoomSettings | null;
  },
): ViewContext | null => {
  return {
    zoom: {
      [targetID]: {
        observed: options?.observed ?? undefined,
        requested: options?.requested ?? null,
      },
    },
  };
};

/**
 * Convenience wrapper to convert zoom settings into a dispatched view context
 * change.
 */
export const handleZoomSettingsObservedEvent = (
  element: EventTarget,
  ev: CustomEvent<ZoomSettingsObserved>,
  targetID?: string,
): void => {
  targetID &&
    dispatchViewContextChangeEvent(
      element,
      generateViewContextForZoom(targetID, {
        observed: ev.detail,
      }),
    );
};
