import endOfDay from 'date-fns/endOfDay';
import startOfDay from 'date-fns/startOfDay';
import sub from 'date-fns/sub';
import { LitElement } from 'lit';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { CameraManagerStore } from '../../src/camera-manager/store';
import { QueryType } from '../../src/camera-manager/types';
import {
  MediaFilterController,
  MediaFilterCoreDefaults,
  MediaFilterCoreFavoriteSelection,
  MediaFilterCoreWhen,
  MediaFilterMediaType
} from '../../src/components-lib/media-filter-controller';
import { executeMediaQueryForViewWithErrorDispatching } from '../../src/utils/media-to-view';
import {
  EventMediaQueries,
  MediaQueries,
  RecordingMediaQueries
} from '../../src/view/media-queries';
import {
  createAggregateCameraCapabilities,
  createCameraConfig,
  createCameraManager,
  createPerformanceConfig,
  createStore,
  createView
} from '../test-utils';

vi.mock('../../src/utils/media-to-view');

const createHost = (): LitElement => {
  const host = document.createElement('div') as unknown as LitElement;
  host.requestUpdate = vi.fn();
  return host;
};

const createCameraStore = (): CameraManagerStore => {
  return createStore([
    {
      cameraID: 'camera.kitchen',
      config: createCameraConfig({
        camera_entity: 'camera.kitchen',
      }),
    },
  ]);
};

