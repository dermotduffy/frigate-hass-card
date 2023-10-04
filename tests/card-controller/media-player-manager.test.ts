import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  TestViewMedia,
  createCameraConfig,
  createCameraManager,
  createCardAPI,
  createHASS,
  createRegistryEntity,
  createStateEntity,
} from '../test-utils';
import { MediaPlayerManager } from '../../src/card-controller/media-player-manager';
import { ExtendedHomeAssistant } from '../../src/types';
import { MEDIA_PLAYER_SUPPORT_BROWSE_MEDIA } from '../../src/const';
import { EntityRegistryManager } from '../../src/utils/ha/entity-registry';
import { mock } from 'vitest-mock-extended';

vi.mock('../../src/camera-manager/manager.js');

const createHASSWithMediaPlayers = (): ExtendedHomeAssistant => {
  const attributesSupported = {
    supported_features: MEDIA_PLAYER_SUPPORT_BROWSE_MEDIA,
  };
  const attributesUnsupported = {
    supported_features: 0,
  };

  return createHASS({
    'media_player.ok1': createStateEntity({
      entity_id: 'media_player.ok1',
      state: 'on',
      attributes: attributesSupported,
    }),
    'media_player.ok2': createStateEntity({
      entity_id: 'media_player.ok2',
      state: 'on',
      attributes: attributesSupported,
    }),
    'media_player.ok3': createStateEntity({
      entity_id: 'media_player.ok3',
      state: 'on',
      attributes: attributesSupported,
    }),
    'media_player.unavailable': createStateEntity({
      entity_id: 'media_player.sitting_room',
      state: 'unavailable',
      attributes: attributesSupported,
    }),
    'media_player.unsupported': createStateEntity({
      entity_id: 'media_player.sitting_room',
      state: 'on',
      attributes: attributesUnsupported,
    }),
    'switch.unrelated': createStateEntity({
      entity_id: 'switch.unrelated',
      state: 'on',
    }),
  });
};

