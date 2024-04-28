import { ViewContext } from 'view';
import { ZoomConfig, ZoomDefault } from './types.js';
import { dispatchViewContextChangeEvent } from '../../view/view.js';

interface ZoomViewContext {
  // Populate this to request zoom to a particular scale/x/y. An empty object
  // will reset to default, null will make no change.
  zoom?: ZoomConfig | null;

  // This will be populated with whether or not the current zoom is at the
  // default level.
  isDefault?: boolean;
}

interface ZoomsViewContext {
  [targetID: string]: ZoomViewContext;
}

declare module 'view' {
  interface ViewContext {
    zoom?: ZoomsViewContext;
  }
}

export const generateViewContextForZoomChange = (
  targetID: string,
  options?: {
    zoom?: ZoomConfig | null;
    isDefault?: boolean;
  },
): ViewContext | null => {
  return {
    zoom: {
      [targetID]: {
        zoom: options?.zoom ?? null,
        ...(options?.isDefault !== undefined && { isDefault: options.isDefault }),
      },
    },
  };
};

/**
 * Convenience wrapper to convert a zoom default into a dispatched view context
 * change.
 */
export const handleZoomDefaultEvent = (
  element: EventTarget,
  ev: CustomEvent<ZoomDefault>,
  targetID?: string,
): void => {
  targetID && dispatchViewContextChangeEvent(
    element,
    generateViewContextForZoomChange(targetID, {
      isDefault: ev.detail.isDefault,
    }),
  );
};
