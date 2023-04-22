export class VideoRTC extends HTMLElement {
  DISCONNECT_TIMEOUT: number;
  RECONNECT_TIMEOUT: number;
  CODECS: string[];
  mode: string;
  background: boolean;
  visibilityThreshold: number;
  visibilityCheck: boolean;
  pcConfig: RTCConfiguration;
  wsState: number;
  pcState: number;
  video: HTMLVideoElement;
  ws: WebSocket | null;
  wsURL: string;
  pc: RTCPeerConnection;
  connectTS: number;
  mseCodecs: string;

  src: string | URL;

  oninit(): void;
}
