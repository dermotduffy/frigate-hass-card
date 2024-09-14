import { PTZControlAction } from '../../config/ptz';
import { Actions } from '../../config/types';

interface PTZControlsViewContext {
  enabled?: boolean;
}
declare module 'view' {
  interface ViewContext {
    ptzControls?: PTZControlsViewContext;
  }
}

export type PTZActionNameToMultiAction = {
  [K in PTZControlAction]?: Actions;
};

export interface PTZActionPresence {
  pt: boolean;
  z: boolean;
  home: boolean;
}
