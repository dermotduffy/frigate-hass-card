import { MediaQueries } from '../../../view/media-queries';
import { MediaQueriesResults } from '../../../view/media-queries-results';
import { View } from '../../../view/view';
import { ViewModifier } from '../types';

export class SetQueryViewModifier implements ViewModifier {
  protected _query?: MediaQueries | null;
  protected _queryResults?: MediaQueriesResults | null;

  constructor(options?: {
    query?: MediaQueries | null;
    queryResults?: MediaQueriesResults | null;
  }) {
    this._query = options?.query;
    this._queryResults = options?.queryResults;
  }

  public modify(view: View): void {
    if (this._query !== undefined) {
      view.query = this._query;
    }
    if (this._queryResults !== undefined) {
      view.queryResults = this._queryResults;
    }
  }
}
