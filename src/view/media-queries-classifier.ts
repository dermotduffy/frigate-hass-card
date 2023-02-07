import { EventMediaQueries, MediaQueries, RecordingMediaQueries } from './media-queries';

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
}
