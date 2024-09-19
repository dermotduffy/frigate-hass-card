import {
  HomeAssistant,
  LovelaceCard,
  LovelaceCardConfig,
  LovelaceCardEditor,
  Themes,
} from '@dermotduffy/custom-card-helpers';
import { StyleInfo } from 'lit/directives/style-map.js';
import { z } from 'zod';

export type ClipsOrSnapshots = 'clips' | 'snapshots';
export type ClipsOrSnapshotsOrAll = 'clips' | 'snapshots' | 'all';

export class FrigateCardError extends Error {
  context?: unknown;

  constructor(message: string, context?: unknown) {
    super(message);
    this.context = context;
  }
}

export interface ExtendedHomeAssistant extends HomeAssistant {
  hassUrl(path?): string;
  themes: Themes & {
    darkMode?: boolean;
  };
}

export interface MediaLoadedCapabilities {
  supports2WayAudio?: boolean;
  supportsPause?: boolean;
  hasAudio?: boolean;
}

const MEDIA_TECHNOLOGY = ['hls', 'jpg', 'jsmpeg', 'mjpeg', 'mp4', 'mse', 'webrtc'];
export type MediaTechnology = (typeof MEDIA_TECHNOLOGY)[number];

export interface MediaLoadedInfo {
  width: number;
  height: number;
  technology?: MediaTechnology[];
  player?: FrigateCardMediaPlayer;
  capabilities?: MediaLoadedCapabilities;
}

export type MessageType = 'info' | 'error' | 'connection' | 'diagnostics';

type MessagePriority = {
  [type in MessageType]: number;
};

export const MESSAGE_TYPE_PRIORITIES: MessagePriority = {
  info: 10,
  error: 20,
  connection: 30,
  diagnostics: 40,
};

export interface Message {
  message: unknown;
  type: MessageType;
  icon?: string;
  context?: unknown;
  dotdotdot?: boolean;
}

export interface StateParameters {
  entity?: string;
  icon?: string;
  title?: string | null;
  state_color?: boolean;
  style?: StyleInfo;
  data_domain?: string;
  data_state?: string;
}

export interface FrigateCardMediaPlayer {
  play(): Promise<void>;
  pause(): Promise<void>;
  mute(): Promise<void>;
  unmute(): Promise<void>;
  isMuted(): boolean;
  seek(seconds: number): Promise<void>;
  getScreenshotURL(): Promise<string | null>;
  // If no value for controls if specified, the player should use the default.
  setControls(controls?: boolean): Promise<void>;
  isPaused(): boolean;
}

export type LovelaceCardWithEditor = LovelaceCard & {
  constructor: {
    getConfigElement(): Promise<LovelaceCardEditor>;
  };
};

export interface CardHelpers {
  createCardElement(config: LovelaceCardConfig): Promise<LovelaceCardWithEditor>;
}

export type PTZMovementType = 'relative' | 'continuous';

export interface PTZCapabilities {
  left?: PTZMovementType[];
  right?: PTZMovementType[];
  up?: PTZMovementType[];
  down?: PTZMovementType[];
  zoomIn?: PTZMovementType[];
  zoomOut?: PTZMovementType[];

  presets?: string[];
}

export interface CapabilitiesRaw {
  live?: boolean;
  substream?: boolean;

  clips?: boolean;
  recordings?: boolean;
  snapshots?: boolean;

  'favorite-events'?: boolean;
  'favorite-recordings'?: boolean;

  seek?: boolean;

  ptz?: PTZCapabilities;

  menu?: boolean;
}

export type CapabilityKey = keyof CapabilitiesRaw;
export const capabilityKeys: readonly [CapabilityKey, ...CapabilityKey[]] = [
  'clips',
  'favorite-events',
  'favorite-recordings',
  'live',
  'menu',
  'ptz',
  'recordings',
  'seek',
  'snapshots',
  'substream',
] as const;

// *************************************************************************
//                     Home Assistant API types.
// *************************************************************************

// Server side data-type defined here: https://github.com/home-assistant/core/blob/dev/homeassistant/components/media_source/models.py
export const resolvedMediaSchema = z.object({
  url: z.string(),
  mime_type: z.string(),
});
export type ResolvedMedia = z.infer<typeof resolvedMediaSchema>;

export const signedPathSchema = z.object({
  path: z.string(),
});
export type SignedPath = z.infer<typeof signedPathSchema>;
