import { describe, expect, it } from 'vitest';
import {
  EventQuery,
  PartialEventQuery,
  PartialRecordingQuery,
  QueryType,
  RecordingQuery,
} from '../../src/camera-manager/types';
import { setify } from '../../src/utils/basic';
import { EventMediaQueries, RecordingMediaQueries } from '../../src/view/media-queries';

describe('EventMediaQueries', () => {
  const createRawEventQueries = (
    cameraIDs: string | Set<string>,
    query?: PartialEventQuery,
  ): EventQuery[] => {
    return [
      {
        type: QueryType.Event,
        cameraIDs: setify(cameraIDs),
        ...query,
      },
    ];
  };

  it('should construct', () => {
    const rawQueries = createRawEventQueries('office');
    const queries = new EventMediaQueries(rawQueries);
    expect(queries.getQueries()).toBe(rawQueries);
  });

  it('should set', () => {
    const rawQueries = createRawEventQueries('office');
    const queries = new EventMediaQueries(rawQueries);

    const newRawQueries = createRawEventQueries('kitchen');
    queries.setQueries(newRawQueries);
    expect(queries.getQueries()).toBe(newRawQueries);
  });

  it('should determine if queries exist for CameraIDs', () => {
    const rawQueries = createRawEventQueries(new Set(['office', 'kitchen']));
    const queries = new EventMediaQueries(rawQueries);

    expect(queries.hasQueriesForCameraIDs(new Set(['office']))).toBeTruthy();
    expect(queries.hasQueriesForCameraIDs(new Set(['office', 'kitchen']))).toBeTruthy();
    expect(
      queries.hasQueriesForCameraIDs(new Set(['office', 'front_door'])),
    ).toBeFalsy();
  });

  it('should convert to clips querys', () => {
    const rawQueries = createRawEventQueries('office', { hasSnapshot: true });
    const queries = new EventMediaQueries(rawQueries);

    expect(queries.convertToClipsQueries().getQueries()).toEqual([
      {
        type: QueryType.Event,
        cameraIDs: new Set(['office']),
        hasClip: true,
      },
    ]);
  });

  it('should convert when queries are null', () => {
    const queries = new EventMediaQueries();
    expect(queries.convertToClipsQueries().getQueries()).toBeNull();
  });

  it('should clone', () => {
    const rawQueries = createRawEventQueries('office', { hasSnapshot: true });
    const queries = new EventMediaQueries(rawQueries);
    expect(queries.clone().getQueries()).toEqual(queries.getQueries());
  });

  it('should get camera IDs when queries are null', () => {
    expect(new EventMediaQueries().getQueryCameraIDs()).toBeNull();
  });

  it('should get camera IDs', () => {
    const cameraIDs = ['office', 'kitchen'];
    const queries = new EventMediaQueries(createRawEventQueries(new Set(cameraIDs)));
    expect(queries.getQueryCameraIDs()).toEqual(new Set(cameraIDs));
  });

  it('should set camera IDs when queries are null', () => {
    expect(
      new EventMediaQueries().setQueryCameraIDs(new Set(['office'])).getQueryCameraIDs(),
    ).toBeNull();
  });

  it('should set camera IDs', () => {
    const queries = new EventMediaQueries(createRawEventQueries('sitting_room'));
    const newCameraIDs = new Set(['office', 'kitchen']);
    expect(queries.setQueryCameraIDs(newCameraIDs).getQueryCameraIDs()).toEqual(
      newCameraIDs,
    );
  });
});

describe('RecordingMediaQueries', () => {
  const createRawRecordingQueries = (
    cameraIDs: string | Set<string>,
    query?: PartialRecordingQuery,
  ): RecordingQuery[] => {
    return [
      {
        type: QueryType.Recording,
        cameraIDs: setify(cameraIDs),
        ...query,
      },
    ];
  };

  it('should construct', () => {
    const rawQueries = createRawRecordingQueries('office');
    const queries = new RecordingMediaQueries(rawQueries);
    expect(queries.getQueries()).toBe(rawQueries);
  });
});
