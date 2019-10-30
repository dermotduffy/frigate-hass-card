import { ActionConfig, HASSDomEvent } from "custom-card-helpers";

// TODO Add your configuration elements here for type-checking
export interface BoilerplateConfig {
  type: string;
  name?: string;
  show_warning?: boolean;
  show_error?: boolean;
  entity?: string;
  tap_aciton?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}
