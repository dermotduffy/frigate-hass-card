import { describe, expect, it } from 'vitest';
import {
  conditionalSchema,
  customSchema,
  dimensionsConfigSchema,
  frigateCardCustomActionsBaseSchema,
  frigateCardPTZSchema,
} from '../../src/config/types';
import { createConfig } from '../test-utils';

// @vitest-environment jsdom
describe('config defaults', () => {
  it('should be as expected', () => {
    expect(createConfig()).toEqual({
      cameras: [],
      cameras_global: {
        dependencies: {
          all_cameras: false,
          cameras: [],
        },
        engine: 'auto',
        frigate: {
          client_id: 'frigate',
        },
        hide: false,
        image: {
          refresh_seconds: 1,
        },
        live_provider: 'auto',
        motioneye: {
          images: {
            directory_pattern: '%Y-%m-%d',
            file_pattern: '%H-%M-%S',
          },
          movies: {
            directory_pattern: '%Y-%m-%d',
            file_pattern: '%H-%M-%S',
          },
        },
        triggers: {
          entities: [],
          motion: false,
          occupancy: true,
        },
      },
      debug: {
        logging: false,
      },
      dimensions: {
        aspect_ratio: [16, 9],
        aspect_ratio_mode: 'dynamic',
        max_height: '100vh',
        min_height: '100px',
      },
      image: {
        mode: 'url',
        refresh_seconds: 1,
        zoomable: true,
      },
      live: {
        auto_mute: 'all',
        auto_pause: 'never',
        auto_play: 'all',
        auto_unmute: 'never',
        controls: {
          builtin: true,
          next_previous: {
            size: 48,
            style: 'chevrons',
          },
          ptz: {
            hide_home: false,
            hide_pan_tilt: false,
            hide_zoom: false,
            mode: 'on',
            orientation: 'horizontal',
            position: 'bottom-right',
          },
          thumbnails: {
            media: 'all',
            mode: 'right',
            show_details: true,
            show_download_control: true,
            show_favorite_control: true,
            show_timeline_control: true,
            size: 100,
          },
          timeline: {
            clustering_threshold: 3,
            media: 'all',
            mode: 'none',
            show_recordings: true,
            style: 'ribbon',
            window_seconds: 3600,
          },
        },
        draggable: true,
        lazy_load: true,
        lazy_unload: 'never',
        microphone: {
          always_connected: false,
          disconnect_seconds: 60,
        },
        preload: false,
        show_image_during_load: true,
        transition_effect: 'slide',
        zoomable: true,
      },
      media_gallery: {
        controls: {
          filter: {
            mode: 'right',
          },
          thumbnails: {
            mode: 'right',
            show_details: false,
            show_download_control: true,
            show_favorite_control: true,
            show_timeline_control: true,
            size: 100,
          },
        },
      },
      media_viewer: {
        auto_mute: 'all',
        auto_pause: 'all',
        auto_play: 'all',
        auto_unmute: 'never',
        controls: {
          builtin: true,
          next_previous: {
            size: 48,
            style: 'thumbnails',
          },
          thumbnails: {
            mode: 'right',
            show_details: true,
            show_download_control: true,
            show_favorite_control: true,
            show_timeline_control: true,
            size: 100,
          },
          timeline: {
            clustering_threshold: 3,
            media: 'all',
            mode: 'none',
            show_recordings: true,
            style: 'ribbon',
            window_seconds: 3600,
          },
        },
        draggable: true,
        lazy_load: true,
        snapshot_click_plays_clip: true,
        transition_effect: 'slide',
        zoomable: true,
      },
      menu: {
        alignment: 'left',
        button_size: 40,
        buttons: {
          camera_ui: {
            enabled: true,
            priority: 50,
          },
          cameras: {
            enabled: true,
            priority: 50,
          },
          clips: {
            enabled: true,
            priority: 50,
          },
          display_mode: {
            enabled: true,
            priority: 50,
          },
          download: {
            enabled: true,
            priority: 50,
          },
          expand: {
            enabled: false,
            priority: 50,
          },
          frigate: {
            enabled: true,
            priority: 50,
          },
          fullscreen: {
            enabled: true,
            priority: 50,
          },
          image: {
            enabled: false,
            priority: 50,
          },
          live: {
            enabled: true,
            priority: 50,
          },
          media_player: {
            enabled: true,
            priority: 50,
          },
          microphone: {
            enabled: false,
            priority: 50,
            type: 'momentary',
          },
          mute: {
            enabled: false,
            priority: 50,
          },
          play: {
            enabled: false,
            priority: 50,
          },
          ptz: {
            enabled: false,
            priority: 50,
          },
          recordings: {
            enabled: false,
            priority: 50,
          },
          screenshot: {
            enabled: false,
            priority: 50,
          },
          snapshots: {
            enabled: true,
            priority: 50,
          },
          substreams: {
            enabled: true,
            priority: 50,
          },
          timeline: {
            enabled: true,
            priority: 50,
          },
        },
        position: 'top',
        style: 'hidden',
      },
      performance: {
        features: {
          animated_progress_indicator: true,
          media_chunk_size: 50,
        },
        profile: 'high',
        style: {
          border_radius: true,
          box_shadow: true,
        },
      },
      timeline: {
        clustering_threshold: 3,
        controls: {
          thumbnails: {
            mode: 'right',
            show_details: true,
            show_download_control: true,
            show_favorite_control: true,
            show_timeline_control: true,
            size: 100,
          },
        },
        media: 'all',
        show_recordings: true,
        style: 'stack',
        window_seconds: 3600,
      },
      type: 'frigate-hass-card',
      view: {
        camera_select: 'current',
        dark_mode: 'off',
        default: 'live',
        scan: {
          enabled: false,
          show_trigger_status: true,
          untrigger_seconds: 0,
          actions: {
            trigger: 'live',
            untrigger: 'default',
            interaction_mode: 'inactive',
          },
          filter_selected_camera: false,
        },
        interaction_seconds: 300,
        reset_after_interaction: true,
        update_cycle_camera: false,
        update_force: false,
        update_seconds: 0,
      },
    });
  });
});

