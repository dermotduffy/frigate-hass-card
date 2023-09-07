import { EventMediaQueries, MediaQueries, RecordingMediaQueries } from './media-queries';

export type MediaQueriesType = 'event' | 'recording';
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

  public static getQueriesType(queries?: MediaQueries | null): MediaQueriesType | null {
    return this.areEventQueries(queries)
      ? 'event'
      : this.areRecordingQueries(queries)
      ? 'recording'
      : null;
  }
}
