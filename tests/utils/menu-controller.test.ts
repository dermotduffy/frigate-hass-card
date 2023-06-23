import { HomeAssistant } from 'custom-card-helpers';
import screenfull from 'screenfull';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { CameraManager } from '../../src/camera-manager/manager';
import { CameraManagerCameraMetadata } from '../../src/camera-manager/types';
import {
  FrigateCardConfig,
  FrigateCardMediaPlayer,
  MediaLoadedInfo,
  MenuButton,
} from '../../src/types';
import { createFrigateCardCustomAction } from '../../src/utils/action';
import { MenuButtonController } from '../../src/utils/menu-controller';
import { MicrophoneController } from '../../src/utils/microphone';
import { ViewMedia } from '../../src/view/media';
import { MediaQueriesResults } from '../../src/view/media-queries-results';
import { View } from '../../src/view/view';
import {
  createCameraCapabilities,
  createCameraConfig,
  createCameraManager,
  createConfig,
  createHASS,
  createMediaCapabilities,
  createMediaLoadedInfo,
  createStateEntity,
  createView,
} from '../test-utils';

vi.mock('../../src/camera-manager/manager.js');
vi.mock('../../src/utils/microphone');
vi.mock('screenfull');

const calculateButtons = (
  controller: MenuButtonController,
  options?: {
    hass?: HomeAssistant;
    config?: FrigateCardConfig;
    cameraManager?: CameraManager;
    view?: View;
    expanded?: boolean;
    currentMediaLoadedInfo?: MediaLoadedInfo | null;
    mediaPlayers?: string[];
    cameraURL?: string | null;
    microphoneController?: MicrophoneController;
  },
): MenuButton[] => {
  return controller.calculateButtons(
    options?.hass ?? createHASS(),
    options?.config ?? createConfig(),
    options?.cameraManager ??
      createCameraManager({
        configs: new Map([
          ['camera-1', createCameraConfig()],
          ['camera-2', createCameraConfig()],
        ]),
      }),
    options?.view ?? createView({ camera: 'camera-1' }),
    options?.expanded ?? false,
    {
      currentMediaLoadedInfo: options?.currentMediaLoadedInfo,
      mediaPlayers: options?.mediaPlayers,
      cameraURL: options?.cameraURL,
      microphoneController: options?.microphoneController,
    },
  );
};