describe('MediaPlayerManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('should initialize', () => {
    it('correctly', async () => {
      const entityRegistryManager = mock<EntityRegistryManager>();
      entityRegistryManager.getEntities.mockResolvedValue(
        new Map([
          ['media_player.ok1', createRegistryEntity({ hidden_by: '' })],
          ['media_player.ok2', createRegistryEntity({ hidden_by: 'user' })],
        ]),
      );

      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
        createHASSWithMediaPlayers(),
      );
      vi.mocked(api.getEntityRegistryManager).mockReturnValue(entityRegistryManager);
      const manager = new MediaPlayerManager(api);

      await manager.initialize();

      expect(manager.getMediaPlayers()).toEqual([
        'media_player.ok1',
        'media_player.ok3',
      ]);
      expect(manager.hasMediaPlayers()).toBeTruthy();
    });

    it('without hass', async () => {
      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);
      const manager = new MediaPlayerManager(api);

      await manager.initialize();

      expect(manager.getMediaPlayers()).toEqual([]);
      expect(manager.hasMediaPlayers()).toBeFalsy();
    });

    it('even if entity registry call fails', async () => {
      const spy = vi.spyOn(global.console, 'warn').mockImplementation(() => true);

      const entityRegistryManager = mock<EntityRegistryManager>();
      entityRegistryManager.getEntities.mockRejectedValue(new Error('message'));

      const api = createCardAPI();
      vi.mocked(api.getHASSManager().getHASS).mockReturnValue(
        createHASSWithMediaPlayers(),
      );
      vi.mocked(api.getEntityRegistryManager).mockReturnValue(entityRegistryManager);
      const manager = new MediaPlayerManager(api);

      await manager.initialize();

      expect(manager.getMediaPlayers()).toEqual([
        'media_player.ok1',
        'media_player.ok2',
        'media_player.ok3',
      ]);
      expect(manager.hasMediaPlayers()).toBeTruthy();
      expect(spy).toBeCalled();
    });
  });

  it('should stop', async () => {
    const api = createCardAPI();
    vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());

    const manager = new MediaPlayerManager(api);

    await manager.stop('media_player.foo');

    expect(api.getHASSManager().getHASS()?.callService).toBeCalledWith(
      'media_player',
      'media_stop',
      {
        entity_id: 'media_player.foo',
      },
    );
  });

  describe('should play', () => {
    describe('live', () => {
      it('successfully', async () => {
        const api = createCardAPI();
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getStore().getCameraConfig).mockReturnValue(
          createCameraConfig({
            camera_entity: 'camera.foo',
          }),
        );
        vi.mocked(cameraManager.getCameraMetadata).mockReturnValue({
          title: 'camera title',
          icon: 'icon',
        });
        vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);
        const hass = createHASS({
          'camera.foo': createStateEntity({
            attributes: {
              entity_picture: 'http://thumbnail',
            },
          }),
        });
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(hass);
        const manager = new MediaPlayerManager(api);

        await manager.playLive('media_player.foo', 'camera');

        expect(api.getHASSManager().getHASS()?.callService).toBeCalledWith(
          'media_player',
          'play_media',
          {
            entity_id: 'media_player.foo',
            media_content_id: 'media-source://camera/camera.foo',
            media_content_type: 'application/vnd.apple.mpegurl',
            extra: {
              title: 'camera title',
              thumb: 'http://thumbnail',
            },
          },
        );
      });

      it('without camera_entity', async () => {
        const api = createCardAPI();
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getStore().getCameraConfig).mockReturnValue(
          createCameraConfig({}),
        );
        vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
        const manager = new MediaPlayerManager(api);

        await manager.playLive('media_player.foo', 'camera');

        expect(api.getHASSManager().getHASS()?.callService).not.toBeCalled();
      });

      it('without title and thumbnail', async () => {
        const api = createCardAPI();
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getStore().getCameraConfig).mockReturnValue(
          createCameraConfig({
            camera_entity: 'camera.foo',
          }),
        );
        vi.mocked(api.getCameraManager).mockReturnValue(cameraManager);
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
        const manager = new MediaPlayerManager(api);

        await manager.playLive('media_player.foo', 'camera');

        expect(api.getHASSManager().getHASS()?.callService).toBeCalledWith(
          'media_player',
          'play_media',
          {
            entity_id: 'media_player.foo',
            media_content_id: 'media-source://camera/camera.foo',
            media_content_type: 'application/vnd.apple.mpegurl',
            extra: {},
          },
        );
      });
    });

    describe('media', () => {
      describe('successfully with', () => {
        it.each([
          ['clip' as const, 'video' as const],
          ['snapshot' as const, 'image' as const],
        ])(
          '%s',
          async (mediaType: 'clip' | 'snapshot', contentType: 'video' | 'image') => {
            const media = new TestViewMedia({
              title: 'media title',
              thumbnail: 'http://thumbnail',
              contentID: 'media-source://contentid',
              mediaType: mediaType,
            });
            const api = createCardAPI();
            vi.mocked(api.getHASSManager().getHASS).mockReturnValue(createHASS());
            const manager = new MediaPlayerManager(api);

            await manager.playMedia('media_player.foo', media);

            expect(api.getHASSManager().getHASS()?.callService).toBeCalledWith(
              'media_player',
              'play_media',
              {
                entity_id: 'media_player.foo',
                media_content_id: 'media-source://contentid',
                media_content_type: contentType,
                extra: {
                  title: 'media title',
                  thumb: 'http://thumbnail',
                },
              },
            );
          },
        );
      });

      it('without hass', async () => {
        const api = createCardAPI();
        vi.mocked(api.getHASSManager().getHASS).mockReturnValue(null);
        const manager = new MediaPlayerManager(api);
        const media = new TestViewMedia();

        await manager.playMedia('media_player.foo', media);

        // No actual test can be performed here as nothing observable happens.
        // This test serves only as code-coverage long-tail.
      });
    });
  });
});
