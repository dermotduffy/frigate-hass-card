import { describe, expect, it } from 'vitest';
import { EventMediaQueries, RecordingMediaQueries } from '../../src/view/media-queries';
import { MediaQueriesClassifier } from '../../src/view/media-queries-classifier';

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
});
