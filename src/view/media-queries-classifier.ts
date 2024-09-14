import { EventMediaQueries, MediaQueries, RecordingMediaQueries } from './media-queries';

export type MediaQueriesType = 'event' | 'recording';
type MediaType = 'clips' | 'snapshots' | 'recordings';

export class MediaQueriesClassifier {
  public static areEventQueries(
    queries?: MediaQueries | null,
  ): queries is EventMediaQueries {
    return queries instanceof EventMediaQueries;
  }

  public static areRecordingQueries(
    queries?: MediaQueries | null,
  ): queries is RecordingMediaQueries {
    return queries instanceof RecordingMediaQueries;
  }

  public static areClipsQueries(queries?: MediaQueries | null): boolean {
    return (
      this.areEventQueries(queries) &&
      !!queries?.getQueries()?.every((query) => query.hasClip)
    );
  }

  public static areSnapshotQueries(queries?: MediaQueries | null): boolean {
    return (
      this.areEventQueries(queries) &&
      !!queries?.getQueries()?.every((query) => query.hasSnapshot)
    );
  }

  public static getQueriesType(queries?: MediaQueries | null): MediaQueriesType | null {
    return this.areEventQueries(queries)
      ? 'event'
      : this.areRecordingQueries(queries)
        ? 'recording'
        : null;
  }

  public static getMediaType(queries?: MediaQueries | null): MediaType | null {
    return this.areClipsQueries(queries)
      ? 'clips'
      : this.areSnapshotQueries(queries)
        ? 'snapshots'
        : this.areRecordingQueries(queries)
          ? 'recordings'
          : null;
  }
}
