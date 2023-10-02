import { MEDIA_PLAYER_SUPPORT_BROWSE_MEDIA } from '../../const';
import { ViewMedia } from '../../view/media';
import { ViewMediaClassifier } from '../../view/media-classifier';
import { errorToConsole } from '../basic';
import { Entity } from '../ha/entity-registry/types';
import { supportsFeature } from '../ha/update';
import { CardMediaPlayerAPI } from './types';

export class MediaPlayerManager {
  protected _mediaPlayers: string[] = [];

  protected _api: CardMediaPlayerAPI;

  constructor(api: CardMediaPlayerAPI) {
    this._api = api;
  }

  public getMediaPlayers(): string[] {
    return this._mediaPlayers;
  }

  public hasMediaPlayers(): boolean {
    return this._mediaPlayers.length > 0;
  }

  public async initialize(): Promise<void> {
    const hass = this._api.getHASSManager().getHASS();
    if (!hass) {
      return;
    }

    const isValidMediaPlayer = (entityID: string): boolean => {
      if (entityID.startsWith('media_player.')) {
        const stateObj = hass.states[entityID];
        if (
          stateObj &&
          stateObj.state !== 'unavailable' &&
          supportsFeature(stateObj, MEDIA_PLAYER_SUPPORT_BROWSE_MEDIA)
        ) {
          return true;
        }
      }
      return false;
    };

    const mediaPlayers = Object.keys(hass.states).filter(isValidMediaPlayer);
    let mediaPlayerEntities: Map<string, Entity> | null = null;
    try {
      mediaPlayerEntities = await this._api
        .getEntityRegistryManager()
        .getEntities(hass, mediaPlayers);
    } catch (e) {
      // Failing to fetch media player information is not considered
      // sufficiently serious to block card startup -- it is just logged and we
      // move on.
      errorToConsole(e as Error);
    }

    // Filter out entities that are marked as hidden (this information is not
    // available in the HA state, only in the registry).
    this._mediaPlayers = mediaPlayers.filter((entityID) => {
      // Specifically allow for media players that are not found in the entity registry:
      // See: https://github.com/dermotduffy/frigate-hass-card/issues/1016
      const entity = mediaPlayerEntities?.get(entityID);
      return !entity || !entity.hidden_by;
    });
  }

  public async stop(mediaPlayer: string): Promise<void> {
    await this._api
      .getHASSManager()
      .getHASS()
      ?.callService('media_player', 'media_stop', {
        entity_id: mediaPlayer,
      });
  }

  public async playLive(mediaPlayer: string, cameraID: string): Promise<void> {
    const hass = this._api.getHASSManager().getHASS();
    const cameraConfig = this._api
      .getCameraManager()
      .getStore()
      .getCameraConfig(cameraID);
    const cameraEntity = cameraConfig?.camera_entity ?? null;

    if (!hass || !cameraEntity) {
      return;
    }

    const title =
      this._api.getCameraManager().getCameraMetadata(cameraID)?.title ?? null;
    const thumbnail = hass.states[cameraEntity]?.attributes?.entity_picture ?? null;

    await hass.callService('media_player', 'play_media', {
      entity_id: mediaPlayer,
      media_content_id: `media-source://camera/${cameraEntity}`,
      media_content_type: 'application/vnd.apple.mpegurl',
      extra: {
        ...(title && { title: title }),
        ...(thumbnail && { thumb: thumbnail }),
      },
    });
  }

  public async playMedia(mediaPlayer: string, media?: ViewMedia | null): Promise<void> {
    const hass = this._api.getHASSManager().getHASS();

    if (!hass || !media) {
      return;
    }

    const title = media.getTitle();
    const thumbnail = media.getThumbnail();

    await hass.callService('media_player', 'play_media', {
      entity_id: mediaPlayer,
      media_content_id: media.getContentID(),
      media_content_type: ViewMediaClassifier.isVideo(media) ? 'video' : 'image',
      extra: {
        ...(title && { title: title }),
        ...(thumbnail && { thumb: thumbnail }),
      },
    });
  }
}