it('should transform dimensions.aspect_ratio', () => {
  expect(
    dimensionsConfigSchema.parse({
      aspect_ratio: '16 / 9',
    }),
  ).toEqual(expect.objectContaining({ aspect_ratio: [16, 9] }));

  expect(
    dimensionsConfigSchema.parse({
      aspect_ratio: '16 : 9',
    }),
  ).toEqual(expect.objectContaining({ aspect_ratio: [16, 9] }));

  expect(
    dimensionsConfigSchema.parse({
      aspect_ratio: [16, 9],
    }),
  ).toEqual(expect.objectContaining({ aspect_ratio: [16, 9] }));
});

it('should transform action', () => {
  expect(
    frigateCardCustomActionsBaseSchema.parse({
      action: 'custom:frigate-card-action',
    }),
  ).toEqual({
    action: 'fire-dom-event',
  });
});

describe('should convert webrtc card PTZ to Frigate card PTZ', () => {
  it.each([
    ['left' as const],
    ['right' as const],
    ['up' as const],
    ['down' as const],
    ['zoom_in' as const],
    ['zoom_out' as const],
    ['home' as const],
  ])('%s', (action: string) => {
    expect(
      frigateCardPTZSchema.parse({
        type: 'custom:frigate-card-ptz',
        service: 'foo',
        [`data_${action}`]: {
          tap_action: {
            action: 'none',
          },
        },
      }),
    ).toEqual({
      [`actions_${action}`]: {
        tap_action: {
          action: 'call-service',
          service: 'foo',
          data: {
            tap_action: {
              action: 'none',
            },
          },
        },
      },
      service: 'foo',

      hide_home: false,
      hide_pan_tilt: false,
      hide_zoom: false,
      mode: 'on',
      orientation: 'horizontal',
      position: 'bottom-right',
    });
  });
});

describe('should lazy evaluate', () => {
  it('conditional picture element', () => {
    expect(
      conditionalSchema.parse({
        type: 'conditional',
        conditions: [
          {
            entity: 'light.office_main_lights',
            state: 'on',
            state_not: 'off',
          },
        ],
        elements: [
          {
            type: 'icon',
            icon: 'mdi:dog',
            title: 'Woof',
            style: {
              left: '100px',
              top: '400px',
            },
          },
        ],
      }),
    ).toEqual({
      conditions: [
        {
          entity: 'light.office_main_lights',
          state: 'on',
          state_not: 'off',
        },
      ],
      elements: [
        {
          icon: 'mdi:dog',
          style: {
            left: '100px',
            top: '400px',
          },
          title: 'Woof',
          type: 'icon',
        },
      ],
      type: 'conditional',
    });
  });
});

describe('should handle custom frigate elements', () => {
  it('should add custom error on frigate entry', () => {
    const result = customSchema.safeParse({
      type: 'custom:frigate-card-foo',
    });
    expect(result.success).toBeFalsy();
    if (!result.success) {
      expect(result.error.errors[0]).toEqual({
        code: 'custom',
        message: 'Frigate-card custom elements must match specific schemas',
        fatal: true,
        path: ['type'],
      });
    }
  });

  it('should not add custom error on valid entry', () => {
    const result = customSchema.safeParse({
      type: 'custom:foo',
    });
    expect(result.success).toBeTruthy();
  });
});

// https://github.com/dermotduffy/frigate-hass-card/issues/1280
it('should not require title controls to specify all options', () => {
  expect(
    createConfig({
      cameras: [],
      live: {
        controls: {
          title: {
            mode: 'popup-top-left',
          },
        },
      },
    }),
  ).toBeTruthy();
});

it('should strip trailing slashes from go2rtc url', () => {
  const config = createConfig({
    cameras: [
      {
        go2rtc: {
          url: 'https://my-custom-go2rtc//',
        },
      },
    ],
  });
  expect(config).toBeTruthy();
  expect(config.cameras[0].go2rtc.url).toBe('https://my-custom-go2rtc');
});
