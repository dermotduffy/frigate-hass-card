import { ActionConfig, LovelaceCard, LovelaceCardConfig, LovelaceCardEditor } from 'custom-card-helpers';
declare global {
  interface HTMLElementTagNameMap {
    'frigate-card-editor': LovelaceCardEditor;
    'hui-error-card': LovelaceCard;
  }
}

export interface FrigateCardConfig extends LovelaceCardConfig {
  type: string;
  name?: string;

  camera_entity: string;
  motion_entity: string | null;
  frigate_url: string;
  frigate_camera_name?: string | null;
  default_view: string | null;
  timeout_ms?: number | null;

  show_warning?: boolean;
  show_error?: boolean;
  test_gui?: boolean;
  tap_action?: ActionConfig;
  hold_action?: ActionConfig;
  double_tap_action?: ActionConfig;
}

export interface FrigateEvent {
  camera: string;
  end_time: number;
  false_positive: boolean;
  has_clip: boolean;
  has_snapshot: boolean;
  id: string;
  label: string;
  start_time: number;
  thumbnail: string;
  top_score: number;
  zones: string[];
}

export interface GetEventsParameters {
  has_clip?: boolean;
  has_snapshot?: boolean;
  limit?: number;
}

export interface ControlVideosParameters {
  stop: boolean;
  control_live?: boolean;
  control_clip?: boolean;
}