describe('MenuButtonController', () => {
  let controller: MenuButtonController;
  const dynamicButton: MenuButton = {
    type: 'custom:frigate-card-menu-icon',
    icon: 'mdi:alpha-a-circle',
    title: 'Dynamic button',
  };

  beforeEach(() => {
    vi.resetAllMocks();
    controller = new MenuButtonController();
  });

  it('should have frigate menu button with hidden menu style', () => {
    const buttons = calculateButtons(controller);
    expect(buttons).toContainEqual({
      icon: 'frigate',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Frigate menu / Default view',
      tap_action: createFrigateCardCustomAction('menu_toggle'),
      hold_action: createFrigateCardCustomAction('diagnostics'),
    });
  });

  it('should have frigate menu button without hidden menu style', () => {
    const buttons = calculateButtons(controller, {
      config: createConfig({ menu: { style: 'overlay' } }),
    });
    expect(buttons).toContainEqual({
      icon: 'frigate',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Frigate menu / Default view',
      tap_action: createFrigateCardCustomAction('default'),
      hold_action: createFrigateCardCustomAction('diagnostics'),
    });
  });

  it('should have cameras menu', () => {
    const cameraManager = createCameraManager({
      configs: new Map([
        ['camera-1', createCameraConfig()],
        ['camera-2', createCameraConfig()],
      ]),
    });
    mock<CameraManager>(cameraManager).getCameraMetadata.mockReturnValue({
      title: 'title',
      icon: 'icon',
    });

    const buttons = calculateButtons(controller, { cameraManager: cameraManager });
    expect(buttons).toContainEqual({
      icon: 'mdi:video-switch',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-submenu',
      title: 'Cameras',
      items: [
        {
          enabled: true,
          icon: 'icon',
          entity: undefined,
          state_color: true,
          title: 'title',
          selected: true,
          tap_action: {
            action: 'fire-dom-event',
            frigate_card_action: 'camera_select',
            camera: 'camera-1',
          },
        },
        {
          enabled: true,
          icon: 'icon',
          entity: undefined,
          state_color: true,
          title: 'title',
          selected: false,
          tap_action: {
            action: 'fire-dom-event',
            frigate_card_action: 'camera_select',
            camera: 'camera-2',
          },
        },
      ],
    });
  });

  it('should have substream button with single dependency', () => {
    const cameraManager = createCameraManager({
      configs: new Map([
        ['camera-1', createCameraConfig({ dependencies: { cameras: ['camera-2'] } })],
        ['camera-2', createCameraConfig()],
      ]),
    });

    const buttons = calculateButtons(controller, { cameraManager: cameraManager });
    expect(buttons).toContainEqual({
      icon: 'mdi:video-input-component',
      style: {},
      title: 'Substream(s)',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      tap_action: {
        action: 'fire-dom-event',
        frigate_card_action: 'live_substream_on',
      },
    });
  });

  it('should have substream button selected with single dependency', () => {
    const cameraManager = createCameraManager({
      configs: new Map([
        ['camera-1', createCameraConfig({ dependencies: { cameras: ['camera-2'] } })],
        ['camera-2', createCameraConfig()],
      ]),
    });
    const view = createView({
      camera: 'camera-1',
      context: {
        live: {
          overrides: new Map([['camera-1', 'camera-2']]),
        },
      },
    });

    const buttons = calculateButtons(controller, {
      cameraManager: cameraManager,
      view: view,
    });
    expect(buttons).toContainEqual({
      icon: 'mdi:video-input-component',
      style: { color: 'var(--primary-color, white)' },
      title: 'Substream(s)',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      tap_action: {
        action: 'fire-dom-event',
        frigate_card_action: 'live_substream_off',
      },
    });
  });

  it('should have substream menu without substream on with multiple dependencies', () => {
    const cameraManager = createCameraManager({
      configs: new Map([
        [
          'camera-1',
          createCameraConfig({
            camera_entity: 'camera.1',
            dependencies: { cameras: ['camera-2', 'camera-3'] },
          }),
        ],
        [
          'camera-2',
          createCameraConfig({
            camera_entity: 'camera.2',
          }),
        ],
        [
          'camera-3',
          createCameraConfig({
            camera_entity: 'camera.3',
          }),
        ],
      ]),
    });
    // Return different metadata depending on the camera to test multiple code
    // paths.
    mock<CameraManager>(cameraManager).getCameraMetadata.mockImplementation(
      (_hass: unknown, cameraID: string): CameraManagerCameraMetadata | null => {
        return cameraID === 'camera-1'
          ? {
              title: 'title',
              icon: 'icon',
            }
          : null;
      },
    );

    const buttons = calculateButtons(controller, { cameraManager: cameraManager });
    expect(buttons).toContainEqual({
      icon: 'mdi:video-input-component',
      title: 'Substream(s)',
      style: {},
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-submenu',
      items: [
        {
          enabled: true,
          icon: 'icon',
          entity: 'camera.1',
          state_color: true,
          title: 'title',
          selected: true,
          tap_action: {
            action: 'fire-dom-event',
            frigate_card_action: 'live_substream_select',
            camera: 'camera-1',
          },
        },
        {
          enabled: true,
          icon: undefined,
          entity: 'camera.2',
          state_color: true,
          title: undefined,
          selected: false,
          tap_action: {
            action: 'fire-dom-event',
            frigate_card_action: 'live_substream_select',
            camera: 'camera-2',
          },
        },
        {
          enabled: true,
          icon: undefined,
          entity: 'camera.3',
          state_color: true,
          title: undefined,
          selected: false,
          tap_action: {
            action: 'fire-dom-event',
            frigate_card_action: 'live_substream_select',
            camera: 'camera-3',
          },
        },
      ],
    });
  });

  it('should have substream menu with substream on with multiple dependencies', () => {
    const cameraManager = createCameraManager({
      configs: new Map([
        [
          'camera-1',
          createCameraConfig({
            camera_entity: 'camera.1',
            dependencies: { cameras: ['camera-2', 'camera-3'] },
          }),
        ],
        [
          'camera-2',
          createCameraConfig({
            camera_entity: 'camera.2',
          }),
        ],
        [
          'camera-3',
          createCameraConfig({
            camera_entity: 'camera.3',
          }),
        ],
      ]),
    });

    const view = createView({
      camera: 'camera-1',
      context: {
        live: {
          overrides: new Map([['camera-1', 'camera-2']]),
        },
      },
    });

    const buttons = calculateButtons(controller, {
      cameraManager: cameraManager,
      view: view,
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:video-input-component',
      title: 'Substream(s)',
      style: { color: 'var(--primary-color, white)' },
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-submenu',
      items: [
        {
          enabled: true,
          icon: undefined,
          entity: 'camera.1',
          state_color: true,
          title: undefined,
          selected: false,
          tap_action: {
            action: 'fire-dom-event',
            frigate_card_action: 'live_substream_select',
            camera: 'camera-1',
          },
        },
        {
          enabled: true,
          icon: undefined,
          entity: 'camera.2',
          state_color: true,
          title: undefined,
          // camera-2 is selected in this test scenario because of the view
          // override.
          selected: true,
          tap_action: {
            action: 'fire-dom-event',
            frigate_card_action: 'live_substream_select',
            camera: 'camera-2',
          },
        },
        {
          enabled: true,
          icon: undefined,
          entity: 'camera.3',
          state_color: true,
          title: undefined,
          selected: false,
          tap_action: {
            action: 'fire-dom-event',
            frigate_card_action: 'live_substream_select',
            camera: 'camera-3',
          },
        },
      ],
    });
  });

  it('should have styled live menu button in live view', () => {
    const buttons = calculateButtons(controller);
    expect(buttons).toContainEqual({
      icon: 'mdi:cctv',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Live view',
      style: { color: 'var(--primary-color, white)' },
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'live' },
    });
  });

  it('should have unstyled live menu button in non-live views', () => {
    const view = createView({ view: 'clips' });
    const buttons = calculateButtons(controller, { view: view });
    expect(buttons).toContainEqual({
      icon: 'mdi:cctv',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Live view',
      style: {},
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'live' },
    });
  });

  it('should have styled clips menu button in clips view', () => {
    const cameraManager = createCameraManager();
    mock<CameraManager>(cameraManager).getAggregateCameraCapabilities.mockReturnValue(
      createCameraCapabilities({ supportsClips: true }),
    );
    const buttons = calculateButtons(controller, {
      cameraManager: cameraManager,
      view: createView({ view: 'clips' }),
    });
    expect(buttons).toContainEqual({
      icon: 'mdi:filmstrip',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Clips gallery',
      style: { color: 'var(--primary-color, white)' },
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'clips' },
      hold_action: { action: 'fire-dom-event', frigate_card_action: 'clip' },
    });
  });

  it('should have unstyled clips menu button in non-clips view', () => {
    const cameraManager = createCameraManager();
    mock<CameraManager>(cameraManager).getAggregateCameraCapabilities.mockReturnValue(
      createCameraCapabilities({ supportsClips: true }),
    );
    const buttons = calculateButtons(controller, { cameraManager: cameraManager });
    expect(buttons).toContainEqual({
      icon: 'mdi:filmstrip',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Clips gallery',
      style: {},
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'clips' },
      hold_action: { action: 'fire-dom-event', frigate_card_action: 'clip' },
    });
  });

  it('should have styled snapshots menu button in snapshots view', () => {
    const cameraManager = createCameraManager();
    mock<CameraManager>(cameraManager).getAggregateCameraCapabilities.mockReturnValue(
      createCameraCapabilities({ supportsSnapshots: true }),
    );
    const buttons = calculateButtons(controller, {
      cameraManager: cameraManager,
      view: createView({ view: 'snapshots' }),
    });
    expect(buttons).toContainEqual({
      icon: 'mdi:camera',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Snapshots gallery',
      style: { color: 'var(--primary-color, white)' },
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'snapshots' },
      hold_action: { action: 'fire-dom-event', frigate_card_action: 'snapshot' },
    });
  });

  it('should have unstyled snapshots menu button in non-snapshots view', () => {
    const cameraManager = createCameraManager();
    mock<CameraManager>(cameraManager).getAggregateCameraCapabilities.mockReturnValue(
      createCameraCapabilities({ supportsSnapshots: true }),
    );
    const buttons = calculateButtons(controller, { cameraManager: cameraManager });
    expect(buttons).toContainEqual({
      icon: 'mdi:camera',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Snapshots gallery',
      style: {},
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'snapshots' },
      hold_action: { action: 'fire-dom-event', frigate_card_action: 'snapshot' },
    });
  });

  it('should have styled recordings menu button in recordings view', () => {
    const cameraManager = createCameraManager();
    mock<CameraManager>(cameraManager).getAggregateCameraCapabilities.mockReturnValue(
      createCameraCapabilities({ supportsRecordings: true }),
    );
    const buttons = calculateButtons(controller, {
      cameraManager: cameraManager,
      view: createView({ view: 'recordings' }),
    });
    expect(buttons).toContainEqual({
      icon: 'mdi:album',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Recordings gallery',
      style: { color: 'var(--primary-color, white)' },
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'recordings' },
      hold_action: { action: 'fire-dom-event', frigate_card_action: 'recording' },
    });
  });

  it('should have unstyled recordings menu button in non-recordings view', () => {
    const cameraManager = createCameraManager();
    mock<CameraManager>(cameraManager).getAggregateCameraCapabilities.mockReturnValue(
      createCameraCapabilities({ supportsRecordings: true }),
    );
    const buttons = calculateButtons(controller, { cameraManager: cameraManager });
    expect(buttons).toContainEqual({
      icon: 'mdi:album',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Recordings gallery',
      style: {},
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'recordings' },
      hold_action: { action: 'fire-dom-event', frigate_card_action: 'recording' },
    });
  });

  it('should have styled image menu button in image view', () => {
    const buttons = calculateButtons(controller, {
      view: createView({ view: 'image' }),
    });
    expect(buttons).toContainEqual({
      icon: 'mdi:image',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Static image',
      style: { color: 'var(--primary-color, white)' },
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'image' },
    });
  });

  it('should have unstyled image menu button in non-image view', () => {
    const buttons = calculateButtons(controller);
    expect(buttons).toContainEqual({
      icon: 'mdi:image',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Static image',
      style: {},
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'image' },
    });
  });

  it('should have styled timeline menu button in timeline view', () => {
    const cameraManager = createCameraManager();
    mock<CameraManager>(cameraManager).getAggregateCameraCapabilities.mockReturnValue(
      createCameraCapabilities({ supportsTimeline: true }),
    );
    const buttons = calculateButtons(controller, {
      cameraManager: cameraManager,
      view: createView({ view: 'timeline' }),
    });
    expect(buttons).toContainEqual({
      icon: 'mdi:chart-gantt',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Timeline view',
      style: { color: 'var(--primary-color, white)' },
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'timeline' },
    });
  });

  it('should have unstyled timeline menu button in non-timeline view', () => {
    const cameraManager = createCameraManager();
    mock<CameraManager>(cameraManager).getAggregateCameraCapabilities.mockReturnValue(
      createCameraCapabilities({ supportsTimeline: true }),
    );
    const buttons = calculateButtons(controller, {
      cameraManager: cameraManager,
    });
    expect(buttons).toContainEqual({
      icon: 'mdi:chart-gantt',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Timeline view',
      style: {},
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'timeline' },
    });
  });

  it('should have download menu button', () => {
    vi.stubGlobal('navigator', { userAgent: 'foo' });

    const cameraManager = createCameraManager();
    const view = createView({
      queryResults: new MediaQueriesResults([new ViewMedia('clip', 'camera-1')], 0),
    });
    mock<CameraManager>(cameraManager).getMediaCapabilities.mockReturnValue(
      createMediaCapabilities({ canDownload: true }),
    );
    const buttons = calculateButtons(controller, {
      cameraManager: cameraManager,
      view: view,
    });
    expect(buttons).toContainEqual({
      icon: 'mdi:download',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Download',
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'download' },
    });
  });

  it('should not have download menu button when being casted', () => {
    vi.stubGlobal('navigator', {
      userAgent:
        'Mozilla/5.0 (Fuchsia) AppleWebKit/537.36 (KHTML, like Gecko) ' +
        'Chrome/114.0.0.0 Safari/537.36 CrKey/1.56.500000',
    });

    const cameraManager = createCameraManager();
    const view = createView({
      queryResults: new MediaQueriesResults([new ViewMedia('clip', 'camera-1')], 0),
    });
    mock<CameraManager>(cameraManager).getMediaCapabilities.mockReturnValue(
      createMediaCapabilities({ canDownload: true }),
    );
    const buttons = calculateButtons(controller, {
      cameraManager: cameraManager,
      view: view,
    });
    expect(buttons).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'Download' })]),
    );
  });

  it('should have camera UI button', () => {
    const buttons = calculateButtons(controller, {
      cameraURL: 'http://frigate.domain',
    });
    expect(buttons).toContainEqual({
      icon: 'mdi:web',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Camera user interface',
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'camera_ui' },
    });
  });

  it('should have microphone button', () => {
    const microphoneController = new MicrophoneController();
    const buttons = calculateButtons(controller, {
      microphoneController: microphoneController,
      currentMediaLoadedInfo: createMediaLoadedInfo({
        capabilities: {
          supports2WayAudio: true,
        },
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:microphone',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Microphone',
      style: {
        animation: 'pulse 3s infinite',
        color: 'var(--error-color, white)',
      },
      start_tap_action: {
        action: 'fire-dom-event',
        frigate_card_action: 'microphone_unmute',
      },
      end_tap_action: {
        action: 'fire-dom-event',
        frigate_card_action: 'microphone_mute',
      },
    });
  });

  it('should not have microphone button when media does not support it', () => {
    const microphoneController = new MicrophoneController();
    const buttons = calculateButtons(controller, {
      microphoneController: microphoneController,
      currentMediaLoadedInfo: createMediaLoadedInfo({
        capabilities: {
          supports2WayAudio: false,
        },
      }),
    });

    expect(buttons).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ title: 'Microphone' })]),
    );
  });

  it('should have microphone button when microphone forbidden', () => {
    const microphoneController = new MicrophoneController();
    mock<MicrophoneController>(microphoneController).isForbidden.mockReturnValue(true);
    const buttons = calculateButtons(controller, {
      microphoneController: microphoneController,
      currentMediaLoadedInfo: createMediaLoadedInfo({
        capabilities: {
          supports2WayAudio: true,
        },
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:microphone-message-off',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Microphone',
      style: {},
    });
  });

  it('should have microphone button when microphone muted', () => {
    const microphoneController = new MicrophoneController();
    mock<MicrophoneController>(microphoneController).isMuted.mockReturnValue(true);
    const buttons = calculateButtons(controller, {
      microphoneController: microphoneController,
      currentMediaLoadedInfo: createMediaLoadedInfo({
        capabilities: {
          supports2WayAudio: true,
        },
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:microphone-off',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Microphone',
      style: {},
      start_tap_action: {
        action: 'fire-dom-event',
        frigate_card_action: 'microphone_unmute',
      },
      end_tap_action: {
        action: 'fire-dom-event',
        frigate_card_action: 'microphone_mute',
      },
    });
  });

  it('should have microphone button when microphone muted with toggle type', () => {
    const microphoneController = new MicrophoneController();
    mock<MicrophoneController>(microphoneController).isMuted.mockReturnValue(true);
    const buttons = calculateButtons(controller, {
      microphoneController: microphoneController,
      currentMediaLoadedInfo: createMediaLoadedInfo({
        capabilities: {
          supports2WayAudio: true,
        },
      }),
      config: createConfig({
        menu: { buttons: { microphone: { type: 'toggle' } } },
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:microphone-off',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Microphone',
      style: {},
      tap_action: {
        action: 'fire-dom-event',
        frigate_card_action: 'microphone_unmute',
      },
    });
  });

  it('should have microphone button when microphone unmuted with toggle type', () => {
    const microphoneController = new MicrophoneController();
    mock<MicrophoneController>(microphoneController).isMuted.mockReturnValue(false);
    const buttons = calculateButtons(controller, {
      microphoneController: microphoneController,
      currentMediaLoadedInfo: createMediaLoadedInfo({
        capabilities: {
          supports2WayAudio: true,
        },
      }),
      config: createConfig({
        menu: { buttons: { microphone: { type: 'toggle' } } },
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:microphone',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Microphone',
      style: {
        animation: 'pulse 3s infinite',
        color: 'var(--error-color, white)',
      },
      tap_action: {
        action: 'fire-dom-event',
        frigate_card_action: 'microphone_mute',
      },
    });
  });

  it('should have fullscreen button', () => {
    // Need to write a readonly property.
    Object.defineProperty(screenfull, 'isEnabled', { value: true });
    vi.stubGlobal('navigator', { userAgent: 'foo' });
    const buttons = calculateButtons(controller);

    expect(buttons).toContainEqual({
      icon: 'mdi:fullscreen',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Fullscreen',
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'fullscreen' },
      style: {},
    });
  });

  it('should have unfullscreen', () => {
    // Need to write a readonly property.
    Object.defineProperty(screenfull, 'isEnabled', { value: true });
    Object.defineProperty(screenfull, 'isFullscreen', { value: true });
    vi.stubGlobal('navigator', { userAgent: 'foo' });
    const buttons = calculateButtons(controller);

    expect(buttons).toContainEqual({
      icon: 'mdi:fullscreen-exit',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Fullscreen',
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'fullscreen' },
      style: { color: 'var(--primary-color, white)' },
    });
  });

  it('should have expand button', () => {
    const buttons = calculateButtons(controller);

    expect(buttons).toContainEqual({
      icon: 'mdi:arrow-expand-all',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Expand',
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'expand' },
      style: {},
    });
  });

  it('should have unexpand button', () => {
    const buttons = calculateButtons(controller, { expanded: true });

    expect(buttons).toContainEqual({
      icon: 'mdi:arrow-collapse-all',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Expand',
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'expand' },
      style: { color: 'var(--primary-color, white)' },
    });
  });

  it('should have media players button', () => {
    const cameraManager = createCameraManager({
      configs: new Map([
        [
          'camera-1',
          createCameraConfig({
            camera_entity: 'camera.1',
          }),
        ],
      ]),
    });

    const buttons = calculateButtons(controller, {
      cameraManager: cameraManager,
      mediaPlayers: ['media_player.tv'],
      hass: createHASS({
        'media_player.tv': createStateEntity({ entity_id: 'media_player.tv' }),
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:cast',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-submenu',
      title: 'Send to media player',
      items: [
        {
          enabled: true,
          selected: false,
          icon: 'mdi:cast',
          entity: 'media_player.tv',
          state_color: false,
          title: 'media_player.tv',
          disabled: false,
          tap_action: {
            action: 'fire-dom-event',
            frigate_card_action: 'media_player',
            media_player: 'media_player.tv',
            media_player_action: 'play',
          },
          hold_action: {
            action: 'fire-dom-event',
            frigate_card_action: 'media_player',
            media_player: 'media_player.tv',
            media_player_action: 'stop',
          },
        },
      ],
    });
  });

  it('should disable media players button when entity not found', () => {
    const cameraManager = createCameraManager({
      configs: new Map([
        [
          'camera-1',
          createCameraConfig({
            camera_entity: 'camera.1',
          }),
        ],
      ]),
    });
    const buttons = calculateButtons(controller, {
      cameraManager: cameraManager,
      mediaPlayers: ['player'],
      hass: createHASS(),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:cast',
      enabled: true,
      priority: 50,
      type: 'custom:frigate-card-menu-submenu',
      title: 'Send to media player',
      items: [
        {
          enabled: true,
          selected: false,
          icon: 'mdi:bookmark',
          entity: 'player',
          state_color: false,
          title: 'player',
          disabled: true,
        },
      ],
    });
  });

  it('should have pause button', () => {
    const player = mock<FrigateCardMediaPlayer>();
    const buttons = calculateButtons(controller, {
      currentMediaLoadedInfo: createMediaLoadedInfo({
        capabilities: {
          supportsPause: true,
        },
        player: player,
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:pause',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Play / Pause',
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'pause' },
    });
  });

  it('should have play button', () => {
    const player = mock<FrigateCardMediaPlayer>();
    player.isPaused.mockReturnValue(true);
    const buttons = calculateButtons(controller, {
      currentMediaLoadedInfo: createMediaLoadedInfo({
        capabilities: {
          supportsPause: true,
        },
        player: player,
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:play',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Play / Pause',
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'play' },
    });
  });

  it('should have mute button', () => {
    const player = mock<FrigateCardMediaPlayer>();
    const buttons = calculateButtons(controller, {
      currentMediaLoadedInfo: createMediaLoadedInfo({
        capabilities: {
          hasAudio: true,
        },
        player: player,
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:volume-high',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Mute / Unmute',
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'mute' },
    });
  });

  it('should have unmute button', () => {
    const player = mock<FrigateCardMediaPlayer>();
    player.isMuted.mockReturnValue(true);
    const buttons = calculateButtons(controller, {
      currentMediaLoadedInfo: createMediaLoadedInfo({
        capabilities: {
          hasAudio: true,
        },
        player: player,
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:volume-off',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Mute / Unmute',
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'unmute' },
    });
  });

  it('should have screenshot button', () => {
    const buttons = calculateButtons(controller, {
      currentMediaLoadedInfo: createMediaLoadedInfo({
        player: mock<FrigateCardMediaPlayer>(),
      }),
    });

    expect(buttons).toContainEqual({
      icon: 'mdi:monitor-screenshot',
      enabled: false,
      priority: 50,
      type: 'custom:frigate-card-menu-icon',
      title: 'Screenshot',
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'screenshot' },
    });
  });

  it('should handle dynamic buttons', () => {
    const button: MenuButton = {
      ...dynamicButton,
      style: {},
    };
    controller.addDynamicMenuButton(button);
    expect(calculateButtons(controller)).toContainEqual(button);

    controller.removeDynamicMenuButton(button);
    expect(calculateButtons(controller)).not.toContainEqual(button);
  });

  it('should not set style for dynamic button with stock action', () => {
    const button: MenuButton = {
      ...dynamicButton,
      tap_action: { action: 'navigate', navigation_path: 'foo' },
    };
    controller.addDynamicMenuButton(button);

    expect(calculateButtons(controller)).toContainEqual({
      ...button,
      style: {},
    });
  });

  it('should not set style for dynamic button with non-Frigate fire-dom-event action', () => {
    const button: MenuButton = {
      ...dynamicButton,
      tap_action: { action: 'fire-dom-event' },
    };
    controller.addDynamicMenuButton(button);

    controller.addDynamicMenuButton(dynamicButton);
    expect(calculateButtons(controller)).toContainEqual({
      ...button,
      style: {},
    });
  });

  it('should set style for dynamic button with Frigate view action', () => {
    const button: MenuButton = {
      ...dynamicButton,
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'clips' },
    };

    const view = createView({ view: 'clips' });
    controller.addDynamicMenuButton(button);
    expect(calculateButtons(controller, { view: view })).toContainEqual({
      ...button,
      style: { color: 'var(--primary-color, white)' },
    });
  });

  it('should set style for dynamic button with Frigate default action', () => {
    const button: MenuButton = {
      ...dynamicButton,
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'default' },
    };

    controller.addDynamicMenuButton(button);
    expect(calculateButtons(controller)).toContainEqual({
      ...button,
      style: { color: 'var(--primary-color, white)' },
    });
  });

  it('should set style for dynamic button with fullscreen action', () => {
    // Need to write a readonly property.
    Object.defineProperty(screenfull, 'isEnabled', { value: true });
    Object.defineProperty(screenfull, 'isFullscreen', { value: true });

    const button: MenuButton = {
      ...dynamicButton,
      tap_action: { action: 'fire-dom-event', frigate_card_action: 'fullscreen' },
    };

    controller.addDynamicMenuButton(button);
    expect(calculateButtons(controller)).toContainEqual({
      ...button,
      style: { color: 'var(--primary-color, white)' },
    });
  });

  it('should set style for dynamic button with camera_select action', () => {
    const button: MenuButton = {
      ...dynamicButton,
      tap_action: {
        action: 'fire-dom-event',
        frigate_card_action: 'camera_select',
        camera: 'foo',
      },
    };

    const view = createView({ camera: 'foo' });
    controller.addDynamicMenuButton(button);
    expect(calculateButtons(controller, { view: view })).toContainEqual({
      ...button,
      style: { color: 'var(--primary-color, white)' },
    });
  });

  it('should set style for dynamic button with array of actions', () => {
    const button: MenuButton = {
      ...dynamicButton,
      tap_action: [
        { action: 'fire-dom-event' },
        { action: 'fire-dom-event', frigate_card_action: 'clips' },
      ],
    };

    const view = createView({ camera: 'clips' });
    controller.addDynamicMenuButton(button);
    expect(calculateButtons(controller, { view: view })).toContainEqual({
      ...button,
      style: {},
    });
  });
});