// @vitest-environment jsdom
describe('MediaFilterController', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('should have correct default options', () => {
    it('media type', () => {
      const controller = new MediaFilterController(createHost());
      expect(controller.getMediaTypeOptions()).toEqual([
        {
          value: MediaFilterMediaType.Clips,
          label: 'Clips',
        },
        {
          value: MediaFilterMediaType.Snapshots,
          label: 'Snapshots',
        },
        {
          value: MediaFilterMediaType.Recordings,
          label: 'Recordings',
        },
      ]);
    });

    it('favorite', () => {
      const controller = new MediaFilterController(createHost());
      expect(controller.getFavoriteOptions()).toEqual([
        {
          value: MediaFilterCoreFavoriteSelection.Favorite,
          label: 'Favorite',
        },
        {
          value: MediaFilterCoreFavoriteSelection.NotFavorite,
          label: 'Not Favorite',
        },
      ]);
    });

    it('when', () => {
      const controller = new MediaFilterController(createHost());
      expect(controller.getWhenOptions()).toEqual([
        {
          value: MediaFilterCoreWhen.Today,
          label: 'Today',
        },
        {
          value: MediaFilterCoreWhen.Yesterday,
          label: 'Yesterday',
        },
        {
          value: MediaFilterCoreWhen.PastWeek,
          label: 'Past Week',
        },
        {
          value: MediaFilterCoreWhen.PastMonth,
          label: 'Past Month',
        },
        {
          value: MediaFilterCoreWhen.Custom,
          label: 'Custom',
        },
      ]);
    });

    it('cameras', () => {
      const controller = new MediaFilterController(createHost());
      expect(controller.getCameraOptions()).toEqual([]);
    });

    it('what', () => {
      const controller = new MediaFilterController(createHost());
      expect(controller.getWhatOptions()).toEqual([]);
    });

    it('where', () => {
      const controller = new MediaFilterController(createHost());
      expect(controller.getWhereOptions()).toEqual([]);
    });

    it('tags', () => {
      const controller = new MediaFilterController(createHost());
      expect(controller.getTagsOptions()).toEqual([]);
    });
  });

  describe('should calculate correct dynamic options', () => {
    describe('cameras', () => {
      it('with valid camera', () => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getCameraMetadata).mockReturnValue({
          title: 'Kitchen Camera',
          icon: 'mdi:camera',
        });
        vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

        const controller = new MediaFilterController(createHost());
        controller.computeCameraOptions(cameraManager);
        expect(controller.getCameraOptions()).toEqual([
          {
            label: 'Kitchen Camera',
            value: 'camera.kitchen',
          },
        ]);
      });

      it('without camera metadata', () => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getCameraMetadata).mockReturnValue(null);
        vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

        const controller = new MediaFilterController(createHost());
        controller.computeCameraOptions(cameraManager);
        expect(controller.getCameraOptions()).toEqual([
          {
            label: 'camera.kitchen',
            value: 'camera.kitchen',
          },
        ]);
      });
    });

    describe('metadata', () => {
      it('with failed getMediaMetadata call', async () => {
        vi.spyOn(global.console, 'warn').mockReturnValue(undefined);

        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getMediaMetadata).mockRejectedValue(new Error('error'));

        const host = createHost();
        const controller = new MediaFilterController(host);
        await controller.computeMetadataOptions(cameraManager);
        expect(host.requestUpdate).not.toBeCalled();
      });

      it('with metadata for what', async () => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getMediaMetadata).mockResolvedValue({
          what: new Set(['person', 'car']),
        });

        const host = createHost();
        const controller = new MediaFilterController(host);
        await controller.computeMetadataOptions(cameraManager);
        expect(controller.getWhatOptions()).toEqual([
          {
            value: 'car',
            label: 'Car',
          },
          {
            value: 'person',
            label: 'Person',
          },
        ]);
        expect(host.requestUpdate).toBeCalled();
      });

      it('with metadata for where', async () => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getMediaMetadata).mockResolvedValue({
          where: new Set(['front_door', 'back_yard']),
        });

        const host = createHost();
        const controller = new MediaFilterController(host);
        await controller.computeMetadataOptions(cameraManager);
        expect(controller.getWhereOptions()).toEqual([
          {
            value: 'back_yard',
            label: 'Back Yard',
          },
          {
            value: 'front_door',
            label: 'Front Door',
          },
        ]);
        expect(host.requestUpdate).toBeCalled();
      });

      it('with metadata for tags', async () => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getMediaMetadata).mockResolvedValue({
          tags: new Set(['tag-1', 'tag-2']),
        });

        const host = createHost();
        const controller = new MediaFilterController(host);
        await controller.computeMetadataOptions(cameraManager);
        expect(controller.getTagsOptions()).toEqual([
          {
            value: 'tag-1',
            label: 'Tag-1',
          },
          {
            value: 'tag-2',
            label: 'Tag-2',
          },
        ]);
        expect(host.requestUpdate).toBeCalled();
      });

      it('with metadata for days', async () => {
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getMediaMetadata).mockResolvedValue({
          days: new Set(['2024-02-04', '2024-02-05']),
        });

        const host = createHost();
        const controller = new MediaFilterController(host);
        await controller.computeMetadataOptions(cameraManager);

        expect(controller.getWhenOptions()).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              value: '2024-02-01,2024-02-29',
              label: 'February 2024',
            }),
          ]),
        );
        expect(host.requestUpdate).toBeCalled();
      });
    });
  });

  describe('should get correct controls to show', () => {
    it('view with events', () => {
      const view = createView({ query: new EventMediaQueries() });
      const cameraManager = createCameraManager();

      const controller = new MediaFilterController(createHost());
      expect(controller.getControlsToShow(cameraManager, view)).toMatchObject({
        events: true,
        recordings: false,
      });
    });

    it('view with recordings', () => {
      const view = createView({ query: new RecordingMediaQueries() });
      const cameraManager = createCameraManager();

      const controller = new MediaFilterController(createHost());
      expect(controller.getControlsToShow(cameraManager, view)).toMatchObject({
        events: false,
        recordings: true,
      });
    });

    it('can favorite events', () => {
      const view = createView({ query: new EventMediaQueries() });
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getAggregateCameraCapabilities).mockReturnValue(
        createAggregateCameraCapabilities({ canFavoriteEvents: true }),
      );

      const controller = new MediaFilterController(createHost());
      expect(controller.getControlsToShow(cameraManager, view)).toMatchObject({
        favorites: true,
      });
    });

    it('can favorite recordings', () => {
      const view = createView({ query: new RecordingMediaQueries() });
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getAggregateCameraCapabilities).mockReturnValue(
        createAggregateCameraCapabilities({ canFavoriteRecordings: true }),
      );

      const controller = new MediaFilterController(createHost());
      expect(controller.getControlsToShow(cameraManager, view)).toMatchObject({
        favorites: true,
      });
    });

    it('can not favorite without a query', () => {
      const view = createView();
      const cameraManager = createCameraManager();

      const controller = new MediaFilterController(createHost());
      expect(controller.getControlsToShow(cameraManager, view)).toMatchObject({
        favorites: false,
      });
    });
  });

  describe('should handle value change', () => {
    it('must have visible cameras', async () => {
      const host = createHost();
      const controller = new MediaFilterController(host);
      await controller.valueChangeHandler(
        createCameraManager(),
        createView(),
        {},
        { when: {} },
      );

      expect(host.requestUpdate).not.toBeCalled();
    });

    describe('with events media type', () => {
      it.each([['clips' as const], ['snapshots' as const]])(
        '%s',
        async (viewName: 'clips' | 'snapshots') => {
          const eventListener = vi.fn();
          const host = createHost();
          host.addEventListener('frigate-card:view:change', eventListener);

          const controller = new MediaFilterController(host);
          const cameraManager = createCameraManager();
          const view = createView();
          vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());
          vi.mocked(executeMediaQueryForViewWithErrorDispatching).mockResolvedValueOnce(
            view,
          );

          const from = new Date('2024-02-06T21:59');
          const to = new Date('2024-02-06T22:00');

          await controller.valueChangeHandler(
            cameraManager,
            view,
            {
              performance: createPerformanceConfig({
                features: {
                  media_chunk_size: 11,
                },
              }),
            },
            {
              mediaType:
                viewName === 'clips'
                  ? MediaFilterMediaType.Clips
                  : MediaFilterMediaType.Snapshots,
              when: {
                to: to,
                from: from,
              },
              tags: ['tag-1', 'tag-2'],
              what: ['what-1', 'what-2'],
              where: ['where-1', 'where-2'],
              favorite: MediaFilterCoreFavoriteSelection.Favorite,
            },
          );

          expect(vi.mocked(executeMediaQueryForViewWithErrorDispatching)).toBeCalledWith(
            host,
            cameraManager,
            view,
            expect.anything(),
            {
              targetCameraID: 'camera.kitchen',
              targetView: viewName,
            },
          );
          expect(
            vi
              .mocked(executeMediaQueryForViewWithErrorDispatching)
              .mock.calls[0][3].getQueries(),
          ).toEqual([
            {
              cameraIDs: new Set(['camera.kitchen']),
              ...(viewName === 'clips' && { hasClip: true }),
              ...(viewName === 'snapshots' && { hasSnapshot: true }),
              type: 'event-query',
              tags: new Set(['tag-1', 'tag-2']),
              what: new Set(['what-1', 'what-2']),
              where: new Set(['where-1', 'where-2']),
              favorite: true,
              start: from,
              end: to,
              limit: 11,
            },
          ]);

          expect(eventListener).toBeCalled();
          expect(host.requestUpdate).toBeCalled();
        },
      );
    });

    it('with recordings media type', async () => {
      const eventListener = vi.fn();
      const host = createHost();
      host.addEventListener('frigate-card:view:change', eventListener);

      const controller = new MediaFilterController(host);
      const cameraManager = createCameraManager();
      const view = createView();
      vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());
      vi.mocked(executeMediaQueryForViewWithErrorDispatching).mockResolvedValueOnce(
        view,
      );

      const from = new Date('2024-02-06T21:59');
      const to = new Date('2024-02-06T22:00');

      await controller.valueChangeHandler(
        cameraManager,
        view,
        {
          performance: createPerformanceConfig({
            features: {
              media_chunk_size: 11,
            },
          }),
        },
        {
          mediaType: MediaFilterMediaType.Recordings,
          when: {
            to: to,
            from: from,
          },
          favorite: MediaFilterCoreFavoriteSelection.Favorite,
        },
      );

      expect(vi.mocked(executeMediaQueryForViewWithErrorDispatching)).toBeCalledWith(
        host,
        cameraManager,
        view,
        expect.anything(),
        {
          targetCameraID: 'camera.kitchen',
          targetView: 'recordings',
        },
      );
      expect(
        vi
          .mocked(executeMediaQueryForViewWithErrorDispatching)
          .mock.calls[0][3].getQueries(),
      ).toEqual([
        {
          cameraIDs: new Set(['camera.kitchen']),
          type: 'recording-query',
          favorite: true,
          start: from,
          end: to,
          limit: 11,
        },
      ]);

      expect(eventListener).toBeCalled();
      expect(host.requestUpdate).toBeCalled();
    });

    it('without favorites', async () => {
      const controller = new MediaFilterController(createHost());
      const cameraManager = createCameraManager();
      vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

      await controller.valueChangeHandler(
        cameraManager,
        createView(),
        {},
        {
          mediaType: MediaFilterMediaType.Recordings,
          when: {},
        },
      );

      expect(
        vi
          .mocked(executeMediaQueryForViewWithErrorDispatching)
          .mock.calls[0][3].getQueries(),
      ).toEqual([
        {
          cameraIDs: new Set(['camera.kitchen']),
          type: 'recording-query',
        },
      ]);
    });

    describe('with fixed when selection', () => {
      const date = new Date('2024-10-01T17:14');

      beforeAll(() => {
        vi.useFakeTimers();
        vi.setSystemTime(date);
      });

      afterAll(() => {
        vi.useFakeTimers();
      });

      it.each([
        [MediaFilterCoreWhen.Today, startOfDay(date), endOfDay(date)],
        [
          MediaFilterCoreWhen.Yesterday,
          startOfDay(sub(date, { days: 1 })),
          endOfDay(sub(date, { days: 1 })),
        ],
        [
          MediaFilterCoreWhen.PastWeek,
          startOfDay(sub(date, { days: 7 })),
          endOfDay(date),
        ],
        [
          MediaFilterCoreWhen.PastMonth,
          startOfDay(sub(date, { months: 1 })),
          endOfDay(date),
        ],
        [
          '2024-02-01,2024-02-29',
          new Date('2024-02-01T00:00:00'),
          new Date('2024-02-29T23:59:59.999'),
        ],
      ])('%s', async (value: MediaFilterCoreWhen | string, from: Date, to: Date) => {
        const controller = new MediaFilterController(createHost());
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

        await controller.valueChangeHandler(
          cameraManager,
          createView(),
          {},
          {
            mediaType: MediaFilterMediaType.Recordings,
            when: {
              selected: value,
            },
          },
        );

        expect(
          vi
            .mocked(executeMediaQueryForViewWithErrorDispatching)
            .mock.calls[0][3].getQueries(),
        ).toEqual([
          {
            cameraIDs: new Set(['camera.kitchen']),
            type: 'recording-query',
            start: from,
            end: to,
          },
        ]);
      });

      it('custom without values', async () => {
        const controller = new MediaFilterController(createHost());
        const cameraManager = createCameraManager();
        vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

        await controller.valueChangeHandler(
          cameraManager,
          createView(),
          {},
          {
            mediaType: MediaFilterMediaType.Recordings,
            when: {
              selected: MediaFilterCoreWhen.Custom,
            },
          },
        );

        expect(
          vi
            .mocked(executeMediaQueryForViewWithErrorDispatching)
            .mock.calls[0][3].getQueries(),
        ).toEqual([
          {
            cameraIDs: new Set(['camera.kitchen']),
            type: 'recording-query',
          },
        ]);
      });
    });
  });

  describe('should calculate correct defaults', () => {
    it('with no queries', () => {
      const controller = new MediaFilterController(createHost());

      controller.computeInitialDefaultsFromView(createCameraManager(), createView());

      expect(controller.getDefaults()).toBeNull();
    });

    it('with no cameras', () => {
      const controller = new MediaFilterController(createHost());

      controller.computeInitialDefaultsFromView(
        createCameraManager(),
        createView({
          query: new EventMediaQueries([
            { type: QueryType.Event, cameraIDs: new Set(['camera.kitchen']) },
          ]),
        }),
      );

      expect(controller.getDefaults()).toBeNull();
    });

    describe('for queries', () => {
      it.each([
        [
          'same cameras' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen', 'camera.living_room']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen', 'camera.living_room']),
            },
          ]),
          {
            cameraIDs: ['camera.kitchen', 'camera.living_room'],
          },
        ],
        [
          'different cameras' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.living_room']),
            },
          ]),
          {},
        ],
        [
          'all cameras' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
            },
          ]),
          {},
        ],
        [
          'different favorites ' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              favorite: true,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              favorite: undefined,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              favorite: false,
            },
          ]),
          {},
        ],
        [
          'all favorites' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              favorite: true,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              favorite: true,
            },
          ]),
          {
            favorite: MediaFilterCoreFavoriteSelection.Favorite,
          },
        ],
        [
          'all not favorites' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              favorite: false,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              favorite: false,
            },
          ]),
          {
            favorite: MediaFilterCoreFavoriteSelection.NotFavorite,
          },
        ],
        [
          'same hasClip' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasClip: true,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasClip: true,
            },
          ]),
          {
            mediaType: MediaFilterMediaType.Clips,
          },
        ],
        [
          'different hasClip' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasClip: true,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasClip: false,
            },
          ]),
          {},
        ],
        [
          'same hasSnapshot' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasSnapshot: true,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasSnapshot: true,
            },
          ]),
          {
            mediaType: MediaFilterMediaType.Snapshots,
          },
        ],
        [
          'different hasSnapshot' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasSnapshot: true,
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              hasSnapshot: false,
            },
          ]),
          {},
        ],
        [
          'same what' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              what: new Set(['person']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              what: new Set(['person']),
            },
          ]),
          {
            what: ['person' as const],
          },
        ],
        [
          'different what' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              what: new Set(['person']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              what: new Set(['car']),
            },
          ]),
          {},
        ],
        [
          'same where' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              where: new Set(['front_door']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              where: new Set(['front_door']),
            },
          ]),
          {
            where: ['front_door' as const],
          },
        ],
        [
          'different where' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              where: new Set(['front_door']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              where: new Set(['back_steps']),
            },
          ]),
          {},
        ],
        [
          'same tags' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              tags: new Set(['tag-1']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              tags: new Set(['tag-1']),
            },
          ]),
          {
            tags: ['tag-1' as const],
          },
        ],
        [
          'different tags' as const,
          new EventMediaQueries([
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              tags: new Set(['tag-1']),
            },
            {
              type: QueryType.Event,
              cameraIDs: new Set(['camera.kitchen']),
              tags: new Set(['tag-2']),
            },
          ]),
          {},
        ],
        [
          'recordings' as const,
          new RecordingMediaQueries([
            {
              type: QueryType.Recording,
              cameraIDs: new Set(['camera.kitchen']),
            },
          ]),
          {
            mediaType: MediaFilterMediaType.Recordings
          },
        ],
      ])(
        '%s',
        (
          _name: string,
          mediaQueries: MediaQueries,
          defaults: MediaFilterCoreDefaults | null,
        ) => {
          const controller = new MediaFilterController(createHost());
          const cameraManager = createCameraManager();
          vi.mocked(cameraManager.getStore).mockReturnValue(createCameraStore());

          controller.computeInitialDefaultsFromView(
            cameraManager,
            createView({
              query: mediaQueries,
            }),
          );

          expect(controller.getDefaults()).toEqual(defaults);
        },
      );
    });
  });
});
