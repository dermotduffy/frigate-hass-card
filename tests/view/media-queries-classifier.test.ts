import { describe, expect, it } from 'vitest';
import { EventMediaQueries, RecordingMediaQueries } from '../../src/view/media-queries';
import { MediaQueriesClassifier } from '../../src/view/media-queries-classifier';
import { QueryType } from '../../src/camera-manager/types';

describe('MediaQueriesClassifier', () => {
  it('areEventQueries', () => {
    expect(MediaQueriesClassifier.areEventQueries(new EventMediaQueries())).toBeTruthy();
    expect(
      MediaQueriesClassifier.areEventQueries(new RecordingMediaQueries()),
    ).toBeFalsy();
  });

  it('areRecordingQueries', () => {
    expect(
      MediaQueriesClassifier.areRecordingQueries(new RecordingMediaQueries()),
    ).toBeTruthy();
    expect(
      MediaQueriesClassifier.areRecordingQueries(new EventMediaQueries()),
    ).toBeFalsy();
  });

  it('getQueriesType', () => {
    expect(MediaQueriesClassifier.getQueriesType(new EventMediaQueries())).toBe('event');
    expect(MediaQueriesClassifier.getQueriesType(new RecordingMediaQueries())).toBe(
      'recording',
    );
    expect(MediaQueriesClassifier.getQueriesType()).toBeNull();
  });

  it('areClipsQueries', () => {
    expect(
      MediaQueriesClassifier.areClipsQueries(
        new EventMediaQueries([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: true },
        ]),
      ),
    ).toBeTruthy();
    expect(
      MediaQueriesClassifier.areClipsQueries(
        new EventMediaQueries([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: true },
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: false },
        ]),
      ),
    ).toBeFalsy();
    expect(
      MediaQueriesClassifier.areClipsQueries(
        new EventMediaQueries([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: true },
          { type: QueryType.Event, cameraIDs: new Set(['camera']) },
        ]),
      ),
    ).toBeFalsy();
  });

  it('areSnapshotQueries', () => {
    expect(
      MediaQueriesClassifier.areSnapshotQueries(
        new EventMediaQueries([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: true },
        ]),
      ),
    ).toBeTruthy();
    expect(
      MediaQueriesClassifier.areSnapshotQueries(
        new EventMediaQueries([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: true },
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: false },
        ]),
      ),
    ).toBeFalsy();
    expect(
      MediaQueriesClassifier.areSnapshotQueries(
        new EventMediaQueries([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: true },
          { type: QueryType.Event, cameraIDs: new Set(['camera']) },
        ]),
      ),
    ).toBeFalsy();
  });

  it('getMediaType', () => {
    expect(
      MediaQueriesClassifier.getMediaType(
        new EventMediaQueries([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: true },
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: true },
        ]),
      ),
    ).toBe('snapshots');

    expect(
      MediaQueriesClassifier.getMediaType(
        new EventMediaQueries([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: true },
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasClip: true },
        ]),
      ),
    ).toBe('clips');

    expect(
      MediaQueriesClassifier.getMediaType(
        new RecordingMediaQueries([
          { type: QueryType.Recording, cameraIDs: new Set(['camera']) },
          { type: QueryType.Recording, cameraIDs: new Set(['camera']) },
        ]),
      ),
    ).toBe('recordings');

    expect(
      MediaQueriesClassifier.getMediaType(
        new EventMediaQueries([
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: true },
          { type: QueryType.Event, cameraIDs: new Set(['camera']), hasSnapshot: false },
        ]),
      ),
    ).toBeNull();
  });
});
