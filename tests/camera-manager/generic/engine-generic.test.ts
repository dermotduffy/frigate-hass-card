import { describe, expect, it } from 'vitest';
import { mock } from 'vitest-mock-extended';
import { GenericCameraManagerEngine } from '../../../src/camera-manager/generic/engine-generic';
import { Engine, QueryResultsType, QueryType } from '../../../src/camera-manager/types';
import { CameraConfig, RawFrigateCardConfig } from '../../../src/config/types';
import { EntityRegistryManager } from '../../../src/utils/ha/entity-registry';
import {
  TestViewMedia,
  createCameraConfig,
  createHASS,
  createStateEntity,
} from '../../test-utils';

const createEngine = (): GenericCameraManagerEngine => {
  return new GenericCameraManagerEngine();
};

const createGenericCameraConfig = (config?: RawFrigateCardConfig): CameraConfig => {
  return createCameraConfig(config);
};

describe('GenericCameraManagerEngine', () => {
  it('should get engine type', () => {
    expect(createEngine().getEngineType()).toBe(Engine.Generic);
  });

  it('should initialize camera', async () => {
    const config = createGenericCameraConfig();
    expect(
      await createEngine().initializeCamera(
        createHASS(),
        mock<EntityRegistryManager>(),
        config,
      ),
    ).toEqual(config);
  });

  it('should generate default event query', () => {
    expect(
      createEngine().generateDefaultEventQuery(
        new Map([['camera-1', createGenericCameraConfig()]]),
        new Set(['camera-1']),
        {},
      ),
    ).toBeNull();
  });

  it('should generate default recording query', () => {
    expect(
      createEngine().generateDefaultRecordingQuery(
        new Map([['camera-1', createGenericCameraConfig()]]),
        new Set(['camera-1']),
        {},
      ),
    ).toBeNull();
  });

  it('should generate default recording segments query', () => {
    expect(
      createEngine().generateDefaultRecordingSegmentsQuery(
        new Map([['camera-1', createGenericCameraConfig()]]),
        new Set(['camera-1']),
        {},
      ),
    ).toBeNull();
  });

  it('should get events', async () => {
    expect(
      await createEngine().getEvents(
        createHASS(),
        new Map([['camera-1', createGenericCameraConfig()]]),
        { type: QueryType.Event, cameraIDs: new Set(['camera-1']) },
      ),
    ).toBeNull();
  });

  it('should get recordings', async () => {
    expect(
      await createEngine().getRecordings(
        createHASS(),
        new Map([['camera-1', createGenericCameraConfig()]]),
        { type: QueryType.Recording, cameraIDs: new Set(['camera-1']) },
      ),
    ).toBeNull();
  });

  it('should get recording segments', async () => {
    expect(
      await createEngine().getRecordingSegments(
        createHASS(),
        new Map([['camera-1', createGenericCameraConfig()]]),
        {
          type: QueryType.RecordingSegments,
          cameraIDs: new Set(['camera-1']),
          start: new Date(),
          end: new Date(),
        },
      ),
    ).toBeNull();
  });

  it('should generate media from events', async () => {
    expect(
      createEngine().generateMediaFromEvents(
        createHASS(),
        new Map([['camera-1', createGenericCameraConfig()]]),
        {
          type: QueryType.Event,
          cameraIDs: new Set(['camera-1']),
        },
        {
          type: QueryResultsType.Event,
          engine: Engine.Generic,
        },
      ),
    ).toBeNull();
  });

  it('should generate media from recordings', async () => {
    expect(
      createEngine().generateMediaFromRecordings(
        createHASS(),
        new Map([['camera-1', createGenericCameraConfig()]]),
        {
          type: QueryType.Recording,
          cameraIDs: new Set(['camera-1']),
          start: new Date(),
          end: new Date(),
        },
        {
          type: QueryResultsType.Recording,
          engine: Engine.Generic,
        },
      ),
    ).toBeNull();
  });

  it('should get media download path', async () => {
    expect(
      await createEngine().getMediaDownloadPath(
        createHASS(),
        createGenericCameraConfig(),
        new TestViewMedia(),
      ),
    ).toBeNull();
  });

  it('should favorite media', async () => {
    expect(
      await createEngine().favoriteMedia(
        createHASS(),
        createGenericCameraConfig(),
        new TestViewMedia(),
        true,
      ),
    ).toBeUndefined();
  });

  it('should get query result max age', () => {
    expect(
      createEngine().getQueryResultMaxAge({
        type: QueryType.Event,
        cameraIDs: new Set(['camera-1']),
      }),
    ).toBeNull();
  });

  it('should get media seek time', async () => {
    expect(
      await createEngine().getMediaSeekTime(
        createHASS(),
        new Map([['camera-1', createGenericCameraConfig()]]),
        new TestViewMedia(),
        new Date(),
      ),
    ).toBeNull();
  });

  it('should get media metadata', async () => {
    expect(
      await createEngine().getMediaMetadata(
        createHASS(),
        new Map([['camera-1', createGenericCameraConfig()]]),
        { type: QueryType.MediaMetadata, cameraIDs: new Set(['camera-1']) },
      ),
    ).toBeNull();
  });

  describe('should get camera metadata', () => {
    it('with empty config', async () => {
      expect(
        createEngine().getCameraMetadata(createHASS(), createGenericCameraConfig()),
      ).toEqual({
        icon: 'mdi:video',
        title: '',
      });
    });

    it('with id', async () => {
      expect(
        createEngine().getCameraMetadata(
          createHASS(),
          createGenericCameraConfig({ id: 'https://go2rtc#stream' }),
        ),
      ).toEqual({
        icon: 'mdi:video',
        title: 'https://go2rtc#stream',
      });
    });

    it('with configured title', async () => {
      expect(
        createEngine().getCameraMetadata(
          createHASS(),
          createGenericCameraConfig({
            title: 'My Camera',
          }),
        ),
      ).toEqual({
        icon: 'mdi:video',
        title: 'My Camera',
      });
    });

    describe('with entity title', () => {
      it('camera_entity', async () => {
        expect(
          createEngine().getCameraMetadata(
            createHASS({
              'camera.test': createStateEntity({
                attributes: { friendly_name: 'My Entity Camera' },
              }),
            }),
            createGenericCameraConfig({
              camera_entity: 'camera.test',
            }),
          ),
        ).toEqual({
          icon: 'mdi:video',
          title: 'My Entity Camera',
        });
      });

      it('webrtc_card.entity', async () => {
        expect(
          createEngine().getCameraMetadata(
            createHASS({
              'camera.test': createStateEntity({
                attributes: { friendly_name: 'My Entity Camera' },
              }),
            }),
            createGenericCameraConfig({
              webrtc_card: {
                entity: 'camera.test',
              },
            }),
          ),
        ).toEqual({
          icon: 'mdi:video',
          title: 'My Entity Camera',
        });
      });
    });
  });

  it('should get camera capabilities metadata', async () => {
    expect(createEngine().getCameraCapabilities(createGenericCameraConfig())).toEqual({
      canFavoriteEvents: false,
      canFavoriteRecordings: false,
      canSeek: false,
      supportsClips: false,
      supportsRecordings: false,
      supportsSnapshots: false,
      supportsTimeline: false,
    });
  });

  it('should get media capabilities', () => {
    expect(createEngine().getMediaCapabilities(new TestViewMedia())).toBeNull();
  });

  describe('should get camera endpoints', () => {
    it('default', () => {
      expect(createEngine().getCameraEndpoints(createGenericCameraConfig())).toBeNull();
    });

    it('for go2rtc', () => {
      expect(
        createEngine().getCameraEndpoints(
          createGenericCameraConfig({
            go2rtc: {
              stream: 'stream',
              url: '/local/path',
            },
          }),
        ),
      ).toEqual({
        go2rtc: {
          endpoint: '/local/path/api/ws?src=stream',
          sign: true,
        },
      });
    });
  });
});
