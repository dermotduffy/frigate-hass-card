import { expect, it } from 'vitest';
import { SetQueryViewModifier } from '../../../../src/card-controller/view/modifiers/set-query';
import { createView } from '../../../test-utils';
import { EventMediaQueries } from '../../../../src/view/media-queries';
import { MediaQueriesResults } from '../../../../src/view/media-queries-results';

it('should do nothing without arguments', () => {
  const view = createView();

  const modifier = new SetQueryViewModifier();
  modifier.modify(view);

  expect(view.query).toBeNull();
  expect(view.queryResults).toBeNull();
});

it('should set query and results', () => {
  const view = createView();
  const query = new EventMediaQueries();
  const queryResults = new MediaQueriesResults();

  const modifier = new SetQueryViewModifier({
    query: query,
    queryResults: queryResults,
  });
  modifier.modify(view);

  expect(view.query).toBe(query);
  expect(view.queryResults).toBe(queryResults);
});
